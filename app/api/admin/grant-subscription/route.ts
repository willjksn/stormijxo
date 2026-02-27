import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "../_lib/require-admin";

/**
 * POST { memberId } or { email } — grant one free month of subscription (extend accessEndsAt by 1 month).
 */
export async function POST(req: NextRequest) {
  let authResult: Awaited<ReturnType<typeof requireAdminAuth>>;
  try {
    authResult = await requireAdminAuth(req);
  } catch (res) {
    return res as NextResponse;
  }
  const { admin } = authResult;

  let body: { memberId?: string; email?: string; months?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const months = typeof body.months === "number" && body.months >= 1 ? Math.min(body.months, 24) : 1;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;

  if (!memberId && !email) {
    return NextResponse.json({ error: "memberId or email is required." }, { status: 400 });
  }

  const db = admin.firestore();
  const membersRef = db.collection("members");

  let memberRef: FirebaseFirestore.DocumentReference;
  if (memberId) {
    memberRef = membersRef.doc(memberId);
    const snap = await memberRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
  } else {
    const snap = await membersRef.where("email", "==", email).limit(1).get();
    if (snap.empty) {
      return NextResponse.json({ error: "No member found with this email." }, { status: 404 });
    }
    memberRef = snap.docs[0]!.ref;
  }

  const data = (await memberRef.get()).data() || {};
  const existingEnd = data.accessEndsAt?.toDate?.() ?? data.access_ends_at?.toDate?.() ?? null;
  const now = new Date();
  const base = existingEnd && existingEnd > now ? existingEnd : now;
  const nextEnd = new Date(base);
  for (let i = 0; i < months; i++) nextEnd.setMonth(nextEnd.getMonth() + 1);

  await memberRef.set(
    {
      accessEndsAt: nextEnd,
      access_ends_at: nextEnd,
      status: "active",
      grantedFreeMonthAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(reason ? { lastGrantReason: reason } : {}),
    },
    { merge: true }
  );

  return NextResponse.json({
    ok: true,
    message: months === 1 ? "One free month granted." : `${months} free months granted.`,
    accessEndsAt: nextEnd.toISOString(),
  });
}
