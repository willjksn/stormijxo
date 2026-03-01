/**
 * Debug: which Firebase Admin env vars the Next.js server sees.
 * GET /api/studio/env-check — returns only set/unset, no secret values.
 * Remove or restrict this in production if you prefer.
 */
import { NextResponse } from "next/server";

export async function GET() {
  const privateKeyRaw = (process.env.FIREBASE_PRIVATE_KEY ?? "").trim();
  const env = {
    FIREBASE_SERVICE_ACCOUNT_JSON_PATH: !!(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_PATH ?? "").trim(),
    FIREBASE_SERVICE_ACCOUNT_KEY_BASE64: !!(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 ?? "").trim(),
    FIREBASE_SERVICE_ACCOUNT_JSON: !!(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "").trim(),
    FIREBASE_PROJECT_ID: !!(process.env.FIREBASE_PROJECT_ID ?? "").trim(),
    FIREBASE_CLIENT_EMAIL: !!(process.env.FIREBASE_CLIENT_EMAIL ?? "").trim(),
    FIREBASE_PRIVATE_KEY: !!(process.env.FIREBASE_PRIVATE_KEY ?? "").trim(),
  };
  const threeVars = env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY;
  const privateKeyInfo = {
    length: privateKeyRaw.length,
    startsWithQuote: privateKeyRaw.startsWith('"'),
    endsWithQuote: privateKeyRaw.endsWith('"'),
    hasBegin: privateKeyRaw.includes("BEGIN PRIVATE KEY"),
    hasEnd: privateKeyRaw.includes("END PRIVATE KEY"),
    hasEscapedNewline: privateKeyRaw.includes("\\n"),
  };
  return NextResponse.json({
    message: "Server env check (no values logged). Restart dev server after changing .env.local.",
    env,
    threeVarsReady: threeVars,
    privateKeyInfo,
  });
}
