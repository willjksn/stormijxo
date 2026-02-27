"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "../../../lib/firebase";
import {
  ensureConversation,
  subscribeMessages,
  sendMessage,
  type MessageDoc,
} from "../../../lib/dms";
import { NOTIFICATIONS_COLLECTION } from "../../../lib/notifications";
import { useAuth } from "../../contexts/AuthContext";

function formatMessageTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatMessageDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function MemberDmsPage() {
  const { user } = useAuth();
  const db = getFirebaseDb();
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!db || !user?.uid) return;
    let unsub: (() => void) | null = null;
    ensureConversation(db, user.uid, user.email ?? null, user.displayName ?? null).then(() => {
      unsub = subscribeMessages(db, user.uid, (list) => {
        setMessages(list);
        setTimeout(scrollToBottom, 100);
      });
    });
    return () => {
      if (unsub) unsub();
    };
  }, [db, user?.uid, user?.email, user?.displayName, scrollToBottom]);

  const createNotificationForAdmin = useCallback(
    async (body: string) => {
      if (!db) return;
      await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
        forAdmin: true,
        type: "dm",
        title: "New message",
        body,
        link: "/admin/dms",
        read: false,
        createdAt: serverTimestamp(),
      });
    },
    [db]
  );

  const handleSend = useCallback(async () => {
    if (!db || !user || !text.trim()) return;
    setSending(true);
    try {
      await sendMessage(db, user.uid, user.uid, user.email ?? null, text.trim());
      await createNotificationForAdmin(
        (user.displayName || user.email || "A member") + ": " + text.trim().slice(0, 60) + (text.length > 60 ? "…" : "")
      );
      setText("");
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }, [db, user, text, createNotificationForAdmin]);

  const messagesWithDates = useMemo(() => {
    type Item = { type: "date"; date: Date } | { type: "message"; message: MessageDoc };
    const out: Item[] = [];
    let lastDate: string | null = null;
    for (const m of messages) {
      const d = m.createdAt;
      const dateKey = d ? formatMessageDate(d) : null;
      if (dateKey && dateKey !== lastDate) {
        lastDate = dateKey;
        out.push({ type: "date", date: d! });
      }
      out.push({ type: "message", message: m });
    }
    return out;
  }, [messages]);

  if (!user) {
    return (
      <main className="member-main" style={{ padding: "2rem" }}>
        <p>Please sign in to view messages.</p>
        <Link href="/login" style={{ color: "var(--accent)" }}>Sign in</Link>
      </main>
    );
  }

  return (
    <main className="member-main" style={{ padding: "1rem", height: "calc(100vh - var(--header-height, 80px) - 2rem)", minHeight: 420, display: "flex", flexDirection: "column", maxWidth: 800, margin: "0 auto" }}>
      <div className="chat-page" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="chat-thread" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div className="chat-thread-header">
            <span className="chat-thread-avatar">C</span>
            <h1 className="chat-thread-name" style={{ margin: 0, fontSize: "1.1rem" }}>Messages</h1>
          </div>
          <div className="chat-messages">
            {messages.length === 0 && !sending && (
              <p className="chat-empty-state">No messages yet. Say hi below.</p>
            )}
            {messagesWithDates.map((item, i) =>
              item.type === "date" ? (
                <div key={`date-${i}`} className="chat-date-separator"><span>{formatMessageDate(item.date)}</span></div>
              ) : (
                <div key={item.message.id} className={`chat-bubble ${item.message.senderId === user?.uid ? "me" : "them"}`}>
                  {item.message.text ? <span style={{ whiteSpace: "pre-wrap" }}>{item.message.text}</span> : null}
                  {item.message.imageUrls.length > 0 && (
                    <div className="chat-bubble-images">
                      {item.message.imageUrls.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="" /></a>
                      ))}
                    </div>
                  )}
                  {item.message.videoUrls.length > 0 && (
                    <div className="chat-bubble-videos">
                      {item.message.videoUrls.map((url) => <video key={url} src={url} controls />)}
                    </div>
                  )}
                  {item.message.createdAt && (
                    <span className="chat-bubble-time">
                      {formatMessageTime(item.message.createdAt)}
                      {item.message.senderId === user?.uid && <CheckIcon />}
                    </span>
                  )}
                </div>
              )
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input-bar">
            <input
              type="text"
              className="chat-input-field"
              placeholder="Message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            />
            <button type="button" className="send-btn" onClick={handleSend} disabled={sending || !text.trim()}>{sending ? "…" : "Send"}</button>
          </div>
        </div>
      </div>
    </main>
  );
}
