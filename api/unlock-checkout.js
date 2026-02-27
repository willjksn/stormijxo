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
  const requestPath = ((req && req.url) || "").toString().toLowerCase();

  // Production safety net: if Vercel misroutes landing checkout paths here,
  // forward to the intended handler instead of returning unlock validation errors.
  if (requestPath.includes("landing-subscription")) {
    const landingSubscriptionHandler = require("./landing-subscription");
    return landingSubscriptionHandler(req, res);
  }
  if (requestPath.includes("landing-tip")) {
    const landingTipHandler = require("./landing-tip");
    return landingTipHandler(req, res);
  }
  if (requestPath.includes("subscription-checkout")) {
    const subscriptionCheckoutHandler = require("./subscription-checkout");
    return subscriptionCheckoutHandler(req, res);
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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
    json(res, 500, { error: "Stripe secret is not configured" });
    return;
  }

  const body = parseBody(req);
  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  if (!postId || !uid) {
    json(res, 400, { error: "Missing postId or uid." });
    return;
  }

  let priceCents = 0;
  try {
    const admin = getFirebaseAdmin();
    const snap = await admin.firestore().collection("posts").doc(postId).get();
    if (!snap.exists) {
      json(res, 404, { error: "Post not found." });
      return;
    }
    const d = snap.data() || {};
    const locked = d.lockedContent || null;
    if (!locked || !locked.enabled) {
      json(res, 400, { error: "This post is not locked." });
      return;
    }
    priceCents = typeof locked.priceCents === "number" ? Math.round(locked.priceCents) : 0;
    if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 100000) {
      json(res, 400, { error: "Invalid unlock price." });
      return;
    }
  } catch (err) {
    console.error("unlock-checkout Firestore read error:", err);
    json(res, 500, { error: "Could not load unlock settings." });
    return;
  }

  const baseUrl = body.base_url || process.env.PUBLIC_APP_URL || "https://stormijxo.com";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const successUrl = body.success_url || `${normalizedBase}/post/${encodeURIComponent(postId)}?unlocked=1`;
  const cancelUrl = body.cancel_url || `${normalizedBase}/post/${encodeURIComponent(postId)}`;
  const customerEmail =
    typeof body.customer_email === "string" ? body.customer_email.trim() : undefined;

  try {
    const stripe = new Stripe(stripeSecret);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: priceCents,
            product_data: {
              name: "Unlock Post",
              description: "Unlock this post's full media set",
              metadata: { type: "unlock_post", postId },
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail || undefined,
      metadata: {
        type: "unlock_post",
        unlock_post_id: postId,
        unlock_uid: uid,
      },
    });

    json(res, 200, { url: session.url });
  } catch (err) {
    console.error("unlock-checkout error:", err);
    json(res, 500, { error: err && err.message ? err.message : "Checkout session failed" });
  }
};
