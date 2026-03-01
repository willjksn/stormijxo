/**
 * Scheduled chat sessions: time-gated live chat between creator and fan.
 * - Fan buys "Chat Session" treat → purchase created.
 * - Admin schedules the purchase (date/time) → chatSession doc created.
 * - During the time window, fan sees the chat at /chat-session; when it ends, access is removed.
 * No third-party chat API: uses existing Firestore DMs (conversations/{conversationId}/messages).
 */

export const CHAT_SESSIONS_COLLECTION = "chatSessions";

export type ChatSessionStatus = "scheduled" | "active" | "ended";

export type ChatSessionDoc = {
  id: string;
  purchaseId: string | null;
  /** Conversation id (same as conversations/{id}) — used for DMs. */
  conversationId: string;
  memberEmail: string | null;
  memberName: string | null;
  scheduledStart: Date | null;
  /** When the creator started the session; null = waiting for creator to start. */
  startedAt: Date | null;
  durationMinutes: number;
  status: ChatSessionStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export function chatSessionFromDoc(
  id: string,
  data: Record<string, unknown>
): ChatSessionDoc | null {
  if (!data) return null;
  const scheduledStart = (data.scheduledStart as { toDate?: () => Date })?.toDate?.() ?? null;
  const startedAt = (data.startedAt as { toDate?: () => Date })?.toDate?.() ?? null;
  const createdAt = (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? null;
  const updatedAt = (data.updatedAt as { toDate?: () => Date })?.toDate?.() ?? null;
  const status = (data.status as ChatSessionStatus) || "scheduled";
  return {
    id,
    purchaseId: data.purchaseId != null ? String(data.purchaseId) : null,
    conversationId: (data.conversationId ?? data.memberId ?? "").toString(),
    memberEmail: data.memberEmail != null ? String(data.memberEmail).trim().toLowerCase() : null,
    memberName: data.memberName != null ? String(data.memberName) : null,
    scheduledStart,
    startedAt,
    durationMinutes: typeof data.durationMinutes === "number" ? data.durationMinutes : 15,
    status: status === "active" ? "active" : status === "ended" ? "ended" : "scheduled",
    createdAt,
    updatedAt,
  };
}

/** Treat id prefix that identifies a chat-session product (e.g. chat-session-15, chat-session-30). */
export const CHAT_SESSION_TREAT_PREFIX = "chat-session";

export function isChatSessionTreatId(treatId: string | null): boolean {
  return typeof treatId === "string" && treatId.startsWith(CHAT_SESSION_TREAT_PREFIX);
}

/** Parse duration from treat id like "chat-session-15" -> 15. */
export function parseChatSessionDurationMinutes(treatId: string): number {
  const after = treatId.replace(/^chat-session-?/i, "").trim();
  const num = parseInt(after, 10);
  return Number.isFinite(num) && num > 0 ? Math.min(120, num) : 15;
}
