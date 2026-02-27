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
  const body = parseBody(req);
  const checkoutHeader = String(
    (req && req.headers && (req.headers["x-checkout-type"] || req.headers["X-Checkout-Type"])) || ""
  ).trim().toLowerCase();
  const hasTipAmount = body && (body.amountCents != null || body.amount != null);

  // If a tip checkout request is misrouted here, forward it.
  if (body.checkoutType === "tip" || checkoutHeader === "tip" || hasTipAmount || requestPath.includes("tip-checkout")) {
    const tipCheckoutHandler = require("./tip-checkout");
    return tipCheckoutHandler(req, res);
  }

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

  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  if (!postId || !uid) {
    // If request looks like admin user management (misrouted), proxy to correct admin API.
    const memberId = typeof body.memberId === "string" ? String(body.memberId).trim() : "";
    const email = typeof body.email === "string" ? String(body.email).trim() : "";
    const newPassword = typeof body.newPassword === "string" ? String(body.newPassword).trim() : "";
    if (memberId || (email && newPassword)) {
      const proto = (req.headers && (req.headers["x-forwarded-proto"] || req.headers["x-forwarded-protocol"])) || "https";
      const host = (req.headers && (req.headers["x-forwarded-host"] || req.headers["host"])) || process.env.VERCEL_URL || process.env.PUBLIC_APP_URL || "stormijxo.com";
      const origin = host.startsWith("http") ? host : `${proto}://${host}`;
      const adminPath = memberId ? "/api/admin/delete-member" : "/api/admin/change-password";
      const adminBody = memberId ? { memberId } : { email, newPassword };
      const authHeader = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
      try {
        const r = await fetch(origin.replace(/\/$/, "") + adminPath, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify(adminBody),
        });
        const data = await r.json().catch(() => ({}));
        res.statusCode = r.status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(data));
        return;
      } catch (proxyErr) {
        console.error("unlock-checkout admin proxy error:", proxyErr);
        json(res, 502, { error: "Could not reach admin API. Try again or use Firebase Console." });
        return;
      }
    }
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
