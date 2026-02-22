import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const TREAT_PRODUCTS: Record<string, { name: string; price: number; description: string }> = {
  "voice-30": {
    name: "30-Second Voice Note",
    price: 2500,
    description: "I'll say your name. Keep it short. Keep it personal.",
  },
  "voice-60": {
    name: "60-Second Voice Note",
    price: 4500,
    description: "More direct. Slightly longer. Still chill.",
  },
  "video-reply": {
    name: "Private Video Reply",
    price: 3500,
    description: "Ask me something. I'll respond privately.",
  },
  birthday: {
    name: "Birthday Message",
    price: 5000,
    description: "Custom video. Don't make it weird.",
  },
  overthinking: {
    name: "Overthinking Response",
    price: 3000,
    description: "Tell me what's stuck in your head. I'll answer.",
  },
  "check-in": {
    name: "Random Check-In",
    price: 2000,
    description: "A short message from me when you least expect it.",
  },
};

export async function POST(req: NextRequest) {
  const stripeSecret =
    process.env.Stripe_Secret_key ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET;

  if (!stripeSecret) {
    return NextResponse.json(
      { error: "Stripe secret is not configured" },
      { status: 500 }
    );
  }

  let body: { treatId?: string; base_url?: string; success_url?: string; cancel_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const treatId = typeof body.treatId === "string" ? body.treatId.trim() : "";
  const product = treatId ? TREAT_PRODUCTS[treatId] : null;

  if (!product) {
    return NextResponse.json(
      { error: "Invalid treat. Choose from: voice-30, voice-60, video-reply, birthday, overthinking, check-in." },
      { status: 400 }
    );
  }

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
            unit_amount: product.price,
            product_data: {
              name: product.name,
              description: product.description,
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

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("treat-checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout session failed" },
      { status: 500 }
    );
  }
}
