/**
 * Vercel serverless handler for GET /api/studio/usage (EchoFlux-style).
 * Returns caption and AI usage remaining for the authenticated user.
 */
const { getFirebaseAdmin } = require("../_lib/firebase-admin");

const CAPTION_DAILY_LIMIT = 100;
const AI_DAILY_LIMIT = 200;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function getDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function getCaptionRemaining(db, uid) {
  try {
    const dateKey = getDateKey();
    const snap = await db.collection("studio_caption_usage").where("uid", "==", uid).where("dateKey", "==", dateKey).limit(1).get();
    let count = 0;
    snap.forEach((doc) => {
      const d = doc.data();
      count = typeof d.count === "number" ? d.count : 0;
    });
    return Math.max(0, CAPTION_DAILY_LIMIT - count);
  } catch {
    return CAPTION_DAILY_LIMIT;
  }
}

async function getAiRemaining(db, uid) {
  try {
    const dateKey = getDateKey();
    const snap = await db.collection("studio_ai_usage").where("uid", "==", uid).where("dateKey", "==", dateKey).limit(1).get();
    let count = 0;
    snap.forEach((doc) => {
      const d = doc.data();
      count = typeof d.count === "number" ? d.count : 0;
    });
    return Math.max(0, AI_DAILY_LIMIT - count);
  } catch {
    return AI_DAILY_LIMIT;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end("");
    return;
  }

  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  let uid;
  try {
    const authHeader = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
    const token = (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "") || "";
    if (!token) {
      json(res, 401, { error: "Missing auth token." });
      return;
    }
    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch (authErr) {
    json(res, 401, { error: "Invalid or expired token." });
    return;
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const [captionRemaining, aiRemaining] = await Promise.all([
      getCaptionRemaining(db, uid),
      getAiRemaining(db, uid),
    ]);
    json(res, 200, {
      captionGenerationsRemaining: captionRemaining,
      aiSuggestionsRemaining: aiRemaining,
      captionDailyLimit: CAPTION_DAILY_LIMIT,
      limitPeriod: "day",
    });
  } catch (err) {
    console.error("[api/studio/usage]", err);
    json(res, 200, {
      captionGenerationsRemaining: CAPTION_DAILY_LIMIT,
      aiSuggestionsRemaining: AI_DAILY_LIMIT,
      captionDailyLimit: CAPTION_DAILY_LIMIT,
      limitPeriod: "day",
    });
  }
};
