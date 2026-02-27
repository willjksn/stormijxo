import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "../_lib/require-admin";

/**
 * POST { memberId } — ensures the member has a Firebase Auth account.
 * If the member doc has no uid, creates an Auth user (random temp password), links the member doc,
 * creates users/{uid}. Admin can then use "Send password reset email" so they set their own password.
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

  const db = admin.firestore();
  const auth = admin.auth();

  const memberRef = db.collection("members").doc(memberId);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const data = memberSnap.data();
  const uid = (data?.uid ?? data?.userId ?? "").toString().trim();
  const email = (data?.email ?? "").toString().trim();

  if (uid) {
    return NextResponse.json({
      ok: true,
      created: false,
      message: "Member already has a sign-in account.",
    });
  }

  if (!email) {
    return NextResponse.json(
      { error: "Member has no email; cannot create sign-in." },
      { status: 400 }
    );
  }

  const tempPassword = generateTempPassword();
  try {
    const newUser = await auth.createUser({
      email,
      password: tempPassword,
      emailVerified: false,
    });
    const newUid = newUser.uid;

    await memberRef.set({ uid: newUid, userId: newUid }, { merge: true });
    await db.collection("users").doc(newUid).set(
      {
        email,
        displayName: data?.displayName ?? null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      created: true,
      message:
        "Sign-in account created. Use “Send password reset email” in this panel so they can set their password.",
      uid: newUid,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("email-already-exists") || msg.includes("already in use")) {
      try {
        const userRecord = await auth.getUserByEmail(email);
        const existingUid = userRecord.uid;
        await memberRef.set({ uid: existingUid, userId: existingUid }, { merge: true });
        await db.collection("users").doc(existingUid).set(
          { email, displayName: data?.displayName ?? null },
          { merge: true }
        );
        return NextResponse.json({
          ok: true,
          created: false,
          message: "This email already has a sign-in; member record has been linked.",
        });
      } catch {
        return NextResponse.json(
          { error: "An account with this email already exists. Member could not be linked." },
          { status: 409 }
        );
      }
    }
    return NextResponse.json(
      { error: "Could not create sign-in: " + msg },
      { status: 500 }
    );
  }
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 16; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s + "!a1";
}
