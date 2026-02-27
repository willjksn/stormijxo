/**
 * Subscription checkout — same behavior as app/api/subscription-checkout/route.ts.
 * Creates a Stripe Checkout Session for monthly membership (no amount validation).
 * Ensures /api/subscription-checkout is never handled by tip-checkout on Vercel.
 */
const Stripe = require("stripe");

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
  const priceId =
    process.env.STRIPE_PRICE_ID_MONTHLY ||
    process.env.STRIPE_SUBSCRIPTION_PRICE_ID;

  if (!stripeSecret) {
    json(res, 500, { error: "Stripe is not configured" });
    return;
  }
  if (!priceId || !String(priceId).startsWith("price_")) {
    json(res, 500, {
      error:
        "Stripe subscription price not configured. Set STRIPE_PRICE_ID_MONTHLY (or STRIPE_SUBSCRIPTION_PRICE_ID) to your recurring price ID.",
    });
    return;
  }

  const body = parseBody(req);
  const baseUrl = process.env.PUBLIC_APP_URL || "https://stormijxo.com";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const successUrl = body.success_url || `${normalizedBase}/success`;
  const cancelUrl = body.cancel_url || `${normalizedBase}/#pricing`;
  const customerEmail =
    typeof body.customer_email === "string" ? body.customer_email.trim() : undefined;
  const uid = typeof body.uid === "string" ? body.uid.trim() : undefined;

  const metadata = { source: "stormij_web" };
  if (uid) metadata.uid = uid;

  try {
    const stripe = new Stripe(stripeSecret);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ quantity: 1, price: priceId }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail || undefined,
      metadata,
      subscription_data: { metadata },
    });
    json(res, 200, { url: session.url });
  } catch (err) {
    console.error("subscription-checkout error:", err);
    json(res, 500, {
      error: err && err.message ? err.message : "Checkout failed",
    });
  }
};
