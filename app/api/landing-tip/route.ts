/**
 * Tip checkout for the public landing page - no login or subscription required.
 * Separate from /api/tip-checkout to avoid any routing confusion with unlock-checkout.
 */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const stripeSecret =
    process.env.Stripe_Secret_key ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET;

  if (!stripeSecret) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }

  let body: {
    amountCents?: number | string;
    amount?: number | string;
    instagram_handle?: string;
    base_url?: string;
    success_url?: string;
    cancel_url?: string;
  };
  try {
    body = await req.json();
  } catch (e) {
    console.error("landing-tip 400: JSON parse failed", e);
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawAmount = body.amountCents ?? body.amount;
  const parsedAmount =
    typeof rawAmount === "number"
      ? Math.round(rawAmount)
      : typeof rawAmount === "string"
        ? parseInt(rawAmount, 10)
        : NaN;
  const amountCents = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 100000) {
    console.error("landing-tip 400: invalid amount", { rawAmount, parsedAmount, amountCents, bodyKeys: Object.keys(body || {}) });
    return NextResponse.json(
      { error: "Amount must be between $1 and $1000. Please select a preset or enter a valid amount." },
      { status: 400 }
    );
  }

  const baseUrl = body.base_url || process.env.PUBLIC_APP_URL || "https://stormijxo.com";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const successUrl = body.success_url || `${normalizedBase}/success?tip=1`;
  const cancelUrl = body.cancel_url || normalizedBase;
  const instagramHandle =
    typeof body.instagram_handle === "string" ? body.instagram_handle.trim().slice(0, 64) : "";

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
              description: "One-time tip - no subscription",
              metadata: { type: "tip", source: "landing" },
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: "tip",
        tip_post_id: "",
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

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("landing-tip error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
