const Stripe = require("stripe");

const MIN_TIP_CENTS = 100;
const MAX_TIP_CENTS = 100000;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  const requestPath = ((req && req.url) || "").toString().toLowerCase();

  // Production safety net: if Vercel misroutes API paths to this file,
  // forward to the intended handler instead of returning tip validation errors.
  if (requestPath.includes("customer-portal")) {
    const customerPortalHandler = require("./customer-portal");
    return customerPortalHandler(req, res);
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

  const body = req.body || {};
  const isSubscriptionIntent =
    body.checkoutType === "subscription" ||
    (typeof req.url === "string" && req.url.includes("subscription-checkout"));

  if (isSubscriptionIntent) {
    const priceId =
      process.env.STRIPE_PRICE_ID_MONTHLY ||
      process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
    if (!priceId || !String(priceId).startsWith("price_")) {
      json(res, 500, {
        error:
          "Stripe subscription price not configured. Set STRIPE_PRICE_ID_MONTHLY (or STRIPE_SUBSCRIPTION_PRICE_ID).",
      });
      return;
    }

    const baseUrl = body.base_url || process.env.PUBLIC_APP_URL || "https://stormijxo.com";
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
      return;
    } catch (err) {
      console.error("subscription-checkout fallback error:", err);
      json(res, 500, { error: err && err.message ? err.message : "Checkout failed" });
      return;
    }
  }

  const rawAmount =
    body.amountCents != null
      ? body.amountCents
      : body.amount;
  const amountCents = Number.isInteger(rawAmount) ? rawAmount : parseInt(rawAmount, 10);
  if (!Number.isInteger(amountCents) || amountCents < MIN_TIP_CENTS || amountCents > MAX_TIP_CENTS) {
    json(res, 400, { error: "Amount must be between 100 and 100000 cents ($1-$1000)." });
    return;
  }

  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  const instagramHandle = typeof body.instagram_handle === "string"
    ? body.instagram_handle.trim().slice(0, 64)
    : "";

  const baseUrl = body.base_url || process.env.PUBLIC_APP_URL || "https://stormijxo.com";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const successUrl = body.success_url || `${normalizedBase}/success?tip=1`;
  const cancelUrl = body.cancel_url || `${normalizedBase}/`;

  try {
    const stripe = new Stripe(stripeSecret);
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
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: "tip",
        tip_post_id: postId || "",
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

    json(res, 200, { url: session.url });
  } catch (err) {
    console.error("tip-checkout error:", err);
    json(res, 500, { error: err && err.message ? err.message : "Checkout session failed" });
  }
};
