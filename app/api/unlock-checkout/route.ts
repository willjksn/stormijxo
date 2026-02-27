import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { POST as tipCheckoutPost } from "../tip-checkout/route";

type UnlockConfig = {
  enabled?: boolean;
  priceCents?: number;
};

function getFirebaseAdmin(): ReturnType<typeof import("firebase-admin").initializeApp> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getFirebaseAdmin: getAdmin } = require("../../../api/_lib/firebase-admin");
  return getAdmin();
}

export async function POST(req: NextRequest) {
  const tipForwardReq = req.clone();
  const stripeSecret =
    process.env.Stripe_Secret_key ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET;

  if (!stripeSecret) {
    return NextResponse.json({ error: "Stripe secret is not configured" }, { status: 500 });
  }

  let body: {
    checkoutType?: string;
    amountCents?: number | string;
    amount?: number | string;
    postId?: string;
    uid?: string;
    customer_email?: string;
    base_url?: string;
    success_url?: string;
    cancel_url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Safety net: if a tip checkout request is misrouted here, forward it.
  const checkoutHeader = (req.headers.get("x-checkout-type") || "").trim().toLowerCase();
  const hasTipAmount =
    body.amountCents !== undefined || body.amount !== undefined;
  if (body.checkoutType === "tip" || checkoutHeader === "tip" || hasTipAmount) {
    return tipCheckoutPost(tipForwardReq as unknown as NextRequest);
  }

  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  // If request looks like admin user management (wrong endpoint), forward to correct handler.
  if (!postId || !uid) {
    const memberId = typeof (body as { memberId?: string }).memberId === "string"
      ? (body as { memberId?: string }).memberId.trim()
      : "";
    const email = typeof (body as { email?: string }).email === "string"
      ? (body as { email?: string }).email.trim()
      : "";
    const newPassword = typeof (body as { newPassword?: string }).newPassword === "string"
      ? (body as { newPassword?: string }).newPassword
      : "";
    if (memberId) {
      const { POST: deleteMemberPost } = await import("../admin/delete-member/route");
      return deleteMemberPost(req);
    }
    if (email && newPassword) {
      const { POST: changePasswordPost } = await import("../admin/change-password/route");
      return changePasswordPost(req);
    }
    return NextResponse.json({ error: "Missing postId or uid." }, { status: 400 });
  }

  let priceCents = 0;
  try {
    const admin = getFirebaseAdmin();
    const snap = await admin.firestore().collection("posts").doc(postId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }
    const d = snap.data() as { lockedContent?: UnlockConfig };
    const locked = d?.lockedContent;
    if (!locked?.enabled) {
      return NextResponse.json({ error: "This post is not locked." }, { status: 400 });
    }
    priceCents = typeof locked.priceCents === "number" ? Math.round(locked.priceCents) : 0;
    if (priceCents < 100 || priceCents > 100000) {
      return NextResponse.json({ error: "Invalid unlock price." }, { status: 400 });
    }
  } catch (err) {
    console.error("unlock-checkout Firestore read error:", err);
    return NextResponse.json({ error: "Could not load unlock settings." }, { status: 500 });
  }

  const baseUrl = body.base_url || process.env.PUBLIC_APP_URL || "https://stormijxo.com";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const successUrl = body.success_url || `${normalizedBase}/post/${encodeURIComponent(postId)}?unlocked=1`;
  const cancelUrl = body.cancel_url || `${normalizedBase}/post/${encodeURIComponent(postId)}`;
  const customerEmail =
    typeof body.customer_email === "string" ? body.customer_email.trim() : undefined;

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
              name: "Unlock Post",
              description: "Unlock this post's full media set",
              metadata: { type: "unlock_post", postId },
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail || undefined,
      metadata: {
        type: "unlock_post",
        unlock_post_id: postId,
        unlock_uid: uid,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("unlock-checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout session failed" },
      { status: 500 }
    );
  }
}
