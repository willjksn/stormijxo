/**
 * Subscription checkout for the public landing page - no login required.
 * User enters email at Stripe checkout. Separate route to avoid routing confusion.
 */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const stripeSecret =
    process.env.Stripe_Secret_key ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET;

  const priceId =
    process.env.STRIPE_PRICE_ID_MONTHLY ||
    process.env.STRIPE_SUBSCRIPTION_PRICE_ID;

  if (!stripeSecret) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }

  if (!priceId || !priceId.startsWith("price_")) {
    return NextResponse.json(
      { error: "Stripe subscription price not configured." },
      { status: 500 }
    );
  }

  let body: {
    success_url?: string;
    cancel_url?: string;
    base_url?: string;
    customer_email?: string;
    uid?: string;
  } = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed;
  } catch {
    // Empty or invalid body is OK - we use defaults
  }

  const baseUrl = body.base_url || process.env.PUBLIC_APP_URL || "https://stormijxo.com";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const successUrl = body.success_url || `${normalizedBase}/success`;
  const cancelUrl = body.cancel_url || `${normalizedBase}/#pricing`;
  const customerEmail =
    typeof body.customer_email === "string" ? body.customer_email.trim() : undefined;
  const uid = typeof body.uid === "string" ? body.uid.trim() : undefined;

  const metadata: Record<string, string> = { source: "stormij_web", landing: "1" };
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

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("landing-subscription error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
