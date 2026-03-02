/**
 * Vercel serverless handler for /api/studio/generate-captions (EchoFlux-style).
 * This file is used in production so AI works when Next.js app/api routing doesn't.
 * Same env as app: GEMINI_API_KEY or GOOGLE_API_KEY, Firebase Admin credentials.
 */
const { getFirebaseAdmin } = require("../_lib/firebase-admin");

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

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

function getApiKey() {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim() || null;
}

async function fetchMediaAsBase64(url, maxImageBytes = MAX_IMAGE_BYTES, maxVideoBytes = MAX_VIDEO_BYTES) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  const bytes = buf.byteLength;
  const isVideo = /video\//i.test(contentType);
  const max = isVideo ? maxVideoBytes : maxImageBytes;
  if (bytes > max) throw new Error(`Media too large: ${bytes} bytes (max ${max})`);
  return { data: buf.toString("base64"), mimeType: contentType };
}

async function callGemini(apiKey, model, body) {
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, status: res.status, errText: await res.text() };
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  return { ok: true, text };
}

function parseCaptionList(rawText) {
  const trimmed = (rawText || "").trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const toParse = (codeBlockMatch ? codeBlockMatch[1].trim() : trimmed).replace(/\\"/g, '"');
  const arrayMatch = toParse.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const arr = JSON.parse(arrayMatch[0]);
      if (!Array.isArray(arr)) return [];
      return arr
        .map((c) => {
          const cap = typeof c === "string" ? c.trim() : (c?.caption && typeof c.caption === "string" ? c.caption.trim() : "");
          return cap ? { caption: cap, hashtags: [] } : null;
        })
        .filter(Boolean);
    } catch (_) {}
  }
  try {
    const obj = JSON.parse(toParse);
    if (Array.isArray(obj?.captions)) {
      return obj.captions
        .map((c) => {
          const cap = typeof c?.caption === "string" ? c.caption.trim() : "";
          return cap ? { caption: cap, hashtags: [] } : null;
        })
        .filter(Boolean);
    }
  } catch (_) {}
  return [];
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end("");
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    json(res, 200, [{ caption: "AI captioning not available. Set GEMINI_API_KEY or GOOGLE_API_KEY in Vercel.", hashtags: [] }]);
    return;
  }

  let uid;
  try {
    const authHeader = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
    const token = (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "") || "";
    if (!token) {
      json(res, 401, { error: "Missing auth token.", message: "Missing auth token." });
      return;
    }
    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch (authErr) {
    console.warn("[api/studio/generate-captions] auth error:", authErr?.message);
    json(res, 401, { error: "Invalid or expired token.", message: authErr?.message || "Invalid or expired token." });
    return;
  }

  const body = parseBody(req);
  const mediaUrl = body.mediaUrl || body.imageUrl;
  const mediaUrls = Array.isArray(body.mediaUrls) ? body.mediaUrls : Array.isArray(body.imageUrls) ? body.imageUrls : [];
  const mediaData = body.mediaData && body.mediaData.data && body.mediaData.mimeType ? body.mediaData : null;
  const goal = (body.goal || "engagement").trim();
  const tone = (body.tone || "flirty").trim();
  const promptText = (body.promptText || body.starterText || "").trim();
  const creatorPersonality = (body.creatorPersonality || body.bio || "").trim();
  const platforms = Array.isArray(body.platforms) ? body.platforms.join(", ") : "Instagram";
  const emojiEnabled = body.emojiEnabled !== false;
  const emojiIntensity = Math.max(0, Math.min(10, Number(body.emojiIntensity) || 5));
  const count = Math.max(1, Math.min(5, Number(body.count) || 3));

  const userText = `Generate ${count} short social media caption options. First person (creator POV). NO HASHTAGS (return empty hashtags array).
tone: ${tone}
goal: ${goal || "engagement"}
creator_voice: ${creatorPersonality || "flirty, premium, engaging"}
platforms: ${platforms}
emoji_enabled: ${emojiEnabled}
emoji_intensity: ${emojiIntensity} (0=none, 10=heavy)
${promptText ? `User instructions: ${promptText}` : ""}

Return STRICT JSON only, e.g.:
[{"caption":"...","hashtags":[]}]
or {"captions":[{"caption":"...","hashtags":[]}]}`;

  const parts = [{ text: userText }];

  let hasMedia = false;
  if (mediaData && mediaData.data && mediaData.mimeType) {
    const size = (mediaData.data.length * 3) / 4;
    const isVideo = /video\//i.test(mediaData.mimeType);
    if (size <= (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
      parts.unshift({ inlineData: { mimeType: mediaData.mimeType, data: mediaData.data } });
      hasMedia = true;
    }
  }
  if (!hasMedia && (mediaUrl || mediaUrls.length > 0)) {
    const urls = mediaUrl ? [mediaUrl] : mediaUrls.slice(0, 3);
    for (const url of urls) {
      if (!url || typeof url !== "string" || !url.trim().startsWith("http")) continue;
      try {
        const { data, mimeType } = await fetchMediaAsBase64(url.trim());
        parts.unshift({ inlineData: { mimeType, data } });
        hasMedia = true;
        break;
      } catch (e) {
        console.warn("[api/studio/generate-captions] media fetch failed:", url.slice(0, 80), e?.message);
      }
    }
  }

  const payload = {
    contents: [{ role: "user", parts }],
    generationConfig: { maxOutputTokens: 1200, temperature: 0.85 },
  };

  let rawText = "";
  let lastErr = null;
  for (const model of MODELS) {
    try {
      const result = await callGemini(apiKey, model, payload);
      if (result.ok && result.text) {
        rawText = result.text;
        break;
      }
      lastErr = new Error(result.errText || `HTTP ${result.status}`);
      if (result.status === 404) continue;
      break;
    } catch (e) {
      lastErr = e;
    }
  }

  if (!rawText) {
    json(res, 200, [
      {
        caption: lastErr?.message || "AI generation failed. Check GEMINI_API_KEY and try again.",
        hashtags: [],
      },
    ]);
    return;
  }

  const list = parseCaptionList(rawText);
  const result = list.length > 0 ? list.slice(0, count) : [{ caption: (rawText.trim() || "Share your moment ✨").slice(0, 500), hashtags: [] }];

  // Record usage (same as Next.js caption-usage)
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const adminModule = require("firebase-admin");
    const FieldValue = adminModule.firestore.FieldValue;
    const d = new Date();
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const docId = `${uid}:${dateKey}`;
    await db.collection("studio_caption_usage").doc(docId).set(
      {
        uid,
        dateKey,
        count: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (_) {}

  json(res, 200, result);
};
