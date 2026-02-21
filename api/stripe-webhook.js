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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // One-time payments (tips) - store in tips collection.
      if (!session.subscription) {
        let tipInstagram = (session.metadata && session.metadata.tip_instagram_handle) || null;
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
          instagram_handle: tipInstagram || null,
          stripeCustomerId: session.customer || null,
          stripeSessionId: session.id,
          paymentStatus: session.payment_status || null,
          source: "stripe_tip",
        });

        json(res, 200, { received: true });
        return;
      }

      // Subscription checkout - create member record.
      const email = session.customer_email || (session.customer_details && session.customer_details.email);
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
        });
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
