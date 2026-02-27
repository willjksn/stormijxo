import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "../_lib/require-admin";
import { TREATS_COLLECTION } from "../../../../lib/treats";
import { NOTIFICATIONS_COLLECTION } from "../../../../lib/notifications";

/**
 * POST { memberId } or { email }, { treatId }, { count }, optional { reason }.
 * Member doc: treatRedeems (map of treatId -> number). Creates in-app notification for the member.
 */
export async function POST(req: NextRequest) {
  let authResult: Awaited<ReturnType<typeof requireAdminAuth>>;
  try {
    authResult = await requireAdminAuth(req);
  } catch (res) {
    return res as NextResponse;
  }
  const { admin } = authResult;

  let body: { memberId?: string; email?: string; treatId?: string; count?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const treatId = typeof body.treatId === "string" ? body.treatId.trim() : "";
  const count = typeof body.count === "number" && body.count >= 1 ? body.count : 1;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;

  if (!memberId && !email) {
    return NextResponse.json({ error: "memberId or email is required." }, { status: 400 });
  }
  if (!treatId) {
    return NextResponse.json({ error: "treatId is required." }, { status: 400 });
  }

  const db = admin.firestore();
  const membersRef = db.collection("members");
  const treatsRef = db.collection(TREATS_COLLECTION);

  let memberRef: FirebaseFirestore.DocumentReference;
  let memberEmail: string | null = null;

  if (memberId) {
    memberRef = membersRef.doc(memberId);
    const snap = await memberRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    const d = snap.data() || {};
    memberEmail = (d.email ?? "").toString().trim().toLowerCase() || null;
  } else {
    const snap = await membersRef.where("email", "==", email).limit(1).get();
    if (snap.empty) {
      return NextResponse.json({ error: "No member found with this email." }, { status: 404 });
    }
    memberRef = snap.docs[0]!.ref;
    memberEmail = email;
  }

  const treatSnap = await treatsRef.doc(treatId).get();
  const treatName = treatSnap.exists ? (treatSnap.data()?.name ?? treatId).toString() : treatId;

  const data = (await memberRef.get()).data() || {};
  const existingMap = data.treatRedeems && typeof data.treatRedeems === "object" ? data.treatRedeems as Record<string, number> : {};
  const current = typeof existingMap[treatId] === "number" ? existingMap[treatId]! : 0;
  const nextForTreat = current + count;
  const treatRedeems = { ...existingMap, [treatId]: nextForTreat };

  await memberRef.set(
    {
      treatRedeems,
      lastGrantedTreatRedeemsAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(reason ? { lastGrantReason: reason } : {}),
    },
    { merge: true }
  );

  if (memberEmail) {
    const title = "Free treat redeem";
    const body = count === 1
      ? `You received 1 free redeem for "${treatName}".`
      : `You received ${count} free redeem(s) for "${treatName}".`;
    await db.collection(NOTIFICATIONS_COLLECTION).add({
      forMemberEmail: memberEmail,
      forAdmin: false,
      type: "treat_redeem_granted",
      title,
      body,
      link: "/treats",
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return NextResponse.json({
    ok: true,
    message: `${count} free redeem(s) for "${treatName}" granted.`,
    treatRedeems,
  });
}
