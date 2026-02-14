const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();

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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
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
