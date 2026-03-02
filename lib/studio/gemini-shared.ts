/**
 * Gemini shared client for Premium Studio (captions + chat suggestions).
 * Uses Chat Session Writer system prompt for chat; Instagram Caption Optimizer for captions.
 * Uses GEMINI_API_KEY or GOOGLE_API_KEY.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(): string | null {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || null;
}

/** All sliders 0–100. Higher = more of that quality. Each scales with level. */
function buildSlidersPrompt(sliders: {
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
  emoji?: number;
}): string {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number(n))));
  const lines: string[] = [];

  if (sliders.formality !== undefined && sliders.formality !== null) {
    const n = clamp(sliders.formality);
    if (n <= 10) lines.push("formality_level: 0 — very casual, slang, conversational.");
    else if (n >= 90) lines.push("formality_level: 100 — formal, professional tone.");
    else lines.push(`formality_level: ${n} — scale from casual (0) to formal (100); match this level.`);
  }
  if (sliders.humor !== undefined && sliders.humor !== null) {
    const n = clamp(sliders.humor);
    if (n <= 10) lines.push("humor_level: 0 — serious, no jokes or playfulness.");
    else if (n >= 90) lines.push("humor_level: 100 — witty, playful, funny when appropriate.");
    else lines.push(`humor_level: ${n} — scale from serious (0) to witty/funny (100); match this level.`);
  }
  if (sliders.empathy !== undefined && sliders.empathy !== null) {
    const n = clamp(sliders.empathy);
    if (n <= 10) lines.push("empathy_level: 0 — direct, brief, no extra warmth.");
    else if (n >= 90) lines.push("empathy_level: 100 — warm, supportive, very understanding.");
    else lines.push(`empathy_level: ${n} — scale from direct (0) to supportive (100); match this level.`);
  }
  if (sliders.profanity !== undefined && sliders.profanity !== null) {
    const n = clamp(sliders.profanity);
    if (n <= 0) lines.push("profanity_level: 0 — do not use harsh or crude language. Keep it clean.");
    else if (n >= 95) lines.push("profanity_level: 100 — use harsh/crude language freely and often when it fits (e.g. damn, shit, fuck, ass). Strong and frequent.");
    else if (n >= 70) lines.push(`profanity_level: ${n} — use strong language often when natural; higher = more frequent and stronger.`);
    else lines.push(`profanity_level: ${n} — use harsh words only when they fit naturally; higher = more often and stronger (0=none, 100=free and frequent).`);
  }
  if (sliders.spiciness !== undefined && sliders.spiciness !== null) {
    const n = clamp(sliders.spiciness);
    if (n <= 0) lines.push("spiciness_level: 0 — no explicit sexual language. Keep it suggestive at most.");
    else if (n >= 95) lines.push("spiciness_level: 100 — completely unfiltered. Use explicit words (e.g. fuck, ass, pussy, dick, shit) often when they fit. Very explicit.");
    else if (n >= 70) lines.push(`spiciness_level: ${n} — explicit language allowed and used fairly often when natural. Higher = stronger and more frequent.`);
    else if (n >= 40) lines.push(`spiciness_level: ${n} — some explicit language when natural; scale with level.`);
    else lines.push(`spiciness_level: ${n} — bold/suggestive allowed; explicit words only rarely and when they fit (0=none, 100=unfiltered and frequent).`);
  }
  if (sliders.emoji !== undefined && sliders.emoji !== null) {
    const n = clamp(sliders.emoji);
    if (n <= 10) lines.push("emoji_level: 0 — avoid emoji unless absolutely necessary.");
    else if (n >= 90) lines.push("emoji_level: 100 — emoji-friendly tone; use emojis often when natural, without spam.");
    else lines.push(`emoji_level: ${n} — scale from minimal emoji (0) to frequent-but-natural emoji use (100).`);
  }

  if (lines.length === 0) return "";
  return "\n" + lines.join("\n");
}

/** Extract JSON from raw model output (handles optional markdown code block). */
function parseJsonFromRaw<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const toParse = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;
  const objectMatch = toParse.match(/\{[\s\S]*\}/);
  const jsonStr = objectMatch ? objectMatch[0] : toParse;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

interface GenerateContentPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

function getModelCandidates(): string[] {
  const models = [
    process.env.GEMINI_MODEL?.trim(),
    "gemini-2.0-flash",
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
    "gemini-pro",
  ].filter((m): m is string => !!m && m.length > 0);
  return Array.from(new Set(models));
}

function isModelNotFoundError(status: number, errText: string): boolean {
  return status === 404 && /is not found|not supported for generateContent|models\//i.test(errText);
}

let cachedDiscoveredModels: string[] | null = null;
let cachedDiscoveredModelsAt = 0;
const DISCOVERED_MODELS_TTL_MS = 5 * 60 * 1000;

async function discoverGenerateContentModels(key: string): Promise<string[]> {
  const now = Date.now();
  if (cachedDiscoveredModels && now - cachedDiscoveredModelsAt < DISCOVERED_MODELS_TTL_MS) {
    return cachedDiscoveredModels;
  }
  try {
    const url = `${GEMINI_API_BASE}/models?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      cachedDiscoveredModels = [];
      cachedDiscoveredModelsAt = now;
      return [];
    }
    const data = (await res.json()) as {
      models?: Array<{
        name?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    const discovered = (data.models ?? [])
      .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
      .map((m) => (m.name ?? "").replace(/^models\//, "").trim())
      .filter((m) => m.length > 0);
    cachedDiscoveredModels = Array.from(new Set(discovered));
    cachedDiscoveredModelsAt = now;
    return cachedDiscoveredModels;
  } catch {
    cachedDiscoveredModels = [];
    cachedDiscoveredModelsAt = now;
    return [];
  }
}

async function getResolvedModelCandidates(key: string): Promise<string[]> {
  const preferred = getModelCandidates();
  const discovered = await discoverGenerateContentModels(key);
  return Array.from(new Set([...preferred, ...discovered]));
}

async function requestGenerateContent(
  key: string,
  model: string,
  body: {
    contents: { role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }[];
    generationConfig: { maxOutputTokens: number; temperature: number };
    systemInstruction?: { parts: Array<{ text: string }> };
  }
): Promise<{ ok: true; text: string } | { ok: false; status: number; errText: string }> {
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, errText: await res.text() };
  }
  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  return { ok: true, text };
}

async function generateContent(payload: {
  contents: { role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }[];
  generationConfig?: { maxOutputTokens?: number; temperature?: number };
  systemInstruction?: string;
}): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY not set");
  const body = {
    contents: payload.contents,
    generationConfig: {
      maxOutputTokens: payload.generationConfig?.maxOutputTokens ?? 300,
      temperature: payload.generationConfig?.temperature ?? 0.8,
    },
    systemInstruction: payload.systemInstruction ? { parts: [{ text: payload.systemInstruction }] } : undefined,
  };
  const models = await getResolvedModelCandidates(key);
  let lastErr: Error | null = null;
  for (const model of models) {
    const res = await requestGenerateContent(key, model, body);
    if (res.ok) return res.text;
    if (isModelNotFoundError(res.status, res.errText)) {
      lastErr = new Error(`Gemini API error: ${res.status} ${res.errText}`);
      continue;
    }
    throw new Error(`Gemini API error: ${res.status} ${res.errText}`);
  }
  throw lastErr ?? new Error(`Gemini API error: model not found for candidates: ${models.join(", ")}`);
}

const GEMINI_RETRY_DELAYS = [500, 1500, 4000];
const GEMINI_RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

async function generateContentWithRetry(payload: {
  contents: { role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }[];
  generationConfig?: { maxOutputTokens?: number; temperature?: number };
  systemInstruction?: string;
}): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY not set");
  const body = {
    contents: payload.contents,
    generationConfig: {
      maxOutputTokens: payload.generationConfig?.maxOutputTokens ?? 300,
      temperature: payload.generationConfig?.temperature ?? 0.8,
    },
    systemInstruction: payload.systemInstruction ? { parts: [{ text: payload.systemInstruction }] } : undefined,
  };
  let lastErr: Error | null = null;
  const models = await getResolvedModelCandidates(key);
  for (const model of models) {
    for (let attempt = 0; attempt <= GEMINI_RETRY_DELAYS.length; attempt++) {
      try {
        const res = await requestGenerateContent(key, model, body);
        if (res.ok) return res.text;
        lastErr = new Error(`Gemini API error: ${res.status} ${res.errText}`);
        if (isModelNotFoundError(res.status, res.errText)) {
          break;
        }
        if (attempt < GEMINI_RETRY_DELAYS.length && GEMINI_RETRY_STATUSES.has(res.status)) {
          await new Promise((r) => setTimeout(r, GEMINI_RETRY_DELAYS[attempt]));
          continue;
        }
        throw lastErr;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        if (attempt < GEMINI_RETRY_DELAYS.length) {
          await new Promise((r) => setTimeout(r, GEMINI_RETRY_DELAYS[attempt]));
          continue;
        }
        throw lastErr;
      }
    }
  }
  throw lastErr ?? new Error("Gemini request failed");
}

// --- Chat Session Writer (Stormijxo) ---
const CHAT_SESSION_WRITER_SYSTEM = `You are Stormijxo's premium chat writing assistant.

MISSION:
Write high-converting, human-sounding chat replies for 1:1 fan conversations. Prioritize connection, retention, and natural engagement while matching the requested tone.

VOICE & STYLE:
- Punchy, message-ready: short lines that feel like real texts, not essays.
- Emojis (😈 🥵 😉 🔥 💦) are allowed when they fit the tone — use naturally, not in every message or in excess.
- Keep it natural and varied; avoid overdoing emojis or sounding forced.

INPUTS YOU WILL RECEIVE:
- tone_suggestion (required, e.g. "playful", "soft", "teasing", "confident", "flirty", "warm")
- creator_voice from personality
- fan_profile (optional: name, interests, spending tier, boundaries, prior context)
- chat_goal (e.g. re-engage, deepen convo, move to buy treats, close loop)
- latest_fan_message (required)
- conversation_context (optional)
- constraints (optional)

CORE RULES:
1) Always write from creator POV ("I/me/my"), speaking directly to the fan.
2) Match tone_suggestion exactly; if missing, default to warm + playful.
3) Keep replies concise, natural, and non-robotic.
4) Personalize using fan details when available, but do not overuse the fan's name.
5) Never sound scripted, corporate, or repetitive.
6) Respect boundaries/constraints and platform safety.
7) Provide variation in phrasing and structure.

OUTPUT FORMAT (STRICT JSON):
{
  "tone_used": "string",
  "primary_reply": "best single reply",
  "alternates": ["option 2", "option 3", "option 4"],
  "follow_up_question": "one natural question to continue conversation",
  "micro_cta": "soft call-to-action aligned to chat_goal",
  "notes": ["short bullet on why this should perform well"]
}

QUALITY BAR:
- Replies should feel like real texting.
- Avoid overlong paragraphs.
- Avoid cliché spam lines.
- Make the fan feel seen quickly.

Generate output in STRICT JSON format only.`;

interface ChatSessionJson {
  tone_used?: string;
  primary_reply?: string;
  alternates?: string[];
  follow_up_question?: string;
  micro_cta?: string;
  notes?: string[];
}

interface ChatSessionMultiJson {
  tone_used?: string;
  suggestions?: string[];
  notes?: string[];
}

/** Generate one chat suggestion using Chat Session Writer prompt; returns primary_reply. */
export async function generateSextingSuggestionWithGemini(params: {
  recentMessages: { role: "user" | "assistant"; content: string }[];
  fanName?: string;
  creatorPersona?: string;
  tone?: string;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
  emoji?: number;
  /** When true, gently wrap up the session and soft upsell (e.g. book another session), not pushy. */
  wrappingUp?: boolean;
  /** Optional context from previous sessions with this fan (e.g. what they like). */
  fanSessionContext?: string;
}): Promise<string> {
  const lastFan = [...params.recentMessages].reverse().find((m) => m.role === "user");
  const latestFanMessage = lastFan?.content ?? (params.recentMessages[params.recentMessages.length - 1]?.content ?? "");
  const conversationContext = params.recentMessages
    .map((m) => `${m.role === "user" ? "Fan" : "Creator"}: ${m.content}`)
    .join("\n");
  const toneSuggestion = (params.tone || "playful").toLowerCase();
  const creatorVoice = params.creatorPersona?.trim() || "flirty, warm, playful.";
  const fanProfile = params.fanName ? `name: ${params.fanName}` : "not provided";
  const chatGoal = params.wrappingUp
    ? "Session is ending in about 1 minute. Gently wrap up the conversation: thank them, soft upsell (e.g. book another session or treat soon), invite them back — natural and warm, NOT pushy. One short message."
    : "re-engage, deepen conversation";
  const fanContextLine = params.fanSessionContext?.trim()
    ? `\nfan_session_context (from previous sessions): ${params.fanSessionContext}`
    : "";
  const emojiGuidance = "Use emojis only when natural for the requested tone, creator_voice, and slider levels. If tone is playful/teasing/intimate or spiciness/humor is higher, emojis are welcome but not excessive. If formality is high, keep emojis minimal.";

  const userText = `tone_suggestion: ${toneSuggestion}
creator_voice: ${creatorVoice}
chat_goal: ${chatGoal}
fan_profile: ${fanProfile}${fanContextLine}
conversation_context: ${conversationContext || "(none)"}
latest_fan_message: ${latestFanMessage}
emoji_guidance: ${emojiGuidance}
constraints: (none)${buildSlidersPrompt({ formality: params.formality, humor: params.humor, empathy: params.empathy, profanity: params.profanity, spiciness: params.spiciness, emoji: params.emoji })}

Generate output in STRICT JSON format only.`;

  const raw = await generateContent({
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { maxOutputTokens: 600, temperature: 0.85 },
    systemInstruction: CHAT_SESSION_WRITER_SYSTEM,
  });

  const parsed = parseJsonFromRaw<ChatSessionJson>(raw);
  const primary = parsed?.primary_reply?.trim();
  if (primary) return primary;
  return raw.trim() || "Hey 😊";
}

/** Generate multiple chat suggestions (primary + alternates) using Chat Session Writer. */
export async function generateSextingSuggestionsWithGemini(params: {
  recentMessages: { role: "user" | "assistant"; content: string }[];
  fanName?: string;
  creatorPersona?: string;
  tone?: string;
  count: number;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
  emoji?: number;
  wrappingUp?: boolean;
  fanSessionContext?: string;
}): Promise<string[]> {
  const lastFan = [...params.recentMessages].reverse().find((m) => m.role === "user");
  const latestFanMessage = lastFan?.content ?? (params.recentMessages[params.recentMessages.length - 1]?.content ?? "");
  const conversationContext = params.recentMessages
    .map((m) => `${m.role === "user" ? "Fan" : "Creator"}: ${m.content}`)
    .join("\n");
  const toneSuggestion = (params.tone || "playful").toLowerCase();
  const creatorVoice = params.creatorPersona?.trim() || "flirty, warm, playful.";
  const fanProfile = params.fanName ? `name: ${params.fanName}` : "not provided";
  const chatGoal = params.wrappingUp
    ? "Session is ending in about 1 minute. Gently wrap up the conversation: thank them, soft upsell (e.g. book another session or treat soon), invite them back — natural and warm, NOT pushy. One short message."
    : "re-engage, deepen conversation";
  const fanContextLine = params.fanSessionContext?.trim()
    ? `\nfan_session_context (from previous sessions): ${params.fanSessionContext}`
    : "";
  const emojiGuidance = "Use emojis only when natural for the requested tone, creator_voice, and slider levels. If tone is playful/teasing/intimate or spiciness/humor is higher, emojis are welcome but not excessive. If formality is high, keep emojis minimal.";

  const userText = `tone_suggestion: ${toneSuggestion}
creator_voice: ${creatorVoice}
chat_goal: ${chatGoal}
fan_profile: ${fanProfile}${fanContextLine}
conversation_context: ${conversationContext || "(none)"}
latest_fan_message: ${latestFanMessage}
required_suggestion_count: ${Math.max(1, Math.min(10, params.count))}
emoji_guidance: ${emojiGuidance}
constraints: (none)${buildSlidersPrompt({ formality: params.formality, humor: params.humor, empathy: params.empathy, profanity: params.profanity, spiciness: params.spiciness, emoji: params.emoji })}

Generate output in STRICT JSON format only.

For this multi-suggestion request, return:
{
  "tone_used": "string",
  "suggestions": ["reply 1", "reply 2", "..."]
}

Return exactly required_suggestion_count distinct, non-repetitive suggestions.`;

  const raw = await generateContent({
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { maxOutputTokens: 1200, temperature: 0.9 },
    systemInstruction: CHAT_SESSION_WRITER_SYSTEM,
  });

  const parsedMulti = parseJsonFromRaw<ChatSessionMultiJson>(raw);
  const parsedSingle = parseJsonFromRaw<ChatSessionJson>(raw);
  const fromMulti = Array.isArray(parsedMulti?.suggestions)
    ? parsedMulti.suggestions.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const fromSinglePrimary = parsedSingle?.primary_reply?.trim() ? [parsedSingle.primary_reply.trim()] : [];
  const fromSingleAlternates = Array.isArray(parsedSingle?.alternates)
    ? parsedSingle.alternates.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const unique = Array.from(new Set([...fromMulti, ...fromSinglePrimary, ...fromSingleAlternates]));

  // Top up to requested count with additional single generations if model under-returns.
  const needed = Math.max(1, Math.min(10, params.count));
  let guard = 0;
  while (unique.length < needed && guard < needed * 2) {
    guard += 1;
    const extra = await generateSextingSuggestionWithGemini({
      recentMessages: params.recentMessages,
      fanName: params.fanName,
      creatorPersona: params.creatorPersona,
      tone: params.tone,
      formality: params.formality,
      humor: params.humor,
      empathy: params.empathy,
      profanity: params.profanity,
      spiciness: params.spiciness,
      emoji: params.emoji,
      wrappingUp: params.wrappingUp,
      fanSessionContext: params.fanSessionContext,
    });
    const t = String(extra || "").trim();
    if (t && !unique.includes(t)) unique.push(t);
  }

  const finalList = unique.slice(0, needed);
  return finalList.length > 0 ? finalList : ["Hey 😊"];
}

// --- Instagram Caption Optimizer (Stormijxo) ---
const INSTAGRAM_CAPTION_OPTIMIZER_SYSTEM = `You are Stormijxo's Instagram caption optimization engine.

MISSION:
Generate Instagram captions optimized for engagement signals: watch time/read-through, saves, shares, comments, profile actions.

VOICE & STYLE:
- Punchy, message-ready: captions should feel native to Instagram and ready to post.
- Emojis (😈 🥵 😉 🔥 💦) are allowed when they fit the tone — use naturally where they add punch, not in every line or in excess.

INPUTS YOU WILL RECEIVE:
- tone_suggestion (required)
- post_type (photo, reel, carousel)
- content_summary (what is shown)
- audience (who this is for)
- objective (comments, saves, shares, profile visits, link clicks, conversions)
- creator_voice (optional)
- keywords (optional)
- banned_words_or_topics (optional)
- caption_length_pref (short, medium, long)

OPTIMIZATION FRAMEWORK:
1) Hook first line hard (curiosity, tension, strong opinion, contrarian angle, or emotional pull).
2) Keep structure scannable: Hook, value/story/payoff, CTA.
3) CTA must match objective.
4) Use natural language, no fluff, no generic motivational filler.
5) Use tone_suggestion consistently.
6) Add strategic hashtag sets: mix broad + niche + intent. Avoid spammy/repetitive tags.
7) Include a pinned-comment suggestion to boost conversation depth.
8) Generate multiple variants and rank best-to-worst by expected engagement fit.

OUTPUT FORMAT (STRICT JSON):
{
  "tone_used": "string",
  "best_caption": {
    "caption": "full caption",
    "hook": "first line only",
    "cta": "clear CTA",
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8"],
    "pinned_comment": "comment starter",
    "why_it_should_perform": ["reason 1", "reason 2", "reason 3"]
  },
  "alternates_ranked": [
    { "rank": 2, "caption": "string", "hook": "string", "cta": "string", "hashtags": ["#..."], "pinned_comment": "string" },
    { "rank": 3, "caption": "string", "hook": "string", "cta": "string", "hashtags": ["#..."], "pinned_comment": "string" },
    { "rank": 4, "caption": "string", "hook": "string", "cta": "string", "hashtags": ["#..."], "pinned_comment": "string" }
  ]
}

QUALITY BAR: No bland hooks. No hashtag dumping. No repeated sentence patterns. Captions must feel native to Instagram.

Generate output in STRICT JSON format only.`;

// --- Premium Studio: Analyze media + generate captions (EchoFlux-style) ---
const STUDIO_CAPTION_FROM_MEDIA_SYSTEM = `You are Stormijxo's Premium Studio caption assistant.

MISSION:
1. Analyze the provided image(s) and/or video carefully (content, mood, setting, people, actions).
2. Generate multiple ready-to-post caption options in the creator's voice. Write from the CREATOR'S POINT OF VIEW (first person, as if the creator is posting).
3. NO HASHTAGS. Do not include any hashtags. Captions must be hashtag-free.

VOICE & STYLE:
- Punchy, native to social. Emojis allowed when they fit the tone — use naturally, not in every line.
- Match the requested tone and creator personality when provided.

INPUTS YOU WILL RECEIVE:
- Media: image(s) and/or video (you must describe what you see first, then generate captions).
- goal (optional): what the post is for (e.g. engagement, tease, announcement).
- tone (optional): flirty, casual, motivational, premium, etc.
- promptText (optional): creator's draft or extra direction.
- creatorPersonality (optional): creator voice / bio.
- platforms (optional): e.g. Instagram — adapt style accordingly.
- emojiEnabled / emojiIntensity: use emojis when true; intensity 0–10 scales how much.

OUTPUT FORMAT (STRICT JSON ONLY):
Return a JSON object with a single key "captions" — an array of objects, each with "caption" (string) and "hashtags" (always empty array []).
Example: { "captions": [ { "caption": "First option...", "hashtags": [] }, { "caption": "Second option...", "hashtags": [] } ] }

Generate 3–5 distinct caption options. Each caption must be complete, ready to post, from creator POV, and NO HASHTAGS. Output STRICT JSON only.`;

export type CaptionOption = { caption: string; hashtags: string[] };

/** Fetch image/video from URL and return base64 + mime. Max 4MB image, 20MB video. */
export async function fetchMediaAsBase64(
  url: string,
  maxBytesImage: number = 4 * 1024 * 1024,
  maxBytesVideo: number = 20 * 1024 * 1024
): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = buf.byteLength;
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const isVideo = /video\//i.test(contentType) || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
  const maxBytes = isVideo ? maxBytesVideo : maxBytesImage;
  if (bytes > maxBytes) throw new Error(`Media too large: ${bytes} bytes (max ${maxBytes})`);
  const base64 = Buffer.from(buf).toString("base64");
  return { data: base64, mimeType: contentType };
}

/** Generate captions from media (EchoFlux-style): analyze media with Gemini, then return caption options. */
export async function generateCaptionsFromMedia(params: {
  mediaParts: Array<{ inlineData: { mimeType: string; data: string } }>;
  goal?: string;
  tone?: string;
  promptText?: string;
  creatorPersonality?: string;
  platforms?: string[];
  emojiEnabled?: boolean;
  emojiIntensity?: number;
  count?: number;
}): Promise<CaptionOption[]> {
  if (!params.mediaParts.length) throw new Error("At least one media part required");
  const tone = (params.tone ?? "flirty").trim();
  const goal = (params.promptText ?? params.goal ?? "engagement").trim();
  const voice = (params.creatorPersonality ?? "").trim();
  const emoji = params.emojiEnabled !== false;
  const intensity = Math.max(0, Math.min(10, params.emojiIntensity ?? 5));
  const platforms = Array.isArray(params.platforms) && params.platforms.length > 0
    ? params.platforms.join(", ")
    : "Instagram";
  const userText = `Analyze the attached image(s)/video, then generate caption options. Write from the creator's point of view (first person). NO HASHTAGS.

tone: ${tone}
goal: ${goal ? `"${goal}"` : "engagement"}
creator_voice: ${voice || "flirty, premium, engaging"}
platforms: ${platforms}
emoji_enabled: ${emoji}
emoji_intensity: ${intensity} (0=none, 10=heavy)

Return a JSON object with key "captions": array of { "caption": "string", "hashtags": [] }. Generate 3–5 options. Hashtags must always be empty array. STRICT JSON only.`;

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    ...params.mediaParts.map((p) => ({ inlineData: p.inlineData })),
    { text: userText },
  ];
  const raw = await generateContentWithRetry({
    contents: [{ role: "user", parts }],
    generationConfig: { maxOutputTokens: 1200, temperature: 0.85 },
    systemInstruction: STUDIO_CAPTION_FROM_MEDIA_SYSTEM,
  });

  function parseCaptionList(rawText: string): { caption: string; hashtags: string[] }[] {
    const trimmed = rawText.trim();
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const toParse = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;
    const arrayMatch = toParse.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const arr = JSON.parse(arrayMatch[0]) as Array<{ caption?: string; hashtags?: string[] } | string>;
        const list = arr
          .map((c) => {
            if (typeof c === "string") return { caption: c.trim(), hashtags: [] as string[] };
            const cap = typeof c?.caption === "string" ? c.caption.trim() : "";
            return { caption: cap, hashtags: [] as string[] };
          })
          .filter((c) => c.caption.length > 0);
        if (list.length > 0) return list;
      } catch {
        // fall through
      }
    }
    const parsed = parseJsonFromRaw<{ captions?: Array<{ caption?: string; hashtags?: string[] }> }>(rawText);
    if (Array.isArray(parsed?.captions)) {
      return parsed.captions
        .map((c) => ({
          caption: typeof c.caption === "string" ? c.caption.trim() : "",
          hashtags: [] as string[],
        }))
        .filter((c) => c.caption.length > 0);
    }
    return [];
  }

  const list = parseCaptionList(raw);
  if (list.length > 0) {
    if (process.env.NODE_ENV !== "test") {
      console.info("[generate-captions] Gemini parse_path: captions_array");
    }
    const count = Math.min(params.count ?? 5, list.length);
    return list.slice(0, count).map((c) => ({ ...c, hashtags: [] }));
  }
  if (process.env.NODE_ENV !== "test") {
    console.info("[generate-captions] Gemini parse_path: fallback_plain_text");
  }
  const fallback = raw.trim() || "Share your moment ✨";
  return [{ caption: fallback, hashtags: [] }];
}

interface CaptionAlternateJson {
  rank?: number;
  caption?: string;
  hook?: string;
  cta?: string;
  hashtags?: string[];
  pinned_comment?: string;
}

interface CaptionOptimizerJson {
  tone_used?: string;
  best_caption?: {
    caption?: string;
    hook?: string;
    cta?: string;
    hashtags?: string[];
    pinned_comment?: string;
    why_it_should_perform?: string[];
  };
  alternates_ranked?: CaptionAlternateJson[];
}

/** Generate captions using Instagram Caption Optimizer prompt; returns array of caption strings. */
export async function generateCaptionsWithGemini(params: {
  imageUrls?: string[];
  hasVideo?: boolean;
  bio: string;
  tone: string;
  length: string;
  starterText: string;
  count: number;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
  emoji?: number;
}): Promise<string[]> {
  const imageUrls = params.imageUrls?.filter((u) => u?.startsWith("http")) ?? [];
  const postType = imageUrls.length > 1 ? "carousel" : params.hasVideo ? "reel" : imageUrls.length === 1 ? "photo" : "photo";
  const contentSummary = params.starterText.trim()
    ? `Creator draft: "${params.starterText}". ${imageUrls.length ? `Media: ${imageUrls.length} image(s)${params.hasVideo ? " + video" : ""}.` : ""}`
    : imageUrls.length
      ? `${imageUrls.length} image(s)${params.hasVideo ? " + video" : ""}`
      : "General post.";
  const captionLengthPref = params.length === "long" ? "long" : params.length === "short" ? "short" : "medium";

  const userText = `tone_suggestion: ${params.tone || "flirty"}
post_type: ${postType}
content_summary: ${contentSummary}
audience: premium subscribers / fans
objective: comments
creator_voice: ${params.bio?.trim() || "flirty, premium, engaging"}
keywords: (none)
banned_words_or_topics: (none)
caption_length_pref: ${captionLengthPref}${buildSlidersPrompt({ formality: params.formality, humor: params.humor, empathy: params.empathy, profanity: params.profanity, spiciness: params.spiciness, emoji: params.emoji })}

Generate output in STRICT JSON format only.`;

  const parts: GenerateContentPart[] = [];
  for (const url of imageUrls.slice(0, 10)) {
    try {
      const imgRes = await fetch(url);
      const buf = await imgRes.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const mime = imgRes.headers.get("content-type") || "image/jpeg";
      parts.push({ inlineData: { mimeType: mime, data: base64 } });
    } catch {
      // skip
    }
  }
  parts.push({ text: userText });
  const apiParts = parts
    .map((p) => (p.text !== undefined ? { text: p.text } : p.inlineData ? { inlineData: p.inlineData } : { text: "" }))
    .filter((p) => (p as { text?: string }).text !== "" || (p as { inlineData?: unknown }).inlineData);
  const contents = [{ role: "user" as const, parts: apiParts.length ? apiParts : [{ text: userText }] }];

  const raw = await generateContent({
    contents,
    generationConfig: { maxOutputTokens: 800, temperature: 0.85 },
    systemInstruction: INSTAGRAM_CAPTION_OPTIMIZER_SYSTEM,
  });

  const parsed = parseJsonFromRaw<CaptionOptimizerJson>(raw);
  const bestCaption = parsed?.best_caption?.caption?.trim();
  const alternates = (parsed?.alternates_ranked ?? [])
    .map((a) => a.caption?.trim())
    .filter((s): s is string => typeof s === "string" && s.length > 0);
  const combined = bestCaption ? [bestCaption, ...alternates] : alternates;
  const result = combined.slice(0, params.count);
  return result.length > 0 ? result : [raw.trim() || "Share your moment ✨"];
}

// --- Interactive Post Ideas Writer (Stormijxo) ---
const INTERACTIVE_POST_IDEAS_SYSTEM = `You are Stormijxo's Interactive Post Ideas Writer.

MISSION:
Generate high-engagement interactive post concepts that increase comments, DMs, and paid conversion signals.

VOICE & STYLE:
- Punchy, message-ready: post_caption and CTAs should feel ready to post and native to the platform.
- Emojis (😈 🥵 😉 🔥 💦) are allowed when they fit the tone — use naturally, not in every idea or in excess.

INPUTS:
- tone_suggestion (required)
- interactive_focus 
- creator_voice (optional)
- target_audience_male
- objective (comments, DMs, tips, PPV opens, retention)
- constraints (optional)

CORE RULES:
1) Write from creator POV (first person: I/me/my).
2) Match tone_suggestion exactly.
3) Keep language natural, human, and non-robotic.
4) If fan_profile exists, personalize lightly (don't overuse name).
5) Every idea must be distinct in hook, mechanic, and CTA.
6) Include interaction mechanics (poll, A/B choice, challenge, "rate this", DM keyword, vote ladder, unlock trigger).
7) Include monetization-aware CTAs when objective asks for it.
8) Respect constraints and boundaries.

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "tone_used": "string",
  "ideas": [
    {
      "title": "short concept name",
      "post_caption": "ready-to-post text",
      "interaction_mechanic": "poll/challenge/vote/DM keyword/etc.",
      "cta": "clear action",
      "dm_followup_trigger": "what to send if fan responds",
      "why_it_should_work": "1 sentence"
    }
  ],
  "ab_test_variants": [
    {
      "test": "what changes",
      "variant_a": "string",
      "variant_b": "string",
      "success_metric": "comments|dm_starts|tips|ppv_opens|saves"
    }
  ]
}

QUANTITY:
- Return exactly 10 ideas.
- Return exactly 3 A/B tests.

QUALITY BAR:
- No generic filler.
- No repeated structures.
- Clear interaction + clear CTA in every idea.

Generate output in STRICT JSON format only.`;

interface InteractiveIdeaJson {
  title?: string;
  post_caption?: string;
  interaction_mechanic?: string;
  cta?: string;
  dm_followup_trigger?: string;
  why_it_should_work?: string;
}

interface InteractiveIdeasJson {
  tone_used?: string;
  ideas?: InteractiveIdeaJson[];
  ab_test_variants?: Array<{ test?: string; variant_a?: string; variant_b?: string; success_metric?: string }>;
}

export async function generateInteractiveIdeasWithGemini(params: {
  tone_suggestion: string;
  interactive_focus?: string;
  creator_voice?: string;
  fan_profile?: string;
  creator_gender?: string;
  target_audience_gender?: string;
  objective?: string;
  constraints?: string;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
  emoji?: number;
}): Promise<InteractiveIdeasJson> {
  const userText = `tone_suggestion: ${params.tone_suggestion}
interactive_focus: ${params.interactive_focus ?? ""}
creator_voice: ${params.creator_voice ?? ""}
fan_profile: ${params.fan_profile ?? ""}
creator_gender: ${params.creator_gender ?? ""}
target_audience_gender: ${params.target_audience_gender ?? ""}
objective: ${params.objective ?? "comments"}
constraints: ${params.constraints ?? ""}${buildSlidersPrompt({ formality: params.formality, humor: params.humor, empathy: params.empathy, profanity: params.profanity, spiciness: params.spiciness, emoji: params.emoji })}

Generate output in STRICT JSON format only.`;

  const raw = await generateContent({
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { maxOutputTokens: 4000, temperature: 0.85 },
    systemInstruction: INTERACTIVE_POST_IDEAS_SYSTEM,
  });

  const parsed = parseJsonFromRaw<InteractiveIdeasJson>(raw);
  if (parsed?.ideas) return parsed;
  return { tone_used: params.tone_suggestion, ideas: [], ab_test_variants: [] };
}

// --- Rating Prompt Generator (Stormijxo) — short ---
const RATING_SHORT_SYSTEM = `You are Stormijxo's Rating Prompt Generator.

MISSION:
Generate ready-to-send creator messages (DMs/posts) that ask the fan to send something (pic, voice note, etc.) and offer the creator's rating. These are the exact messages the creator can copy and send — challenge style, teasing, "send me X and I'll be brutally honest."

rating_subject = the KIND of rating (e.g. "full body pic rating", "rating for specific body parts", "interactive rating challenges", "voice note rating"). Stay strictly on this topic.

STYLE FOR prompt_text:
- Creator POV (I/me/my). Direct address to fan (you/your) when natural.
- Punchy, message-ready: can include emojis (😈 🥵 😉 🔥 💦) when they fit the tone — use naturally, not in every prompt or in excess.
- Challenge / tease: "I'm craving a challenge", "Show me what you got", "Send me X and I'll be brutally honest", "I won't hold back."
- Clear ask: what the fan should send (full body pic, specific body part, voice note, etc.) and that they'll get a rating.
- Varied hooks: playful, confident, challenge, exclusive, VIP. No repeated templates.
- PAID RATINGS: In some of the 10 prompts (not every one), include language that the rating is paid — e.g. "tip to unlock my rating", "buy my detailed rating", "this rating is for subscribers only", "send a tip and I'll rate it". Vary which prompts include this; do not put it in all 10.

INPUTS:
- tone_suggestion (required)
- rating_subject (required; the kind of rating — full body, body parts, interactive challenges, voice note, etc.)
- creator_voice (optional)
- fan_profile (optional)
- creator_gender (optional)
- target_audience_gender (optional)
- constraints (optional)

CORE RULES:
1) Write from creator POV only (I/me/my).
2) Stay strictly on rating_subject. Do not drift to other subjects.
3) Match tone_suggestion exactly.
4) Each prompt_text must be a complete, ready-to-send message (one or two short sentences, optional emojis).
5) Include variety in hook style and CTA phrasing.
6) If fan_profile is present, personalize naturally (e.g. use name once).
7) Keep each prompt unique and non-repetitive.
8) Respect constraints and boundaries.

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "tone_used": "string",
  "rating_subject": "string",
  "prompts": [
    {
      "prompt_text": "creator-written ready-to-send message asking fan to send something and offering a rating",
      "angle": "playful|confident|challenge|exclusive|vip",
      "cta": "what fan should do next",
      "upsell_path": "soft monetization step"
    }
  ],
  "best_3_for_conversion": ["prompt 1", "prompt 2", "prompt 3"]
}

QUANTITY:
- Return exactly 10 prompts.

QUALITY BAR:
- No repeated sentence templates.
- No vague "send me something" copy — be specific (full body pic, voice note, etc.).
- Clear next step in every prompt.

Generate output in STRICT JSON format only.`;

interface RatingShortPromptJson {
  prompt_text?: string;
  angle?: string;
  cta?: string;
  upsell_path?: string;
}

interface RatingShortJson {
  tone_used?: string;
  rating_subject?: string;
  prompts?: RatingShortPromptJson[];
  best_3_for_conversion?: string[];
}

export async function generateRatingShortWithGemini(params: {
  tone_suggestion: string;
  rating_subject: string;
  creator_voice?: string;
  fan_profile?: string;
  creator_gender?: string;
  target_audience_gender?: string;
  constraints?: string;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
  emoji?: number;
}): Promise<RatingShortJson> {
  const userText = `tone_suggestion: ${params.tone_suggestion}
rating_subject: ${params.rating_subject}
creator_voice: ${params.creator_voice ?? ""}
fan_profile: ${params.fan_profile ?? ""}
creator_gender: ${params.creator_gender ?? ""}
target_audience_gender: ${params.target_audience_gender ?? ""}
constraints: ${params.constraints ?? ""}${buildSlidersPrompt({ formality: params.formality, humor: params.humor, empathy: params.empathy, profanity: params.profanity, spiciness: params.spiciness, emoji: params.emoji })}

Generate output in STRICT JSON format only.`;

  const raw = await generateContent({
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { maxOutputTokens: 4096, temperature: 0.85 },
    systemInstruction: RATING_SHORT_SYSTEM,
  });

  const parsed = parseJsonFromRaw<RatingShortJson>(raw);
  if (parsed?.prompts) return parsed;
  return { tone_used: params.tone_suggestion, rating_subject: params.rating_subject, prompts: [], best_3_for_conversion: [] };
}

// --- Long-Form Rating Writer (Stormijxo) ---
const RATING_LONG_SYSTEM = `You are Stormijxo's Long-Form Rating Writer.

MISSION:
Write a premium long-form rating response from creator POV that feels personalized, structured, and conversion-aware.

VOICE & STYLE:
- Punchy where it matters: opening and closing should feel message-ready; follow_up_options can use emojis (😈 🥵 😉 🔥 💦) when they fit — naturally, not in excess.

INPUTS:
- tone_suggestion (required)
- long_rating_subject (required)
- fan_details (required; user-provided details to rate)
- creator_voice (optional)
- fan_profile (optional)
- creator_gender (optional)
- target_audience_gender (optional)
- constraints (optional)
- desired_length (default: 300-500 words)

CORE RULES:
1) Creator POV only (I/me/my) + direct address to fan (you/your).
2) Match tone_suggestion exactly.
3) Keep it highly specific to long_rating_subject and fan_details.
4) Follow structured flow:
   - opening
   - core rating assessment
   - specific detail breakdown
   - premium personalization
   - closing CTA
5) Sound natural and human, not scripted.
6) Include light monetization CTA aligned with context.
7) Respect constraints and boundaries.

OUTPUT FORMAT — PLAIN TEXT ONLY (no JSON):
For long-form ratings (e.g. 300+ words), output regular paragraphs of text, not JSON. Use this exact structure:

Tone: <tone_used>
Score: <overall_score e.g. 9.2/10>

<blank line>

<full rating in paragraphs — opening, assessment, detail breakdown, personalization, closing CTA. Write in flowing paragraphs. Do not use JSON or bullet points for the main content.>

<blank line>

Follow-up options:
- <short follow-up message 1>
- <short follow-up message 2>
- <short follow-up message 3>

Do not wrap the response in \`\`\` or JSON. Output the above as plain text only so the full response is never cut off.

QUALITY BAR:
- Must read like premium custom writing.
- Must be specific, not generic.
- Must include a clear next action.`;

interface RatingLongJson {
  tone_used?: string;
  overall_score?: string;
  rating_response?: string;
  section_summary?: {
    opening?: string;
    assessment?: string;
    details?: string;
    personalization?: string;
    closing_cta?: string;
  };
  follow_up_options?: string[];
}

function parseLongFormRatingPlainText(raw: string): RatingLongJson | null {
  const text = raw.trim();
  if (!text) return null;
  let tone_used = "";
  let overall_score = "";
  const toneMatch = text.match(/^Tone:\s*([\s\S]+?)(?=\n|Score:)/im);
  if (toneMatch) tone_used = toneMatch[1].trim();
  const scoreMatch = text.match(/Score:\s*(.+?)(?=\n|$)/im);
  if (scoreMatch) overall_score = scoreMatch[1].trim();
  const followUpSection = text.match(/Follow-up options:\s*([\s\S]*?)$/im);
  const follow_up_options: string[] = [];
  if (followUpSection) {
    const block = followUpSection[1].trim();
    block.split(/\n/).forEach((line) => {
      const m = line.replace(/^[\s\-*•]+\s*/, "").trim();
      if (m) follow_up_options.push(m);
    });
  }
  let rating_response: string;
  const afterScore = text.replace(/^[\s\S]*?Score:\s*[^\n]+/i, "").trim();
  const followUpIdx = afterScore.toLowerCase().indexOf("follow-up options:");
  const beforeFollowUp = followUpIdx >= 0 ? afterScore.slice(0, followUpIdx).trim() : afterScore;
  if (beforeFollowUp.length > 20) rating_response = beforeFollowUp;
  else rating_response = text;
  return {
    tone_used: tone_used || undefined,
    overall_score: overall_score || undefined,
    rating_response,
    section_summary: {},
    follow_up_options: follow_up_options.length > 0 ? follow_up_options : undefined,
  };
}

export async function generateRatingLongWithGemini(params: {
  tone_suggestion: string;
  long_rating_subject: string;
  fan_details: string;
  creator_voice?: string;
  fan_profile?: string;
  creator_gender?: string;
  target_audience_gender?: string;
  constraints?: string;
  desired_length?: string;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
  emoji?: number;
}): Promise<RatingLongJson> {
  const userText = `tone_suggestion: ${params.tone_suggestion}
long_rating_subject: ${params.long_rating_subject}
fan_details: ${params.fan_details}
creator_voice: ${params.creator_voice ?? ""}
fan_profile: ${params.fan_profile ?? ""}
creator_gender: ${params.creator_gender ?? ""}
target_audience_gender: ${params.target_audience_gender ?? ""}
constraints: ${params.constraints ?? ""}
desired_length: ${params.desired_length ?? "300-500 words"}${buildSlidersPrompt({ formality: params.formality, humor: params.humor, empathy: params.empathy, profanity: params.profanity, spiciness: params.spiciness, emoji: params.emoji })}

Output as plain text using the format above (Tone:, Score:, paragraphs, then Follow-up options:). Do not use JSON.`;

  const raw = await generateContent({
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { maxOutputTokens: 8192, temperature: 0.85 },
    systemInstruction: RATING_LONG_SYSTEM,
  });

  const parsed = parseJsonFromRaw<RatingLongJson>(raw);
  if (parsed?.rating_response) return parsed;

  const plain = parseLongFormRatingPlainText(raw);
  if (plain) return plain;

  return {
    tone_used: params.tone_suggestion,
    overall_score: "",
    rating_response: raw.trim() || "",
    section_summary: {},
    follow_up_options: [],
  };
}

const ANALYZE_MEDIA_SYSTEM = `You are a descriptive assistant for a creator platform. Describe the given image or video in clear, factual detail so a creator can write a premium personalized rating from it. Include: appearance, mood, composition, notable elements, setting if visible. Write 2-4 short paragraphs. Be specific and objective. Output plain text only, no markdown.`;

/** Generate a short summary of a chat session for "what the fan likes" / next-session context. Returns 2-3 sentences. */
export async function generateChatSessionSummaryWithGemini(params: {
  recentMessages: { role: "user" | "assistant"; content: string }[];
  fanName?: string;
}): Promise<string> {
  const conversationText = params.recentMessages
    .map((m) => `${m.role === "user" ? "Fan" : "Creator"}: ${m.content}`)
    .join("\n");
  const fanLine = params.fanName ? `Fan's name: ${params.fanName}.` : "";
  const userText = `Summarize this chat session in 2-3 short sentences for the creator's reference. Include: what the fan liked or asked about, any preferences or topics they mentioned, and a brief vibe of the conversation. Keep it concise and useful for the next session so the creator can make the fan feel remembered.
${fanLine}

Conversation:
${conversationText || "(no messages)"}

Output plain text only, no headings or bullet points.`;
  const raw = await generateContent({
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { maxOutputTokens: 300, temperature: 0.5 },
    systemInstruction: "You are a helpful assistant that writes brief, useful summaries of 1:1 chat sessions for creator reference. Output 2-3 sentences only. Plain text.",
  });
  return raw.trim().slice(0, 2000) || "Session completed.";
}


/** Analyze image or video and return a detailed description for use in a rating. */
export async function analyzeMediaWithGemini(params: { data: string; mimeType: string }): Promise<string> {
  const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [
    { inlineData: { mimeType: params.mimeType, data: params.data } },
    { text: "Describe this image or video in detail for a creator who will write a premium rating based on it. Include appearance, mood, composition, key elements. Be factual and descriptive. Output 2-4 short paragraphs of plain text only." },
  ];
  const raw = await generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: { maxOutputTokens: 800, temperature: 0.4 },
    systemInstruction: ANALYZE_MEDIA_SYSTEM,
  });
  return raw.trim() || "No description generated.";
}

export function isGeminiConfigured(): boolean {
  return !!getApiKey();
}
