const Stripe = require("stripe");

const MIN_TIP_CENTS = 100;
const MAX_TIP_CENTS = 100000;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
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
  if (!stripeSecret) {
    json(res, 500, { error: "Stripe secret is not configured" });
    return;
  }

  const body = req.body || {};
  const amountCents = Number.isInteger(body.amount) ? body.amount : parseInt(body.amount, 10);
  if (!Number.isInteger(amountCents) || amountCents < MIN_TIP_CENTS || amountCents > MAX_TIP_CENTS) {
    json(res, 400, { error: "Amount must be between 100 and 100000 cents ($1-$1000)." });
    return;
  }

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
