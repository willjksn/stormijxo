/**
 * Firebase Admin for server-side API routes (Premium Studio, auth, usage).
 * Uses (in order): FIREBASE_SERVICE_ACCOUNT_JSON_PATH (file), FIREBASE_SERVICE_ACCOUNT_KEY_BASE64,
 * FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
 */
import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

let app: App | null = null;

function parseCredential(parsed: Record<string, unknown>): Record<string, unknown> | null {
  if (parsed && typeof parsed.private_key === "string") {
    return {
      ...parsed,
      private_key: (parsed.private_key as string).replace(/\\n/g, "\n"),
    };
  }
  return null;
}

function getServiceAccount(): Record<string, unknown> | null {
  const jsonPath = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON_PATH || "").trim();
  if (jsonPath) {
    try {
      const fullPath = resolve(process.cwd(), jsonPath);
      const raw = readFileSync(fullPath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const out = parseCredential(parsed);
      if (out) return out;
    } catch (e) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_JSON_PATH read failed:", e instanceof Error ? e.message : e);
      }
    }
  }
  const base64Raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
  const base64 = typeof base64Raw === "string" ? base64Raw.replace(/\s/g, "").trim() : "";
  if (base64.length > 0) {
    try {
      const json = Buffer.from(base64, "base64").toString("utf8");
      const parsed = JSON.parse(json) as Record<string, unknown>;
      const out = parseCredential(parsed);
      if (out) return out;
    } catch {
      // ignore
    }
  }
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (raw.length > 0) {
    try {
      let toParse = raw;
      if (toParse.startsWith('"') && toParse.endsWith('"')) {
        try {
          toParse = JSON.parse(toParse) as string;
        } catch {
          toParse = raw.slice(1, -1).replace(/\\"/g, '"');
        }
      }
      const parsed = JSON.parse(toParse) as Record<string, unknown>;
      const out = parseCredential(parsed);
      if (out) return out;
      if (process.env.NODE_ENV !== "test") {
        console.warn("[Firebase Admin] JSON loaded but missing or invalid 'private_key' field.");
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[Firebase Admin] Failed to parse service account JSON:", e instanceof Error ? e.message : "parse error");
      }
    }
  }
  const projectId = (process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  let privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").trim();
  if (projectId && clientEmail && privateKey) {
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1).replace(/\\n/g, "\n");
    } else {
      privateKey = privateKey.replace(/\\n/g, "\n");
    }
    if (privateKey.includes("BEGIN PRIVATE KEY")) {
      return {
        type: "service_account",
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey,
      } as Record<string, unknown>;
    }
  }
  return null;
}

function logCredentialDiagnostic(): void {
  if (process.env.NODE_ENV === "test") return;
  const hasPath = !!(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_PATH ?? "").trim();
  const hasBase64 = !!(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 ?? "").trim();
  const hasJson = !!(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "").trim();
  const hasLegacy = !!(process.env.FIREBASE_SERVICE_ACCOUNT ?? "").trim();
  const hasProjectId = !!(process.env.FIREBASE_PROJECT_ID ?? "").trim();
  const hasClientEmail = !!(process.env.FIREBASE_CLIENT_EMAIL ?? "").trim();
  const hasPrivateKey = !!(process.env.FIREBASE_PRIVATE_KEY ?? "").trim();
  console.warn(
    "[Firebase Admin] Credentials not loaded. Env: JSON_PATH=%s, KEY_BASE64=%s, JSON=%s, LEGACY=%s, PROJECT_ID=%s, CLIENT_EMAIL=%s, PRIVATE_KEY=%s. Run: node scripts/check-firebase-admin-env.js",
    hasPath ? "set" : "unset",
    hasBase64 ? "set" : "unset",
    hasJson ? "set" : "unset",
    hasLegacy ? "set" : "unset",
    hasProjectId ? "set" : "unset",
    hasClientEmail ? "set" : "unset",
    hasPrivateKey ? "set" : "unset"
  );
}

export function getFirebaseAdmin(): { app: App; auth: Auth; db: Firestore } {
  if (app) {
    const auth = require("firebase-admin").auth(app);
    const db = require("firebase-admin").firestore(app);
    return { app, auth, db };
  }
  const credential = getServiceAccount();
  if (!credential) {
    logCredentialDiagnostic();
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON_PATH, FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, or FIREBASE_SERVICE_ACCOUNT_JSON. Run: node scripts/check-firebase-admin-env.js"
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
