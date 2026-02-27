import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "../_lib/require-admin";

/**
 * GET — Verifies admin auth and ensures allowlist admins have an admin_users doc
 * (so Firestore rules allow them to read users/members in the client).
 * Call once when loading the admin panel to avoid "permission-denied" on snapshot listeners.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminAuth(req);
    return NextResponse.json({ ok: true });
  } catch (res) {
    return res as NextResponse;
  }
}
