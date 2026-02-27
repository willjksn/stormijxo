import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "../_lib/require-admin";

/**
 * POST { email, newPassword } — admin sets a new password for a user (by email).
 * Requires Firebase Auth user to exist for that email.
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

  try {
    const userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, { password: newPassword });
    return NextResponse.json({ ok: true, message: "Password updated." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update password.";
    if (msg.includes("user-not-found") || msg.includes("no user record")) {
      return NextResponse.json(
        { error: "No Firebase Auth user found for this email. They may only exist as a member row." },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
