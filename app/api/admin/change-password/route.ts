import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "../_lib/require-admin";

/**
 * POST { email, newPassword } — admin sets a new password for a user (by email).
 * If a Firebase Auth user exists, updates their password. If not (e.g. legacy member created
 * before Auth was in place), creates an Auth account with this password and links it to their member doc.
 */
export async function POST(req: NextRequest) {
  let authResult: Awaited<ReturnType<typeof requireAdminAuth>>;
  try {
    authResult = await requireAdminAuth(req);
  } catch (res) {
    return res as NextResponse;
  }
  const { admin } = authResult;

  let body: { email?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const auth = admin.auth();
  const db = admin.firestore();

  try {
    const userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, { password: newPassword });
    return NextResponse.json({ ok: true, message: "Password updated." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update password.";
    if (msg.includes("user-not-found") || msg.includes("no user record")) {
      // User was created before Auth was in place (legacy member). Create Auth account with this password.
      try {
        const newUser = await auth.createUser({
          email,
          password: newPassword,
          emailVerified: false,
        });
        const uid = newUser.uid;
        const membersSnap = await db
          .collection("members")
          .where("email", "==", email)
          .limit(1)
          .get();
        if (!membersSnap.empty) {
          const memberRef = membersSnap.docs[0]!.ref;
          await memberRef.set({ uid, userId: uid }, { merge: true });
        }
        await db.collection("users").doc(uid).set(
          {
            email,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return NextResponse.json({
          ok: true,
          message: "No existing sign-in was found for this email. Created an account with the password you set; they can log in now.",
        });
      } catch (createErr) {
        const createMsg = createErr instanceof Error ? createErr.message : String(createErr);
        if (createMsg.includes("email-already-exists") || createMsg.includes("already in use")) {
          return NextResponse.json(
            { error: "An account with this email already exists elsewhere. Try password reset or a different email." },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: "Could not create sign-in for this member: " + createMsg },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
