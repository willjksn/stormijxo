/**
 * Chat session summaries: per-fan summary/preferences for "pick back up" and AI context.
 * One doc per creator+fan (conversationId). Updated when a session ends.
 * Used when the same fan has another session: load summary and pass to AI as fan_session_context.
 */

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

export const CHAT_SESSION_SUMMARIES_COLLECTION = "chatSessionSummaries";

const MAX_SUMMARY_LENGTH = 2000;
const MAX_PREFERENCES_LENGTH = 1000;
const LAST_SESSION_SUMMARIES_MAX = 3;

export type SessionSummaryEntry = {
  endedAt: string;
  summary: string;
};

export type ChatSessionSummaryDoc = {
  id: string;
  creatorUid: string;
  conversationId: string;
  memberEmail: string | null;
  memberName: string | null;
  /** Last time a session with this fan ended. */
  lastSessionEndedAt: Date | null;
  /** Short summary of last session or "what the fan likes" for AI context. */
  summary: string | null;
  /** Optional: what the fan likes / preferences (for AI personalization). */
  preferences: string | null;
  /** Number of messages in the conversation at last session end (for reference). */
  messageCountAtEnd: number | null;
  /** Last 3 session summaries (newest last). */
  lastSessionSummaries: SessionSummaryEntry[];
  updatedAt: Date | null;
};

function parseTimestamp(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  const d = (v as { toDate?: () => Date })?.toDate?.();
  return d && d instanceof Date ? d : null;
}

export function summaryFromDoc(
  id: string,
  data: Record<string, unknown>
): ChatSessionSummaryDoc {
  const rawSummaries = Array.isArray(data.lastSessionSummaries) ? data.lastSessionSummaries : [];
  const lastSessionSummaries: SessionSummaryEntry[] = rawSummaries
    .filter((e: unknown) => e && typeof e === "object" && "endedAt" in e && "summary" in e)
    .map((e: Record<string, unknown>) => ({
      endedAt: String(e.endedAt ?? ""),
      summary: String(e.summary ?? "").trim().slice(0, MAX_SUMMARY_LENGTH),
    }))
    .filter((e) => e.summary)
    .slice(-LAST_SESSION_SUMMARIES_MAX);
  return {
    id,
    creatorUid: (data.creatorUid as string) ?? "",
    conversationId: (data.conversationId as string) ?? "",
    memberEmail: data.memberEmail != null ? String(data.memberEmail) : null,
    memberName: data.memberName != null ? String(data.memberName) : null,
    lastSessionEndedAt: parseTimestamp(data.lastSessionEndedAt),
    summary:
      typeof data.summary === "string"
        ? data.summary.trim().slice(0, MAX_SUMMARY_LENGTH)
        : null,
    preferences:
      typeof data.preferences === "string"
        ? data.preferences.trim().slice(0, MAX_PREFERENCES_LENGTH)
        : null,
    messageCountAtEnd:
      typeof data.messageCountAtEnd === "number" ? data.messageCountAtEnd : null,
    lastSessionSummaries,
    updatedAt: parseTimestamp(data.updatedAt),
  };
}

/** Doc id: one per creator+fan so we can query by creatorUid or conversationId. */
export function summaryDocId(creatorUid: string, conversationId: string): string {
  return `${creatorUid}_${conversationId}`;
}

export async function getChatSessionSummary(
  db: Firestore,
  creatorUid: string,
  conversationId: string
): Promise<ChatSessionSummaryDoc | null> {
  const ref = doc(
    db,
    CHAT_SESSION_SUMMARIES_COLLECTION,
    summaryDocId(creatorUid, conversationId)
  );
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return summaryFromDoc(snap.id, snap.data() as Record<string, unknown>);
}

export type SaveChatSessionSummaryInput = {
  creatorUid: string;
  conversationId: string;
  memberEmail?: string | null;
  memberName?: string | null;
  /** Optional: AI-generated or manual summary / "what the fan likes". */
  summary?: string | null;
  /** Optional: preferences for next session. */
  preferences?: string | null;
  messageCountAtEnd?: number | null;
};

export async function saveChatSessionSummary(
  db: Firestore,
  input: SaveChatSessionSummaryInput
): Promise<void> {
  const ref = doc(
    db,
    CHAT_SESSION_SUMMARIES_COLLECTION,
    summaryDocId(input.creatorUid, input.conversationId)
  );
  const existing = await getDoc(ref).then((s) =>
    s.exists() ? (s.data() as Record<string, unknown>) : null
  );
  const existingSummaries: SessionSummaryEntry[] = Array.isArray(existing?.lastSessionSummaries)
    ? (existing.lastSessionSummaries as SessionSummaryEntry[]).filter(
        (e) => e && typeof e.endedAt === "string" && typeof e.summary === "string"
      )
    : [];
  const newSummary =
    typeof input.summary === "string"
      ? input.summary.trim().slice(0, MAX_SUMMARY_LENGTH)
      : (existing?.summary as string) ?? null;
  const nextEntry: SessionSummaryEntry | null =
    newSummary
      ? { endedAt: new Date().toISOString(), summary: newSummary }
      : null;
  const lastSessionSummaries = nextEntry
    ? [...existingSummaries, nextEntry].slice(-LAST_SESSION_SUMMARIES_MAX)
    : existingSummaries.slice(-LAST_SESSION_SUMMARIES_MAX);
  const summary = newSummary ?? (existing?.summary as string) ?? null;
  const preferences =
    typeof input.preferences === "string"
      ? input.preferences.trim().slice(0, MAX_PREFERENCES_LENGTH)
      : (existing?.preferences as string) ?? null;
  await setDoc(ref, {
    creatorUid: input.creatorUid,
    conversationId: input.conversationId,
    memberEmail: input.memberEmail ?? existing?.memberEmail ?? null,
    memberName: input.memberName ?? existing?.memberName ?? null,
    lastSessionEndedAt: serverTimestamp(),
    summary: summary || null,
    preferences: preferences || null,
    messageCountAtEnd:
      typeof input.messageCountAtEnd === "number"
        ? input.messageCountAtEnd
        : existing?.messageCountAtEnd ?? null,
    lastSessionSummaries,
    updatedAt: serverTimestamp(),
  });
}
