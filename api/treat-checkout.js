/**
 * Treat checkout — same behavior as app/api/treat-checkout/route.ts.
 * Ensures /api/treat-checkout is never handled by unlock-checkout on Vercel misroutes.
 */
const Stripe = require("stripe");
const { getFirebaseAdmin } = require("./_lib/firebase-admin");

const TREATS_COLLECTION = "treats";

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

  if (!stripeSecret) {
    json(res, 500, { error: "Stripe secret is not configured" });
    return;
  }

  const body = parseBody(req);
  const treatId = typeof body.treatId === "string" ? body.treatId.trim() : "";
  if (!treatId) {
    json(res, 400, { error: "Missing treatId." });
    return;
  }

  let treatDoc = null;
  try {
    const admin = getFirebaseAdmin();
    const snap = await admin.firestore().collection(TREATS_COLLECTION).doc(treatId).get();
    if (snap.exists) {
      const d = snap.data() || {};
      treatDoc = {
        name: (d.name ?? "").toString(),
        price: typeof d.price === "number" ? d.price : 0,
        description: (d.description ?? "").toString(),
        quantityLeft: typeof d.quantityLeft === "number" ? d.quantityLeft : 0,
      };
    }
  } catch (err) {
    console.error("treat-checkout Firestore read error:", err);
    json(res, 500, { error: "Could not load treat. Try again later." });
    return;
  }

  if (!treatDoc || treatDoc.quantityLeft <= 0) {
    json(res, 400, { error: "This treat is not available or sold out." });
    return;
  }

  const priceCents = Math.round(treatDoc.price * 100);
  const baseUrl = body.base_url || process.env.PUBLIC_APP_URL || "https://stormijxo.com";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const successUrl = body.success_url || `${normalizedBase}/success`;
  const cancelUrl = body.cancel_url || `${normalizedBase}/treats`;

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
              name: treatDoc.name,
              description: treatDoc.description,
              metadata: { treatId },
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: "treat",
        treatId,
      },
    });

    json(res, 200, { url: session.url });
  } catch (err) {
    console.error("treat-checkout error:", err);
    json(res, 500, {
      error: err && err.message ? err.message : "Checkout session failed",
    });
  }
};
