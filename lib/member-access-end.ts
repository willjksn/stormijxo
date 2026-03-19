import { Timestamp } from "firebase/firestore";

/** Parse Firestore Timestamp, Date, unix seconds/ms, ISO string, or plain { seconds } / { toDate }. */
export function parseDateLike(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Timestamp) {
    try {
      const d = value.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const asNum = Number(value);
    if (!Number.isNaN(asNum)) {
      const ms = asNum < 1e12 ? asNum * 1000 : asNum;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object") {
    const o = value as {
      toDate?: () => Date;
      _seconds?: number;
      seconds?: number;
    };
    if (typeof o.toDate === "function") {
      try {
        const d = o.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        /* ignore */
      }
    }
    const sec = typeof o.seconds === "number" ? o.seconds : typeof o._seconds === "number" ? o._seconds : null;
    if (sec != null && Number.isFinite(sec)) {
      const d = new Date(sec * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

/**
 * Latest non-null date among known fields. Fixes cases where `access_ends_at` was set to
 * canceled_at (past) but `current_period_end` still reflects real billing end.
 */
export function pickLatestMemberAccessEnd(d: Record<string, unknown>): Date | null {
  const keys = [
    "access_ends_at",
    "accessEndsAt",
    "current_period_end",
    "currentPeriodEnd",
  ] as const;
  let best: Date | null = null;
  for (const key of keys) {
    const parsed = parseDateLike(d[key]);
    if (!parsed) continue;
    if (!best || parsed.getTime() > best.getTime()) best = parsed;
  }
  return best;
}
