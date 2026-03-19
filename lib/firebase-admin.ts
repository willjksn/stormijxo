/**
 * Firebase Admin for App Router API routes (Node runtime).
 * Use this instead of require("api/_lib/firebase-admin") to avoid bundler / 508 issues on Vercel.
 */
import * as admin from "firebase-admin";

function parseServiceAccountFromEnv(): Record<string, unknown> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch {
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON/FIREBASE_SERVICE_ACCOUNT");
  }
}

function getCredentialFromEnv(): admin.credential.Credential | null {
  const svc = parseServiceAccountFromEnv();
  if (svc) return admin.credential.cert(svc as admin.ServiceAccount);

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) return null;

  return admin.credential.cert({
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKeyRaw.replace(/\\n/g, "\n"),
  } as admin.ServiceAccount);
}

export function getFirebaseAdmin(): typeof admin {
  if (admin.apps.length > 0) return admin;

  const credential = getCredentialFromEnv();
  if (!credential) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON (preferred) or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY."
    );
  }

  admin.initializeApp({ credential });
  return admin;
}
