/**
 * Verify admin auth for Premium Studio API routes.
 * Expects Authorization: Bearer <Firebase ID token>.
 */
import { NextResponse } from "next/server";
import { getFirebaseAdmin, verifyIdToken } from "./firebase-admin";
import { ALLOWED_ADMIN_EMAILS } from "../auth-redirect";

export async function verifyAuth(
  authHeader: string | null
): Promise<
  | { ok: true; uid: string; email: string | null }
  | { ok: false; response: NextResponse }
> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Missing auth token." }, { status: 401 }) };
  }
  let decoded: { uid: string; email?: string };
  try {
    decoded = await verifyIdToken(token);
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid or expired token." }, { status: 401 }) };
  }
  const email = (decoded.email ?? "").trim().toLowerCase() || "";
  if (ALLOWED_ADMIN_EMAILS.includes(email)) {
    return { ok: true, uid: decoded.uid, email: decoded.email ?? null };
  }
  const { db } = getFirebaseAdmin();
  const snap = await db.collection("admin_users").where("email", "==", decoded.email ?? "").where("role", "==", "admin").limit(1).get();
  if (snap.empty) {
    return { ok: false, response: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }
  return { ok: true, uid: decoded.uid, email: decoded.email ?? null };
}

/** Verify any authenticated user (for caption generation and other studio features). No admin check. */
export async function verifyAuthForStudio(
  authHeader: string | null
): Promise<
  | { ok: true; uid: string; email: string | null }
  | { ok: false; response: NextResponse }
> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[verifyAuthForStudio] 401: missing or empty Authorization header");
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthorized", message: "Missing auth token.", details: { field: "Authorization" } },
        { status: 401 }
      ),
    };
  }
  try {
    const decoded = await verifyIdToken(token);
    return { ok: true, uid: decoded.uid, email: (decoded.email ?? "").trim() || null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV !== "test") {
      console.warn("[verifyAuthForStudio] 401: token verification failed:", message);
    }
    const isCredentialError = /credentials|service.account|FIREBASE_SERVICE_ACCOUNT/i.test(message);
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "unauthorized",
          message: isCredentialError
            ? "Server auth not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 or FIREBASE_SERVICE_ACCOUNT_JSON."
            : "Invalid or expired token. Sign in again, or check Firebase Admin is configured for the same project.",
          details: {},
        },
        { status: 401 }
      ),
    };
  }
}
