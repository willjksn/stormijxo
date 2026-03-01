/**
 * Input sanitizer for Premium Studio (captions, sexting suggestions).
 */

const MAX_CAPTION_LENGTH = 4000;
const MAX_BIO_LENGTH = 2000;
const MAX_STARTER_LENGTH = 1000;
const MAX_IMAGE_URLS = 10;
const MAX_IMAGE_URL_LENGTH = 2048;
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_FAN_NAME = 200;
const MAX_PERSONA_LENGTH = 1000;

function clampSlider(v: unknown): number | undefined {
  if (typeof v !== "number" || Number.isNaN(v)) return undefined;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function sanitizeCaptionInput(input: {
  imageUrl?: string;
  imageUrls?: string[];
  bio?: string;
  tone?: string;
  length?: string;
  starterText?: string;
  count?: number;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
}): {
  imageUrls: string[];
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
} {
  const single = typeof input.imageUrl === "string" ? input.imageUrl.trim().slice(0, MAX_IMAGE_URL_LENGTH) : "";
  const fromArray = Array.isArray(input.imageUrls)
    ? input.imageUrls
        .filter((u) => typeof u === "string" && u.trim())
        .map((u) => u.trim().slice(0, MAX_IMAGE_URL_LENGTH))
        .slice(0, MAX_IMAGE_URLS)
    : [];
  const imageUrls = single ? [single, ...fromArray.filter((u) => u !== single)] : fromArray;
  const bio = typeof input.bio === "string" ? input.bio.trim().slice(0, MAX_BIO_LENGTH) : "";
  const tone = typeof input.tone === "string" ? input.tone.trim().slice(0, 64) : "";
  const length = typeof input.length === "string" ? input.length.trim().slice(0, 32) : "";
  const starterText = typeof input.starterText === "string" ? input.starterText.trim().slice(0, MAX_STARTER_LENGTH) : "";
  const count = typeof input.count === "number" && input.count >= 1 && input.count <= 5 ? input.count : 1;
  const profanity = clampSlider(input.profanity);
  const spiciness = clampSlider(input.spiciness);
  const formality = clampSlider(input.formality);
  const humor = clampSlider(input.humor);
  const empathy = clampSlider(input.empathy);
  return { imageUrls, bio, tone, length, starterText, count, formality, humor, empathy, profanity, spiciness };
}

export interface SextingMessage {
  role: string;
  content: string;
}

export function sanitizeSextingInput(input: {
  recentMessages?: SextingMessage[];
  fanName?: string;
  creatorPersona?: string;
  tone?: string;
  numSuggestions?: number;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
  wrappingUp?: boolean;
  fanSessionContext?: string;
}): {
  recentMessages: { role: "user" | "assistant"; content: string }[];
  fanName: string;
  creatorPersona: string;
  tone: string;
  numSuggestions: number;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
  wrappingUp: boolean;
  fanSessionContext: string;
} {
  const raw = Array.isArray(input.recentMessages) ? input.recentMessages.slice(-MAX_MESSAGES) : [];
  const recentMessages = raw
    .map((m) => {
      const role = m?.role === "assistant" ? "assistant" : "user";
      const content = typeof m?.content === "string" ? m.content.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
      return content ? { role, content } : null;
    })
    .filter(Boolean) as { role: "user" | "assistant"; content: string }[];
  const fanName = typeof input.fanName === "string" ? input.fanName.trim().slice(0, MAX_FAN_NAME) : "";
  const creatorPersona = typeof input.creatorPersona === "string" ? input.creatorPersona.trim().slice(0, MAX_PERSONA_LENGTH) : "";
  const tone = typeof input.tone === "string" ? input.tone.trim().slice(0, 32) : "";
  const numSuggestions = typeof input.numSuggestions === "number" && input.numSuggestions >= 1 && input.numSuggestions <= 6 ? input.numSuggestions : 1;
  const profanity = clampSlider(input.profanity);
  const spiciness = clampSlider(input.spiciness);
  const formality = clampSlider(input.formality);
  const humor = clampSlider(input.humor);
  const empathy = clampSlider(input.empathy);
  const wrappingUp = input.wrappingUp === true;
  const fanSessionContext = typeof input.fanSessionContext === "string" ? input.fanSessionContext.trim().slice(0, 2000) : "";
  return { recentMessages, fanName, creatorPersona, tone, numSuggestions, formality, humor, empathy, profanity, spiciness, wrappingUp, fanSessionContext };
}
