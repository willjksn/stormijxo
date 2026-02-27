import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "../_lib/require-admin";

/**
 * POST { memberId } — admin deletes a member.
 * If the member has a Firebase Auth account (uid on the doc), deletes that too so they lose app access.
 * Then deletes the member doc (and users/{uid} if present).
 */
export async function POST(req: NextRequest) {
  let authResult: Awaited<ReturnType<typeof requireAdminAuth>>;
  try {
    authResult = await requireAdminAuth(req);
  } catch (res) {
    return res as NextResponse;
  }
  const { admin } = authResult;

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

  const auth = admin.auth();
  const db = admin.firestore();

  try {
    const memberRef = db.collection("members").doc(memberId);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const data = memberSnap.data();
    const uid = (data?.uid ?? data?.userId ?? "").toString().trim();

    if (uid) {
      try {
        await auth.deleteUser(uid);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("user-not-found") && !msg.includes("no user record")) {
          return NextResponse.json(
            { error: "Could not remove Auth user: " + msg },
            { status: 500 }
          );
        }
      }
      const userRef = db.collection("users").doc(uid);
      await userRef.delete().catch(() => {});
    }

    await memberRef.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete member.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
