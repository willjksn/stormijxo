import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "../_lib/require-admin";

/**
 * GET/POST — Verifies admin auth and ensures allowlist admins have an admin_users doc
 * (so Firestore rules allow them to read users/members in the client).
 * Call once when loading the admin panel to avoid "permission-denied" on snapshot listeners.
 * POST is preferred by the client to avoid caching/405 on some hosts.
 * OPTIONS — Allow CORS preflight.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "GET, POST, OPTIONS" } });
}

async function handleEnsure(req: NextRequest) {
  try {
    await requireAdminAuth(req);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : "Failed to ensure admin doc.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleEnsure(req);
}

export async function POST(req: NextRequest) {
  return handleEnsure(req);
}
