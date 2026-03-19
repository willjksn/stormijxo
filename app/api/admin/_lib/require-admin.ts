/**
 * Server-side admin check for API routes. Verifies Bearer token and ensures user is admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { ALLOWED_ADMIN_EMAILS } from "../../../../lib/auth-redirect";
import { getFirebaseAdmin } from "../../../../lib/firebase-admin";

type DecodedToken = { uid: string; email?: string };

export type AdminAuthSuccess = {
  decoded: DecodedToken;
  admin: ReturnType<typeof getFirebaseAdmin>;
};

/** Prefer this in routes that should `return` errors instead of throwing a Response (avoids odd proxy status codes). */
export async function requireAdminAuthResult(
  req: NextRequest
): Promise<{ ok: true; value: AdminAuthSuccess } | { ok: false; response: NextResponse }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Missing auth token." }, { status: 401 }) };
  }

  let admin: ReturnType<typeof getFirebaseAdmin>;
  try {
    admin = getFirebaseAdmin();
  } catch (e) {
    console.error("requireAdminAuth: Firebase Admin init failed:", e);
    return {
      ok: false,
      response: NextResponse.json({ error: "Server configuration error (Firebase Admin)." }, { status: 500 }),
    };
  }

  const auth = admin.auth();
  const db = admin.firestore();

  let decoded: { uid: string; email?: string };
  try {
    const d = await auth.verifyIdToken(token);
    decoded = { uid: d.uid, email: (d.email || "").trim() || undefined };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid or expired token." }, { status: 401 }) };
  }

  const emailNorm = (decoded.email || "").trim().toLowerCase();
  if (!emailNorm) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin access requires an email on your Firebase account." },
        { status: 403 }
      ),
    };
  }

  if (ALLOWED_ADMIN_EMAILS.includes(emailNorm)) {
    await db.collection("admin_users").doc(decoded.uid).set(
      { email: decoded.email || emailNorm, role: "admin" },
      { merge: true }
    );
    return { ok: true, value: { decoded, admin } };
  }

  const adminUsersSnap = await db
    .collection("admin_users")
    .where("email", "==", emailNorm)
    .where("role", "==", "admin")
    .limit(1)
    .get();

  if (adminUsersSnap.empty) {
    return { ok: false, response: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  return { ok: true, value: { decoded, admin } };
}

export async function requireAdminAuth(req: NextRequest): Promise<AdminAuthSuccess> {
  const r = await requireAdminAuthResult(req);
  if (!r.ok) throw r.response;
  return r.value;
}
