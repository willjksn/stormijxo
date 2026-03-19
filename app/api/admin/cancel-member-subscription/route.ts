import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdminAuthResult } from "../_lib/require-admin";

/**
 * POST { memberId } — cancel a member's subscription in Stripe at period end and update Firestore.
 * Member keeps access until the end of the current billing period; no refund.
 * If the member has no Stripe subscription, marks them cancelled with no access.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuthResult(req);
  if (!auth.ok) return auth.response;
  const { admin } = auth.value;

  let body: { memberId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  if (!memberId) {
    return NextResponse.json({ error: "memberId is required." }, { status: 400 });
  }

  const db = admin.firestore();
  const memberRef = db.collection("members").doc(memberId);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const data = memberSnap.data() || {};
  const subscriptionId = (data.stripeSubscriptionId ?? data.stripe_subscription_id ?? "").toString().trim();

  let accessEndsAt: Date | null = null;

  if (subscriptionId) {
    const stripeSecret =
      process.env.Stripe_Secret_key ||
      process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET;
    if (!stripeSecret) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
    }
    const stripe = new Stripe(stripeSecret);
    try {
      const sub = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      const raw = sub as unknown as { current_period_end?: number };
      const periodEnd = typeof raw.current_period_end === "number" ? raw.current_period_end : null;
      if (periodEnd) {
        accessEndsAt = new Date(periodEnd * 1000);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Stripe request failed.";
      const isMissingOrCanceled =
        /No such subscription/i.test(errMsg) ||
        /already been canceled/i.test(errMsg) ||
        /canceled subscription/i.test(errMsg);
      if (isMissingOrCanceled) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const raw = sub as unknown as {
            current_period_end?: number;
            ended_at?: number;
            canceled_at?: number;
            status?: string;
          };
          const sec =
            typeof raw.current_period_end === "number"
              ? raw.current_period_end
              : typeof raw.ended_at === "number"
                ? raw.ended_at
                : typeof raw.canceled_at === "number"
                  ? raw.canceled_at
                  : null;
          if (sec) accessEndsAt = new Date(sec * 1000);
        } catch {
          // Subscription may be fully removed from Stripe; still sync Firestore as cancelled.
        }
      } else {
        return NextResponse.json({ error: "Could not cancel subscription in Stripe: " + errMsg }, { status: 502 });
      }
    }
  }

  await memberRef.update({
    status: "cancelled",
    cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    access_ends_at: accessEndsAt
      ? admin.firestore.Timestamp.fromMillis(accessEndsAt.getTime())
      : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    ok: true,
    message: accessEndsAt
      ? `Subscription will cancel at end of billing period. Member has access until ${accessEndsAt.toISOString().slice(0, 10)}.`
      : "Member marked cancelled (no Stripe subscription).",
    accessEndsAt: accessEndsAt ? accessEndsAt.toISOString() : null,
  });
}
