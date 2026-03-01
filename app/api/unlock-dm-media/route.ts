import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const stripeSecret =
    process.env.Stripe_Secret_key ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET;

  if (!stripeSecret) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  let body: {
    conversationId?: string;
    messageId?: string;
    unlockId?: string;
    uid?: string;
    priceCents?: number | string;
    base_url?: string;
    success_url?: string;
    cancel_url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
  const unlockId = typeof body.unlockId === "string" ? body.unlockId.trim() : "";
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  const priceCents =
    typeof body.priceCents === "number"
      ? Math.round(body.priceCents)
      : typeof body.priceCents === "string"
        ? parseInt(body.priceCents, 10)
        : 0;

  if (!conversationId || !messageId || !unlockId || !uid) {
    return NextResponse.json(
      { error: "Missing conversationId, messageId, unlockId, or uid." },
      { status: 400 }
    );
  }
  if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 50000) {
    return NextResponse.json(
      { error: "Price must be between 100 and 50000 cents ($1–$500)." },
      { status: 400 }
    );
  }

  const baseUrl = body.base_url || process.env.PUBLIC_APP_URL || "https://stormijxo.com";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const successUrl = body.success_url || `${normalizedBase}/chat-session?unlocked=1`;
  const cancelUrl = body.cancel_url || `${normalizedBase}/chat-session`;

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
              name: "Unlock media",
              description: "Pay to unlock this content",
              metadata: {
                type: "unlock_dm_media",
                conversationId,
                messageId,
                unlockId,
                uid,
              },
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: "unlock_dm_media",
        conversationId,
        messageId,
        unlockId,
        uid,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("unlock-dm-media error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
