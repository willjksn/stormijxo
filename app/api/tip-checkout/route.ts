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

  let body: { amountCents?: number; postId?: string; instagram_handle?: string; base_url?: string; success_url?: string; cancel_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amountCents = typeof body.amountCents === "number" ? Math.round(body.amountCents) : 0;
  if (amountCents < 100) {
    return NextResponse.json(
      { error: "Minimum tip is $1.00" },
      { status: 400 }
    );
  }

  const baseUrl = body.base_url || process.env.PUBLIC_APP_URL || "https://stormijxo.com";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const successUrl = body.success_url || `${normalizedBase}/success`;
  const cancelUrl = body.cancel_url || `${normalizedBase}/tip`;
  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
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
              name: "Tip",
              description: "Show your support",
              metadata: { type: "tip" },
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

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("tip-checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
