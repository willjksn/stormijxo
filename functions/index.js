const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const express = require("express");

admin.initializeApp();

/** One-time tip: create Stripe Checkout Session (mode: payment), return URL for redirect. */
const tipApp = express();
tipApp.use(express.json());
tipApp.post("/", async function(req, res) {
  const body = req.body || {};
  const amountCents = typeof body.amount === "number" ? body.amount : parseInt(body.amount, 10);
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 100000) {
    return res.status(400).json({ error: "Amount must be between 100 and 100000 cents ($1–$1000)" });
  }
  const baseUrl = body.base_url || "https://stormij.vercel.app";
  const successUrl = body.success_url || baseUrl + (baseUrl.endsWith("/") ? "" : "/") + "success?tip=1";
  const cancelUrl = body.cancel_url || baseUrl + (baseUrl.endsWith("/") ? "" : "/");
  const instagramHandle = typeof body.instagram_handle === "string" ? body.instagram_handle.trim().slice(0, 64) : "";
  const config = functions.config();
  const stripeSecret = config.stripe && config.stripe.secret;
  if (!stripeSecret) {
    return res.status(500).json({ error: "Stripe not configured" });
  }
  const stripe = Stripe(stripeSecret);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: "Tip for Stormi J__XO",
              description: "One-time tip for Stormi J__XO",
              images: [],
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: "tip",
        tip_instagram_handle: instagramHandle || "",
      },
      custom_fields: [
        {
          key: "instagram_handle",
          label: { type: "custom", custom: "(optional) Who's showing love?" },
          type: "text",
          optional: true,
        },
      ],
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Tip checkout error:", err);
    res.status(500).json({ error: err.message || "Checkout failed" });
  }
});
tipApp.all("*", function(req, res) {
  res.status(405).json({ error: "Method not allowed" });
});

// Shared HTTP wrapper for tip checkout endpoints.
function tipCheckoutHttpHandler(req, res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  tipApp(req, res);
}

// Keep existing name and also expose a new endpoint name to bypass stale IAM/policy issues.
exports.createTipCheckout = functions.runWith({ node: "20" }).https.onRequest(tipCheckoutHttpHandler);
exports.createTipCheckoutPublic = functions.runWith({ node: "20" }).https.onRequest(tipCheckoutHttpHandler);

/**
 * Stripe webhook: creates/updates fan records in Firestore.
 * - checkout.session.completed: create member (email, Instagram handle, subscription id).
 * - customer.subscription.updated/deleted: set cancelled, cancel date, access_ends_at (countdown).
 */
exports.stripeWebhook = functions
  .runWith({ node: "20" })
  .https.onRequest(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type, Stripe-Signature");
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const config = functions.config();
    const stripeSecret = config.stripe && config.stripe.secret;
    const webhookSecret = config.stripe && config.stripe.webhook_secret;

    if (!stripeSecret || !webhookSecret) {
      console.error("Stripe config missing.");
      res.status(500).send("Webhook not configured");
      return;
    }

    const stripe = Stripe(stripeSecret);
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).send("Missing Stripe-Signature");
      return;
    }

    const rawBody = req.rawBody;
    const payload = rawBody ? (Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody)) : null;
    if (!payload) {
      res.status(400).send("Bad request");
      return;
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send("Invalid signature");
      return;
    }

    const db = admin.firestore();
    const membersRef = db.collection("members");
    const tipsRef = db.collection("tips");

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      // One-time payments (e.g. tips) have no subscription — do not add to members
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
        try {
          await tipsRef.add({
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            tippedAt: session.created ? admin.firestore.Timestamp.fromMillis(session.created * 1000) : admin.firestore.FieldValue.serverTimestamp(),
            amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
            currency: session.currency || "usd",
            email: tipEmail,
            instagram_handle: tipInstagram || null,
            stripeCustomerId: session.customer || null,
            stripeSessionId: session.id,
            paymentStatus: session.payment_status || null,
            source: "stripe_tip",
          });
          console.log("Logged tip:", session.id, tipEmail || "", tipInstagram || "");
        } catch (err) {
          console.error("Tip log write failed:", err);
        }
        res.json({ received: true });
        return;
      }
      const email = session.customer_email || (session.customer_details && session.customer_details.email);
      if (!email) {
        res.json({ received: true });
        return;
      }

      // Instagram handle from Stripe custom field (add a custom field "Instagram handle" on your Payment Link)
      let instagram_handle = null;
      const customFields = session.custom_fields || [];
      for (const f of customFields) {
        const key = (f.key || "").toLowerCase();
        const label = (f.label && f.label.custom) ? f.label.custom.toLowerCase() : "";
        if (key.includes("instagram") || label.includes("instagram")) {
          if (f.text && f.text.value) instagram_handle = f.text.value;
          else if (f.dropdown && f.dropdown.value) instagram_handle = f.dropdown.value;
          break;
        }
      }
      if (!instagram_handle && customFields.length > 0 && customFields[0].text && customFields[0].text.value) {
        instagram_handle = customFields[0].text.value;
      }

      const tier = (session.metadata && session.metadata.tier) || null;
      try {
        await membersRef.add({
          email: email,
          instagram_handle: instagram_handle || null,
          status: "active",
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
          stripeCustomerId: session.customer || null,
          stripeSubscriptionId: session.subscription || null,
          stripeSessionId: session.id,
          tier: tier,
          source: "stripe",
        });
        console.log("Created member from Stripe:", email, instagram_handle || "");
      } catch (err) {
        console.error("Firestore add failed:", err);
        res.status(500).send("Failed to create member");
        return;
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const subId = subscription.id;
      const customerId = subscription.customer;
      const periodEnd = subscription.current_period_end; // Unix timestamp; access until this date
      const cancelAtPeriodEnd = subscription.cancel_at_period_end;
      const isDeleted = event.type === "customer.subscription.deleted";

      // Only mark cancelled when they cancelled (at period end) or subscription was deleted
      if (!isDeleted && !cancelAtPeriodEnd) {
        res.json({ received: true });
        return;
      }

      const snapshot = await membersRef.where("stripeSubscriptionId", "==", subId).limit(1).get();
      let docRef = snapshot.empty ? null : snapshot.docs[0].ref;
      if (!docRef) {
        const byCustomer = await membersRef.where("stripeCustomerId", "==", customerId).orderBy("joinedAt", "desc").limit(1).get();
        if (!byCustomer.empty) {
          docRef = byCustomer.docs[0].ref;
          await docRef.update({ stripeSubscriptionId: subId });
        }
      }
      if (docRef) {
        await docRef.update({
          status: "cancelled",
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          access_ends_at: periodEnd ? admin.firestore.Timestamp.fromMillis(periodEnd * 1000) : null,
        });
        console.log("Updated member cancelled, access until:", periodEnd);
      }
    }

    res.json({ received: true });
  });

/**
 * Create Stripe Customer Portal session for the logged-in user.
 * Looks up member by auth email, returns portal URL for subscription management (cancel, etc.).
 */
exports.createCustomerPortalSession = functions
  .runWith({ node: "20" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }
    const email = context.auth.token.email;
    if (!email) {
      throw new functions.https.HttpsError("failed-precondition", "No email on account.");
    }
    const returnUrl = typeof data === "object" && data && typeof data.returnUrl === "string"
      ? data.returnUrl
      : "https://stormij.vercel.app/profile";

    const config = functions.config();
    const stripeSecret = config.stripe && config.stripe.secret;
    if (!stripeSecret) {
      throw new functions.https.HttpsError("internal", "Stripe not configured");
    }

    const db = admin.firestore();
    const membersSnap = await db.collection("members").where("email", "==", email).limit(1).get();
    if (membersSnap.empty) {
      throw new functions.https.HttpsError("failed-precondition", "No subscription found for this email.");
    }
    const member = membersSnap.docs[0].data();
    const customerId = member.stripeCustomerId;
    if (!customerId) {
      throw new functions.https.HttpsError("failed-precondition", "No Stripe customer linked.");
    }

    const stripe = Stripe(stripeSecret);
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return { url: session.url };
    } catch (err) {
      console.error("Customer portal error:", err);
      throw new functions.https.HttpsError("internal", err.message || "Could not create portal session");
    }
  });
