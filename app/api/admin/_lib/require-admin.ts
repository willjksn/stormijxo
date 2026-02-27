/**
 * Server-side admin check for API routes. Verifies Bearer token and ensures user is admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { ALLOWED_ADMIN_EMAILS } from "../../../../lib/auth-redirect";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getFirebaseAdmin } = require("../../../../api/_lib/firebase-admin");

type DecodedToken = { uid: string; email?: string };

export async function requireAdminAuth(
  req: NextRequest
): Promise<{ decoded: DecodedToken; admin: ReturnType<typeof getFirebaseAdmin> }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    throw NextResponse.json({ error: "Missing auth token." }, { status: 401 });
  }

  const admin = getFirebaseAdmin();
  const auth = admin.auth();
  const db = admin.firestore();

  let decoded: { uid: string; email?: string };
  try {
    const d = await auth.verifyIdToken(token);
    decoded = { uid: d.uid, email: (d.email || "").trim() || undefined };
  } catch {
    throw NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  const email = (decoded.email || "").toLowerCase();
  if (ALLOWED_ADMIN_EMAILS.includes(email)) {
    await db.collection("admin_users").doc(decoded.uid).set(
      { email: decoded.email || email, role: "admin" },
      { merge: true }
    );
    return { decoded, admin };
  }

  const adminUsersSnap = await db
    .collection("admin_users")
    .where("email", "==", decoded.email || "")
    .where("role", "==", "admin")
    .limit(1)
    .get();

  if (adminUsersSnap.empty) {
    throw NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  return { decoded, admin };
}
