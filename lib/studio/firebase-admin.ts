/**
 * Firebase Admin for server-side API routes (Premium Studio, auth, usage).
 * Uses FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 or FIREBASE_SERVICE_ACCOUNT_JSON.
 */
import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

let app: App | null = null;

function getServiceAccount(): Record<string, unknown> | null {
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
  if (base64 && base64.trim()) {
    try {
      const json = Buffer.from(base64, "base64").toString("utf8");
      const parsed = JSON.parse(json) as Record<string, unknown>;
      if (parsed && typeof parsed.private_key === "string") {
        return {
          ...parsed,
          private_key: (parsed.private_key as string).replace(/\\n/g, "\n"),
        };
      }
    } catch {
      // ignore
    }
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed.private_key === "string") {
      return {
        ...parsed,
        private_key: (parsed.private_key as string).replace(/\\n/g, "\n"),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function getFirebaseAdmin(): { app: App; auth: Auth; db: Firestore } {
  if (app) {
    const auth = require("firebase-admin").auth(app);
    const db = require("firebase-admin").firestore(app);
    return { app, auth, db };
  }
  const credential = getServiceAccount();
  if (!credential) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 or FIREBASE_SERVICE_ACCOUNT_JSON."
    );
  }
  const admin = require("firebase-admin") as {
    initializeApp: (o: { credential: unknown }) => App;
    credential: { cert: (c: Record<string, unknown>) => unknown };
    app: (n?: string) => App;
    apps: unknown[];
  };
  if (admin.apps?.length) {
    app = admin.app() as App;
  } else {
    app = admin.initializeApp({ credential: admin.credential.cert(credential) });
  }
  const auth = require("firebase-admin").auth(app) as Auth;
  const db = require("firebase-admin").firestore(app) as Firestore;
  return { app, auth, db };
}

export async function verifyIdToken(token: string): Promise<{ uid: string; email?: string }> {
  const { auth } = getFirebaseAdmin();
  const d = await auth.verifyIdToken(token);
  return { uid: d.uid, email: (d.email || "").trim() || undefined };
}
