/**
 * Rate limit for Premium Studio API routes.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL and TOKEN are set; otherwise in-memory fallback.
 */

const DEFAULT_LIMIT = 60; // requests per window
const WINDOW_MS = 60_000; // 1 minute

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function getKey(identifier: string, prefix: string): string {
  return `studio:${prefix}:${identifier}`;
}

async function upstashIncr(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { count: 0, resetAt: Date.now() + windowMs };
  const now = Date.now();
  const windowKey = `${key}:${Math.floor(now / windowMs)}`;
  const res = await fetch(`${url}/incr/${windowKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { count: 0, resetAt: now + windowMs };
  const data = (await res.json()) as { result?: number };
  const count = typeof data.result === "number" ? data.result : 0;
  return { count, resetAt: (Math.floor(now / windowMs) + 1) * windowMs };
}

function memoryIncr(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = memoryStore.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    memoryStore.set(key, entry);
  } else {
    entry.count += 1;
  }
  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);
  return { allowed, remaining, resetAt: entry.resetAt };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

export async function rateLimit(
  identifier: string,
  prefix: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = WINDOW_MS
): Promise<RateLimitResult> {
  const key = getKey(identifier, prefix);
  const useUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (useUpstash) {
    const { count, resetAt } = await upstashIncr(key, windowMs);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
      resetAt,
    };
  }
  const { allowed, remaining, resetAt } = memoryIncr(key, limit, windowMs);
  return { allowed, remaining, limit, resetAt };
}
