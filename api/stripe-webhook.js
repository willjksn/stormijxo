const Stripe = require("stripe");
const { getFirebaseAdmin } = require("./_lib/firebase-admin");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Stripe-Signature");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end("");
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const stripeSecret =
    process.env.Stripe_Secret_key ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET;
  const webhookSecret =
    process.env.stripe_webhook_secret ||
    process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !webhookSecret) {
    json(res, 500, { error: "Stripe webhook env vars are missing" });
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) {
    json(res, 400, { error: "Missing Stripe-Signature" });
    return;
  }

  let event;
  let rawBody;
  try {
    rawBody = await readRawBody(req);
    const stripe = new Stripe(stripeSecret);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("stripe-webhook signature verification failed:", err && err.message ? err.message : err);
    json(res, 400, { error: "Invalid signature" });
    return;
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const membersRef = db.collection("members");
    const tipsRef = db.collection("tips");
    const purchasesRef = db.collection("purchases");
    const subscriptionPaymentsRef = db.collection("subscriptionPayments");
    const usersRef = db.collection("users");

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // One-time payments (tips or treats)
      if (!session.subscription) {
        const meta = session.metadata || {};
        const isTreat = meta.type === "treat";
        const isUnlockPost = meta.type === "unlock_post";

        if (isUnlockPost) {
          const unlockPostId =
            typeof meta.unlock_post_id === "string" ? meta.unlock_post_id.trim() : "";
          const unlockUid =
            typeof meta.unlock_uid === "string" ? meta.unlock_uid.trim() : "";
          const unlockEmail =
            session.customer_email ||
            (session.customer_details && session.customer_details.email) ||
            null;

          if (unlockPostId) {
            const unlockPayload = {
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              unlockedAt: session.created
                ? admin.firestore.Timestamp.fromMillis(session.created * 1000)
                : admin.firestore.FieldValue.serverTimestamp(),
              postId: unlockPostId,
              uid: unlockUid || null,
              email: unlockEmail,
              amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
              currency: session.currency || "usd",
              stripeCustomerId: session.customer || null,
              stripeSessionId: session.id,
              paymentStatus: session.payment_status || null,
              source: "stripe_post_unlock",
            };

            await db.collection("postUnlocks").add(unlockPayload);

            if (unlockUid) {
              await usersRef.doc(unlockUid).set(
                {
                  unlockedPostIds: admin.firestore.FieldValue.arrayUnion(unlockPostId),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            } else if (unlockEmail) {
              const byEmail = await usersRef.where("email", "==", unlockEmail).limit(1).get();
              if (!byEmail.empty) {
                await byEmail.docs[0].ref.set(
                  {
                    unlockedPostIds: admin.firestore.FieldValue.arrayUnion(unlockPostId),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  },
                  { merge: true }
                );
              }
            }
          }

          json(res, 200, { received: true });
          return;
        }

        if (isTreat) {
          const email = session.customer_email || (session.customer_details && session.customer_details.email) || null;
          const treatId = meta.treatId || null;
          let productName = treatId ? `Treat: ${treatId}` : null;
          const treatRef = treatId ? db.collection("treats").doc(treatId) : null;
          let treatSnap = null;
          if (treatRef) treatSnap = await treatRef.get();
          if (treatSnap && treatSnap.exists) {
            const d = treatSnap.data();
            const name = (d.name || "").toString();
            if (name) productName = name;
          }
          await purchasesRef.add({
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            purchasedAt: session.created
              ? admin.firestore.Timestamp.fromMillis(session.created * 1000)
              : admin.firestore.FieldValue.serverTimestamp(),
            amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
            currency: session.currency || "usd",
            email,
            treatId,
            productName,
            stripeCustomerId: session.customer || null,
            stripeSessionId: session.id,
            paymentStatus: session.payment_status || null,
            source: "stripe_treat",
          });
          if (treatRef && treatSnap && treatSnap.exists) {
            const current = treatSnap.data().quantityLeft;
            const next = Math.max(0, (typeof current === "number" ? current : 0) - 1);
            await treatRef.update({ quantityLeft: next });
          }
        } else {
        let tipInstagram = (session.metadata && session.metadata.tip_instagram_handle) || null;
        const tipPostId =
          (session.metadata && typeof session.metadata.tip_post_id === "string"
            ? session.metadata.tip_post_id.trim()
            : "") || "";
        const tipUid =
          (session.metadata && typeof session.metadata.tip_uid === "string"
            ? session.metadata.tip_uid.trim()
            : "") || "";
        const customFields = session.custom_fields || [];
        for (const f of customFields) {
          const key = (f.key || "").toLowerCase();
          const label = (f.label && f.label.custom) ? f.label.custom.toLowerCase() : "";
          if (key.includes("instagram") || label.includes("instagram")) {
            if (f.text && f.text.value) tipInstagram = f.text.value;
            else if (f.dropdown && f.dropdown.value) tipInstagram = f.dropdown.value;
            break;
          }
        }
        const tipEmail = session.customer_email || (session.customer_details && session.customer_details.email) || null;

          await tipsRef.add({
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            tippedAt: session.created
              ? admin.firestore.Timestamp.fromMillis(session.created * 1000)
              : admin.firestore.FieldValue.serverTimestamp(),
            amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
            currency: session.currency || "usd",
            email: tipEmail,
            uid: tipUid || null,
            instagram_handle: tipInstagram || null,
            stripeCustomerId: session.customer || null,
            stripeSessionId: session.id,
            paymentStatus: session.payment_status || null,
            source: "stripe_tip",
          });
          if (tipPostId && typeof session.amount_total === "number" && session.amount_total > 0) {
            const postRef = db.collection("posts").doc(tipPostId);
            await db.runTransaction(async (tx) => {
              const snap = await tx.get(postRef);
              if (!snap.exists) return;
              const data = snap.data() || {};
              const currentGoal = (data.tipGoal && typeof data.tipGoal === "object") ? data.tipGoal : null;
              if (!currentGoal) return;
              const currentRaised =
                typeof currentGoal.raisedCents === "number" ? currentGoal.raisedCents : 0;
              tx.update(postRef, {
                tipGoal: {
                  ...currentGoal,
                  raisedCents: currentRaised + session.amount_total,
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            });
          }
        }

        json(res, 200, { received: true });
        return;
      }

      // Subscription checkout - create member record.
      const email = session.customer_email || (session.customer_details && session.customer_details.email);
      if (typeof session.amount_total === "number" && session.amount_total > 0) {
        await subscriptionPaymentsRef.doc(`checkout_${session.id}`).set({
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          paidAt: session.created
            ? admin.firestore.Timestamp.fromMillis(session.created * 1000)
            : admin.firestore.FieldValue.serverTimestamp(),
          amountCents: session.amount_total,
          currency: session.currency || "usd",
          email: email || null,
          stripeCustomerId: session.customer || null,
          stripeSubscriptionId: session.subscription || null,
          stripeSessionId: session.id,
          source: "stripe_subscription_checkout",
        }, { merge: true });
      }
      if (email) {
        let instagramHandle = null;
        const customFields = session.custom_fields || [];
        for (const f of customFields) {
          const key = (f.key || "").toLowerCase();
          const label = (f.label && f.label.custom) ? f.label.custom.toLowerCase() : "";
          if (key.includes("instagram") || label.includes("instagram")) {
            if (f.text && f.text.value) instagramHandle = f.text.value;
            else if (f.dropdown && f.dropdown.value) instagramHandle = f.dropdown.value;
            break;
          }
        }
        if (!instagramHandle && customFields.length > 0 && customFields[0].text && customFields[0].text.value) {
          instagramHandle = customFields[0].text.value;
        }
        const tier = (session.metadata && session.metadata.tier) || null;
        const uid = (session.metadata && session.metadata.uid) || null;

        await membersRef.add({
          email: email,
          instagram_handle: instagramHandle || null,
          status: "active",
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
          stripeCustomerId: session.customer || null,
          stripeSubscriptionId: session.subscription || null,
          stripeSessionId: session.id,
          tier: tier,
          source: "stripe",
          ...(uid ? { uid, userId: uid } : {}),
        });
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const amountPaid = typeof invoice.amount_paid === "number" ? invoice.amount_paid : 0;
      if (amountPaid > 0) {
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : null;
        const subscriptionId =
          typeof invoice.subscription === "string" ? invoice.subscription : null;
        const paidAt = typeof invoice.created === "number"
          ? admin.firestore.Timestamp.fromMillis(invoice.created * 1000)
          : admin.firestore.FieldValue.serverTimestamp();

        let email = (invoice.customer_email || "").toString().trim() || null;
        if (!email && customerId) {
          const byCustomer = await membersRef.where("stripeCustomerId", "==", customerId).limit(1).get();
          if (!byCustomer.empty) {
            email = (byCustomer.docs[0].data().email || "").toString().trim() || null;
          }
        }
        if (!email && subscriptionId) {
          const bySub = await membersRef.where("stripeSubscriptionId", "==", subscriptionId).limit(1).get();
          if (!bySub.empty) {
            email = (bySub.docs[0].data().email || "").toString().trim() || null;
          }
        }

        const invoiceId = (invoice.id || "").toString();
        if (invoiceId) {
          await subscriptionPaymentsRef.doc(`invoice_${invoiceId}`).set({
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            paidAt,
            amountCents: amountPaid,
            currency: invoice.currency || "usd",
            email: email || null,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripeInvoiceId: invoiceId,
            source: "stripe_subscription_invoice",
            billingReason: invoice.billing_reason || null,
          }, { merge: true });
        }
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object;
      const subId = subscription.id;
      const customerId = subscription.customer;
      const periodEnd = subscription.current_period_end;
      const cancelAtPeriodEnd = subscription.cancel_at_period_end;
      const isDeleted = event.type === "customer.subscription.deleted";

      if (!isDeleted && !cancelAtPeriodEnd) {
        json(res, 200, { received: true });
        return;
      }

      const bySub = await membersRef.where("stripeSubscriptionId", "==", subId).limit(1).get();
      let docRef = bySub.empty ? null : bySub.docs[0].ref;

      if (!docRef) {
        const byCustomer = await membersRef
          .where("stripeCustomerId", "==", customerId)
          .orderBy("joinedAt", "desc")
          .limit(1)
          .get();
        if (!byCustomer.empty) {
          docRef = byCustomer.docs[0].ref;
          await docRef.update({ stripeSubscriptionId: subId });
        }
      }

      if (docRef) {
        await docRef.update({
          status: "cancelled",
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          access_ends_at: periodEnd
            ? admin.firestore.Timestamp.fromMillis(periodEnd * 1000)
            : null,
        });
      }
    }

    json(res, 200, { received: true });
  } catch (err) {
    console.error("stripe-webhook handler error:", err);
    json(res, 500, { error: "Webhook processing failed" });
  }
};
