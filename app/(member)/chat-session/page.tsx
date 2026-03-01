"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { collection, doc, onSnapshot, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb, getFirebaseStorage } from "../../../lib/firebase";
import {
  CHAT_SESSIONS_COLLECTION,
  chatSessionFromDoc,
  type ChatSessionDoc,
} from "../../../lib/chat-sessions";
import { ensureConversation, subscribeMessages, sendMessage, subscribeMediaUnlocks, uploadDmFile, getNewMessageRef, type MessageDoc } from "../../../lib/dms";
import { useAuth } from "../../contexts/AuthContext";

function formatSessionTime(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatMessageTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function ChatSessionPage() {
  const { user } = useAuth();
  const db = getFirebaseDb();
  const [sessions, setSessions] = useState<ChatSessionDoc[]>([]);
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlockedKeys, setUnlockedKeys] = useState<Set<string>>(new Set());
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showUnlockedBanner, setShowUnlockedBanner] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  const emailNorm = user?.email?.trim().toLowerCase() ?? "";

  useEffect(() => {
    if (!db || !emailNorm) {
      setSessions([]);
      return;
    }
    const q = query(
      collection(db, CHAT_SESSIONS_COLLECTION),
      where("memberEmail", "==", emailNorm)
    );
    return onSnapshot(
      q,
      (snap) => {
        const list: ChatSessionDoc[] = [];
        snap.forEach((d) => {
          const parsed = chatSessionFromDoc(d.id, d.data() as Record<string, unknown>);
          if (parsed) list.push(parsed);
        });
        list.sort((a, b) => {
          const ta = a.scheduledStart?.getTime() ?? 0;
          const tb = b.scheduledStart?.getTime() ?? 0;
          return tb - ta;
        });
        setSessions(list);
      },
      () => setSessions([])
    );
  }, [db, emailNorm]);

  const now = Date.now();
  const FIVE_MIN_MS = 5 * 60 * 1000;
  const activeSession = sessions.find((s) => {
    const start = s.scheduledStart?.getTime() ?? 0;
    const windowStart = start - FIVE_MIN_MS;
    const end = start + s.durationMinutes * 60 * 1000;
    return windowStart <= now && now < end && s.status !== "ended";
  });
  const upcomingSession = sessions.find((s) => {
    const start = s.scheduledStart?.getTime() ?? 0;
    const windowStart = start - FIVE_MIN_MS;
    return now < windowStart && s.status !== "ended";
  });
  const conversationId = activeSession?.conversationId ?? user?.uid ?? "";
  const sessionStartedByCreator = !!activeSession?.startedAt;

  const needsLink = activeSession && conversationId !== user?.uid && !!user?.uid;

  useEffect(() => {
    if (!db || !user?.uid || !activeSession) {
      setMessages([]);
      return;
    }
    const cid = activeSession.conversationId === user.uid ? user.uid : null;
    if (!cid) return;
    const unsub = subscribeMessages(db, cid, (list) => {
      setMessages(list);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsub();
  }, [db, user?.uid, activeSession?.id, activeSession?.conversationId]);

  useEffect(() => {
    if (!db || !user?.uid || !activeSession) {
      setUnlockedKeys(new Set());
      return;
    }
    const cid = activeSession.conversationId === user.uid ? user.uid : activeSession.conversationId;
    if (!cid) return;
    return subscribeMediaUnlocks(db, cid, user.uid, setUnlockedKeys);
  }, [db, user?.uid, activeSession?.id, activeSession?.conversationId]);

  useEffect(() => {
    if (searchParams.get("unlocked") === "1") {
      setShowUnlockedBanner(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("unlocked");
      window.history.replaceState({}, "", url.pathname + url.search || "/chat-session");
      const t = setTimeout(() => setShowUnlockedBanner(false), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  const linkSessionToMe = useCallback(async () => {
    if (!db || !user?.uid || !activeSession || activeSession.conversationId === user.uid) return;
    setLinking(true);
    try {
      await updateDoc(doc(db, CHAT_SESSIONS_COLLECTION, activeSession.id), {
        conversationId: user.uid,
        updatedAt: serverTimestamp(),
      });
      await ensureConversation(db, user.uid, user.email ?? null, user.displayName ?? null);
    } catch {
      // ignore
    } finally {
      setLinking(false);
    }
  }, [db, user?.uid, user?.email, user?.displayName, activeSession]);

  useEffect(() => {
    if (needsLink && !linking && user?.uid) {
      linkSessionToMe();
    }
  }, [needsLink, linking, user?.uid, linkSessionToMe]);

  const handleSend = useCallback(async () => {
    const t = text.trim();
    const cid = activeSession?.conversationId === user?.uid ? user?.uid : activeSession?.conversationId;
    if ((!t && !pendingFile) || !db || !user?.uid || !activeSession || !cid) return;
    setSending(true);
    setText("");
    const fileToSend = pendingFile;
    setPendingFile(null);
    try {
      if (fileToSend) {
        const storage = getFirebaseStorage();
        if (storage) {
          const { id: messageId } = getNewMessageRef(db, cid);
          const url = await uploadDmFile(storage, cid, messageId, fileToSend);
          const isVideo = fileToSend.type.startsWith("video/");
          await sendMessage(
            db,
            cid,
            user.uid,
            user.email ?? null,
            t || "",
            isVideo ? [] : [url],
            isVideo ? [url] : [],
            [],
            undefined,
            messageId
          );
        } else {
          await sendMessage(db, cid, user.uid, user.email ?? null, t || "");
        }
      } else {
        await sendMessage(db, cid, user.uid, user.email ?? null, t);
      }
    } finally {
      setSending(false);
    }
  }, [text, pendingFile, db, user?.uid, user?.email, activeSession]);

  if (!user) {
    return (
      <main className="member-main" style={{ padding: "2rem" }}>
        <p>Please sign in to view your chat session.</p>
        <Link href="/login" className="btn btn-primary" style={{ marginTop: "1rem" }}>
          Sign in
        </Link>
      </main>
    );
  }

  if (activeSession) {
    const endAt = (activeSession.scheduledStart?.getTime() ?? 0) + activeSession.durationMinutes * 60 * 1000;
    const minutesLeft = Math.max(0, Math.floor((endAt - now) / 60000));

    return (
      <main className="member-main" style={{ padding: "1rem", maxWidth: 640, margin: "0 auto" }}>
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 16,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            height: "calc(100vh - 120px)",
            minHeight: 360,
          }}
        >
          <header
            style={{
              padding: "0.75rem 1rem",
              background: "var(--bg-card)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Live chat</h1>
            <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
              {sessionStartedByCreator ? `${minutesLeft} min left` : "Waiting to start…"}
            </span>
          </header>
          {showUnlockedBanner && (
            <div
              role="alert"
              style={{
                padding: "0.6rem 1rem",
                background: "var(--accent-soft)",
                borderBottom: "1px solid var(--accent)",
                fontSize: "0.9rem",
                color: "var(--text)",
              }}
            >
              Payment successful. Content unlocked.
            </div>
          )}
          {!sessionStartedByCreator && (
            <div
              style={{
                padding: "0.75rem 1rem",
                background: "rgba(217, 119, 6, 0.1)",
                borderBottom: "1px solid var(--border)",
                fontSize: "0.9rem",
              }}
            >
              Your chat window is open. The creator will start the session soon — you&apos;ll get a notification when it&apos;s live.
            </div>
          )}
          {activeSession.conversationId !== user.uid && sessionStartedByCreator && (
            <div
              style={{
                padding: "0.75rem 1rem",
                background: "rgba(34, 197, 94, 0.1)",
                borderBottom: "1px solid var(--border)",
                fontSize: "0.9rem",
              }}
            >
              {linking ? "Connecting your chat…" : "Your chat is ready. Send a message below."}
            </div>
          )}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {messages.length === 0 && !sending && sessionStartedByCreator && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: "1rem 0" }}>
                No messages yet. Say hi!
              </p>
            )}
            {messages.length === 0 && !sending && !sessionStartedByCreator && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: "1rem 0" }}>
                Waiting for the creator to start the session. You can stay on this page — you&apos;ll be notified when it&apos;s live.
              </p>
            )}
            {messages.map((m) => {
              const isMe = m.senderId === user.uid;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: isMe ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: 12,
                    background: isMe ? "var(--accent-soft)" : "var(--bg-card)",
                    border: `1px solid ${isMe ? "var(--accent)" : "var(--border)"}`,
                  }}
                >
                  {m.text ? (
                    <p style={{ margin: 0, fontSize: "0.9rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {m.text}
                    </p>
                  ) : null}
                  {m.imageUrls?.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: "0.25rem" }}>
                      <img src={url} alt="" style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8, objectFit: "contain" }} />
                    </a>
                  ))}
                  {m.videoUrls?.map((url, i) => (
                    <video key={i} src={url} controls style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8, marginTop: "0.25rem" }} />
                  ))}
                  {m.lockedMedia?.map((item, i) => {
                    const key = `${m.id}:${item.unlockId}`;
                    const unlocked = unlockedKeys.has(key);
                    const price = (item.priceCents / 100).toFixed(2);
                    return (
                      <div key={i} style={{ marginTop: "0.25rem", position: "relative" }}>
                        {unlocked ? (
                          item.type === "image" ? (
                            <img src={item.url} alt="" style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8, objectFit: "contain" }} />
                          ) : (
                            <video src={item.url} controls style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8 }} />
                          )
                        ) : (
                          <>
                            <div
                              style={{
                                background: `url(${item.url}) center/cover`,
                                width: "100%",
                                minHeight: 160,
                                maxHeight: 280,
                                borderRadius: 8,
                                filter: "blur(20px)",
                                pointerEvents: "none",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "0.5rem",
                                borderRadius: 8,
                                background: "rgba(0,0,0,0.4)",
                              }}
                            >
                              <span style={{ color: "#fff", fontSize: "0.9rem" }}>Tip ${price} to unlock</span>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ fontSize: "0.85rem" }}
                                onClick={async () => {
                                  try {
                                    const res = await fetch("/api/unlock-dm-media", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        conversationId: activeSession.conversationId === user.uid ? user.uid : activeSession.conversationId,
                                        messageId: m.id,
                                        unlockId: item.unlockId,
                                        uid: user.uid,
                                        priceCents: item.priceCents,
                                      }),
                                    });
                                    const data = await res.json();
                                    if (data?.url) window.location.href = data.url;
                                  } catch {
                                    // ignore
                                  }
                                }}
                              >
                                Tip ${price}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {m.createdAt && (
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {formatMessageTime(m.createdAt)}
                    </p>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div
            style={{
              padding: "0.75rem 1rem",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-card)",
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && (f.type.startsWith("image/") || f.type.startsWith("video/"))) {
                    setPendingFile(f);
                    e.target.value = "";
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "0.5rem 0.75rem" }}
                onClick={() => fileInputRef.current?.click()}
                disabled={!sessionStartedByCreator}
                aria-label="Attach image or video"
              >
                📎
              </button>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={sessionStartedByCreator ? "Type your message..." : "Waiting for session to start..."}
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: "0.6rem 0.75rem",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  fontSize: "1rem",
                }}
                aria-label="Message"
                disabled={!sessionStartedByCreator}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={sending || (!text.trim() && !pendingFile) || !sessionStartedByCreator}
              >
                {sending ? "…" : "Send"}
              </button>
              {pendingFile && (
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginLeft: "0.25rem" }}>
                  {pendingFile.name}
                </span>
              )}
            </form>
          </div>
        </div>
      </main>
    );
  }

  if (upcomingSession?.scheduledStart) {
    return (
      <main className="member-main" style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Chat session</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
          Your live chat is scheduled for:
        </p>
        <p style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: "1rem" }}>
          {formatSessionTime(upcomingSession.scheduledStart)}
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
          When it&apos;s time, this page will show the chat. You can also get a notification — check your Treats or
          notifications.
        </p>
        <Link href="/treats" className="btn btn-secondary" style={{ marginTop: "1.5rem" }}>
          Back to Treats
        </Link>
      </main>
    );
  }

  return (
    <main className="member-main" style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Chat session</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
        You don&apos;t have an upcoming live chat. Purchase a chat session from the Treats store; after we agree on a
        date and time, you&apos;ll see the chat here when it starts.
      </p>
      <Link href="/treats" className="btn btn-primary">
        Go to Treats
      </Link>
    </main>
  );
}
