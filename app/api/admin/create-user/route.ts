import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "../_lib/require-admin";

/**
 * POST { email, password } — admin creates a Firebase Auth user (bypasses Stripe).
 * Use after creating a member doc so the user can log in and show up in Messages.
 */
export async function POST(req: NextRequest) {
  let authResult: Awaited<ReturnType<typeof requireAdminAuth>>;
  try {
    authResult = await requireAdminAuth(req);
  } catch (res) {
    return res as NextResponse;
  }
  const { admin } = authResult;

  let body: { email?: string; password?: string; memberId?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";
  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : null;

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const auth = admin.auth();
  const db = admin.firestore();

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: false,
    });
    const uid = userRecord.uid;

    if (memberId) {
      const memberRef = db.collection("members").doc(memberId);
      await memberRef.set({ uid, userId: uid }, { merge: true });
    }

    await db.collection("users").doc(uid).set(
      {
        email,
        displayName: displayName || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      message: "User created. They can log in and will appear in Messages.",
      uid,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create user.";
    if (msg.includes("email-already-exists") || msg.includes("already in use")) {
      return NextResponse.json(
        { error: "An account with this email already exists. They can log in or use password reset." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
