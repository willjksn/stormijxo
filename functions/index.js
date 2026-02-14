const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();

/**
 * Stripe webhook: when a customer completes checkout, create a member in Firestore.
 * Uses req.rawBody for signature verification (required by Stripe).
 */
exports.stripeWebhook = functions
  .runWith({ node: "20" })
  .https.onRequest(async (req, res) => {
    // CORS: allow Stripe to send requests
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
      console.error("Stripe config missing. Run: firebase functions:config:set stripe.secret=\"sk_...\" stripe.webhook_secret=\"whsec_...\"");
      res.status(500).send("Webhook not configured");
      return;
    }

    const stripe = Stripe(stripeSecret);
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      console.error("Missing Stripe-Signature header");
      res.status(400).send("Missing Stripe-Signature");
      return;
    }

    // Stripe requires the exact raw body for signature verification (Firebase provides req.rawBody)
    const rawBody = req.rawBody;
    const payload = rawBody ? (Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody)) : null;
    if (!payload) {
      console.error("No raw body - cannot verify signature");
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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = session.customer_email || (session.customer_details && session.customer_details.email);

      if (!email) {
        console.warn("Checkout completed but no customer email", session.id);
        res.json({ received: true });
        return;
      }

      const db = admin.firestore();
      const membersRef = db.collection("members");
      const tier = (session.metadata && session.metadata.tier) || (session.metadata && session.metadata.price_id) || null;

      try {
        await membersRef.add({
          email: email,
          status: "active",
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
          stripeCustomerId: session.customer || null,
          stripeSessionId: session.id,
          tier: tier,
          source: "stripe",
        });
        console.log("Created member from Stripe:", email);
      } catch (err) {
        console.error("Firestore add failed:", err);
        res.status(500).send("Failed to create member");
        return;
      }
    }

    res.json({ received: true });
  });
