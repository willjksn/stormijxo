/**
 * POST { email, password, memberId?, displayName? } — create Firebase Auth user and link to member.
 * Same logic as app/api/admin/create-user/route.ts for when request hits legacy api.
 */
const { getFirebaseAdmin } = require("../_lib/firebase-admin");
const { requireAdmin } = require("../_lib/require-admin");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (!req || req.body == null) return {};
  if (typeof req.body === "object") return req.body;
  if (typeof req.body !== "string") return {};
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

module.exports = async function createUserHandler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }
  const authResult = await requireAdmin(req, res);
  if (!authResult) return;
  const { admin } = authResult;

  const body = parseBody(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";
  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : null;

  if (!email) {
    json(res, 400, { error: "Email is required." });
    return;
  }
  if (!password || password.length < 6) {
    json(res, 400, { error: "New password must be at least 6 characters." });
    return;
  }

  const auth = admin.auth();
  const db = admin.firestore();

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: false,
    });
    const uid = userRecord.uid;

    if (memberId) {
      const memberRef = db.collection("members").doc(memberId);
      await memberRef.set({ uid, userId: uid }, { merge: true });
    }

    await db.collection("users").doc(uid).set(
      {
        email,
        displayName: displayName || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    json(res, 200, {
      ok: true,
      message: "User created. They can log in and will appear in Messages.",
      uid,
    });
  } catch (err) {
    const msg = err && err.message ? err.message : "Failed to create user.";
    if (msg.includes("email-already-exists") || msg.includes("already in use")) {
      json(res, 409, { error: "An account with this email already exists. They can log in or use password reset." });
      return;
    }
    json(res, 500, { error: msg });
  }
};
