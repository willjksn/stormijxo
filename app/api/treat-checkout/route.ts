import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { TREATS_COLLECTION } from "../../../lib/treats";

// Firebase Admin (CJS) for server-side Firestore read
function getFirebaseAdmin(): ReturnType<typeof import("firebase-admin").initializeApp> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getFirebaseAdmin: getAdmin } = require("../../../api/_lib/firebase-admin");
  return getAdmin();
}

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
  if (!treatId) {
    return NextResponse.json({ error: "Missing treatId." }, { status: 400 });
  }

  let treatDoc: { name: string; price: number; description: string; quantityLeft: number } | null = null;
  try {
    const admin = getFirebaseAdmin();
    const snap = await admin.firestore().collection(TREATS_COLLECTION).doc(treatId).get();
    if (snap.exists) {
      const d = snap.data();
      treatDoc = {
        name: (d?.name ?? "").toString(),
        price: typeof d?.price === "number" ? d.price : 0,
        description: (d?.description ?? "").toString(),
        quantityLeft: typeof d?.quantityLeft === "number" ? d.quantityLeft : 0,
      };
    }
  } catch (err) {
    console.error("treat-checkout Firestore read error:", err);
    return NextResponse.json(
      { error: "Could not load treat. Try again later." },
      { status: 500 }
    );
  }

  if (!treatDoc || treatDoc.quantityLeft <= 0) {
    return NextResponse.json(
      { error: "This treat is not available or sold out." },
      { status: 400 }
    );
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

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("treat-checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout session failed" },
      { status: 500 }
    );
  }
}
