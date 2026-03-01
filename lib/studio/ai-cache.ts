/**
 * Simple in-memory cache for AI responses (same prompt → same result within TTL).
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 500;

interface Entry {
  value: string[];
  expiresAt: number;
}

const cache = new Map<string, Entry>();

function prune(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  if (cache.size > MAX_ENTRIES) {
    const sorted = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (let i = 0; i < sorted.length - MAX_ENTRIES; i++) {
      cache.delete(sorted[i][0]);
    }
  }
}

export function getCachedCaptions(key: string): string[] | null {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.value;
}

export function setCachedCaptions(key: string, value: string[]): void {
  prune();
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function makeCaptionCacheKey(input: { imageUrls?: string[]; imageUrl?: string; bio?: string; tone?: string; length?: string; starterText?: string }): string {
  const urls = input.imageUrls?.length ? input.imageUrls.join(",") : (input.imageUrl ?? "");
  const parts = [urls, input.bio ?? "", input.tone ?? "", input.length ?? "", input.starterText ?? ""];
  return "caption:" + parts.join("|");
}

export function getCachedSuggestion(key: string): string | null {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  const v = entry.value;
  return Array.isArray(v) && v.length > 0 ? v[0] : null;
}

export function setCachedSuggestion(key: string, value: string): void {
  prune();
  cache.set(key, { value: [value], expiresAt: Date.now() + TTL_MS });
}

export function makeSuggestionCacheKey(input: { recentMessages: { role: string; content: string }[]; fanName?: string; tone?: string; wrappingUp?: boolean }): string {
  const last = input.recentMessages.slice(-3).map((m) => m.role + ":" + m.content).join(";");
  return "suggestion:" + (input.fanName ?? "") + "|" + (input.tone ?? "") + "|" + (input.wrappingUp ? "wrap" : "") + "|" + last;
}
