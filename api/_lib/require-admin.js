/**
 * Server-side admin check for legacy API routes (req/res).
 * Verifies Bearer token and ensures user is admin (allowlist or admin_users).
 */
const ALLOWED_ADMIN_EMAILS = ["will_jackson@icloud.com", "stormij.xo@gmail.com"];
const { getFirebaseAdmin } = require("./firebase-admin");

function getToken(req) {
  const h = req && req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!h || typeof h !== "string" || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim();
}

async function requireAdmin(req, res) {
  const token = getToken(req);
  if (!token) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Missing auth token." }));
    return null;
  }
  const admin = getFirebaseAdmin();
  const auth = admin.auth();
  const db = admin.firestore();
  let decoded;
  try {
    const d = await auth.verifyIdToken(token);
    decoded = { uid: d.uid, email: (d.email || "").trim() || "" };
  } catch {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Invalid or expired token." }));
    return null;
  }
  const email = (decoded.email || "").toLowerCase();
  if (ALLOWED_ADMIN_EMAILS.includes(email)) {
    await db.collection("admin_users").doc(decoded.uid).set(
      { email: decoded.email || email, role: "admin" },
      { merge: true }
    );
    return { decoded, admin };
  }
  const snap = await db.collection("admin_users").where("email", "==", decoded.email || "").where("role", "==", "admin").limit(1).get();
  if (snap.empty) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Admin access required." }));
    return null;
  }
  return { decoded, admin };
}

module.exports = { requireAdmin, getToken };
