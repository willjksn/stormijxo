/**
 * Emoji helper for captions (strip or allow list).
 */

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F1E0}-\u{1F1FF}]/gu;

export function stripEmoji(text: string): string {
  return text.replace(EMOJI_REGEX, "").replace(/\s+/g, " ").trim();
}

export function hasEmoji(text: string): boolean {
  return EMOJI_REGEX.test(text);
}

/** Append a single safe emoji for flair (Stormijxo style). */
const FLAIR = ["✨", "💕", "🌸", "💖"];
export function suggestFlair(): string {
  return FLAIR[Math.floor(Math.random() * FLAIR.length)];
}
