const Stripe = require("stripe");
const { getFirebaseAdmin } = require("./_lib/firebase-admin");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (!req || req.body == null) return {};
  if (typeof req.body === "object") return req.body;
  if (typeof req.body !== "string") return {};
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

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
  if (!stripeSecret) {
    json(res, 500, { error: "Stripe is not configured." });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    json(res, 401, { error: "Missing auth token." });
    return;
  }

  const body = parseBody(req);
  const returnUrl =
    typeof body.returnUrl === "string" && body.returnUrl.trim()
      ? body.returnUrl.trim()
      : "https://stormijxo.com/profile";
  const bodyEmail = typeof body.email === "string" ? body.email.trim() : "";
  const bodyUid = typeof body.uid === "string" ? body.uid.trim() : "";

  try {
    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(token);

    const uid = (decoded.uid || bodyUid || "").toString().trim();
    const tokenEmail = typeof decoded.email === "string" ? decoded.email.trim() : "";
    let rawEmail = tokenEmail || bodyEmail;
    let email = rawEmail.toLowerCase();

    const db = admin.firestore();
    const membersRef = db.collection("members");
    let membersSnap = await membersRef.limit(0).get();

    if (uid) {
      const uidFields = ["uid", "userId", "user_id", "firebaseUid", "firebase_uid"];
      for (const field of uidFields) {
        // eslint-disable-next-line no-await-in-loop
        const byUid = await membersRef.where(field, "==", uid).limit(1).get();
        if (!byUid.empty) {
          membersSnap = byUid;
          break;
        }
      }
    }

    if (membersSnap.empty && !email && uid) {
      const userDoc = await db.collection("users").doc(uid).get();
      const userEmail = ((userDoc.data() && userDoc.data().email) || "").toString().trim();
      if (userEmail) {
        rawEmail = userEmail;
        email = userEmail.toLowerCase();
      }
    }

    if (membersSnap.empty && rawEmail) {
      membersSnap = await membersRef.where("email", "==", rawEmail).limit(1).get();
    }
    if (membersSnap.empty && tokenEmail) {
      membersSnap = await membersRef.where("email", "==", tokenEmail).limit(1).get();
    }
    if (membersSnap.empty && bodyEmail) {
      membersSnap = await membersRef.where("email", "==", bodyEmail).limit(1).get();
    }
    if (membersSnap.empty && email && rawEmail !== email) {
      membersSnap = await membersRef.where("email", "==", email).limit(1).get();
    }

    if (membersSnap.empty && !email) {
      json(res, 400, { error: "No email found on your account. Please sign in again and retry." });
      return;
    }

    if (membersSnap.empty) {
      json(res, 404, { error: "No subscription found for this account." });
      return;
    }

    const memberDoc = membersSnap.docs[0];
    const member = memberDoc.data() || {};
    const stripe = new Stripe(stripeSecret);

    let customerId =
      (member.stripeCustomerId || member.stripe_customer_id || "").toString().trim();
    const subscriptionId =
      (member.stripeSubscriptionId || member.stripe_subscription_id || "").toString().trim();

    if (!customerId && subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (typeof subscription.customer === "string" && subscription.customer.trim()) {
          customerId = subscription.customer.trim();
          await memberDoc.ref.set(
            { stripeCustomerId: customerId, stripe_customer_id: customerId },
            { merge: true }
          );
        }
      } catch {
        // Keep graceful fallback below.
      }
    }

    if (!customerId) {
      json(res, 409, {
        error: "No Stripe customer linked to this account yet. Please contact support and we can reconnect it.",
      });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    json(res, 200, { url: session.url });
  } catch (err) {
    const message = err && err.message ? err.message : "Could not create customer portal session.";
    json(res, 500, { error: message });
  }
};
