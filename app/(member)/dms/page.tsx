"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { collection, doc, getDoc, addDoc, serverTimestamp, query, where, getDocs, updateDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseStorage } from "../../../lib/firebase";
import {
  ensureConversation,
  subscribeMessages,
  sendMessage,
  uploadDmFile,
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

function useInitials(displayName: string | null, email: string | null): string {
  if (displayName?.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      const init = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      if (/[A-Z0-9]/i.test(init)) return init.slice(0, 2);
    }
    const first = parts[0][0]?.toUpperCase();
    if (first) return first.slice(0, 2);
  }
  if (email?.trim()) {
    const c = email.trim()[0].toUpperCase();
    if (/[A-Z0-9]/i.test(c)) return c;
  }
  return "?";
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

export default function MemberDmsPage() {
  const { user } = useAuth();
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFilesCount, setSelectedFilesCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [convError, setConvError] = useState<string | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingCountdown, setRecordingCountdown] = useState<number | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaRecorderStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const countdownIntervalRef = useRef<number | null>(null);
  const recentRecordingStopAtRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = useInitials(user?.displayName ?? null, user?.email ?? null);
  const avatarUrl = profileAvatarUrl ?? user?.photoURL ?? null;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!db || !user?.uid) return;
    setConvError(null);
    let unsub: (() => void) | null = null;
    ensureConversation(db, user.uid, user.email ?? null, user.displayName ?? null)
      .then(() => {
        unsub = subscribeMessages(db, user.uid, (list) => {
          setMessages(list);
          setTimeout(scrollToBottom, 100);
        });
      })
      .catch((e) => {
        setConvError((e instanceof Error ? e.message : String(e)) || "Could not load messages.");
      });
    return () => {
      if (unsub) unsub();
    };
  }, [db, user?.uid, user?.email, user?.displayName, scrollToBottom]);

  useEffect(() => {
    if (!db || !user?.uid) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const url = (data?.avatarUrl ?? null) as string | null;
        setProfileAvatarUrl(url || null);
      }
    }).catch(() => {});
  }, [db, user?.uid]);

  useEffect(() => {
    if (!db || !user?.email) return;
    const unreadMemberDmQ = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("forMemberEmail", "==", user.email.trim().toLowerCase()),
      where("type", "==", "dm"),
      where("read", "==", false)
    );
    getDocs(unreadMemberDmQ)
      .then((snap) => Promise.all(snap.docs.map((d) => updateDoc(doc(db, NOTIFICATIONS_COLLECTION, d.id), { read: true }))))
      .catch(() => {});
  }, [db, user?.email]);

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

  const stopRecordingTracks = useCallback(() => {
    mediaRecorderStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current != null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setRecordingCountdown(null);
  }, []);

  const toggleVoiceRecording = useCallback(async () => {
    if (!db || !user || !storage) {
      setError("Voice recording is not available right now.");
      return;
    }
    if (!isRecording) {
      if (Date.now() - recentRecordingStopAtRef.current < 1200) return;
      if (recordingCountdown != null) {
        clearCountdown();
        return;
      }
      try {
        setRecordingCountdown(3);
        setError(null);
        let remaining = 3;
        countdownIntervalRef.current = window.setInterval(async () => {
          remaining -= 1;
          if (remaining > 0) {
            setRecordingCountdown(remaining);
            return;
          }
          clearCountdown();
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
              ? "audio/webm;codecs=opus"
              : "";
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderStreamRef.current = stream;
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            recorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
            };
            recorder.onstop = async () => {
              try {
                const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
                if (!blob.size) throw new Error("No audio captured.");
                const ext = recorder.mimeType.includes("ogg") ? "ogg" : "webm";
                const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: recorder.mimeType || "audio/webm" });
                const audioUrl = await uploadDmFile(storage, user.uid, `voice-${Date.now()}`, file);
                await sendMessage(db, user.uid, user.uid, user.email ?? null, "", [], [], [audioUrl]);
                await createNotificationForAdmin("New voice message from member.");
                setError(null);
              } catch (e) {
                setError((e as Error)?.message ?? "Failed to send voice message.");
              } finally {
                stopRecordingTracks();
                setIsRecording(false);
              }
            };
            recorder.start();
            setIsRecording(true);
          } catch (e) {
            setError((e as Error)?.message ?? "Microphone access denied.");
            stopRecordingTracks();
          }
        }, 1000);
      } catch (e) {
        setError((e as Error)?.message ?? "Microphone access denied.");
        stopRecordingTracks();
      }
      return;
    }
    recentRecordingStopAtRef.current = Date.now();
    mediaRecorderRef.current?.stop();
  }, [db, user, storage, isRecording, recordingCountdown, createNotificationForAdmin, stopRecordingTracks, clearCountdown]);

  useEffect(() => {
    return () => {
      clearCountdown();
      stopRecordingTracks();
    };
  }, [stopRecordingTracks, clearCountdown]);

  const handleSend = useCallback(async () => {
    if (!db || !user) return;
    const hasText = text.trim().length > 0;
    const hasFiles = selectedFilesCount > 0;
    if (!hasText && !hasFiles) return;
    setSending(true);
    setError(null);
    try {
      if (hasFiles) {
        if (!storage) {
          throw new Error("File upload is not available right now. Please refresh and try again.");
        }
        setUploading(true);
        const files = fileInputRef.current?.files;
        if (!files || files.length === 0) {
          throw new Error("No files were selected.");
        }
        const imageUrls: string[] = [];
        const videoUrls: string[] = [];
        const audioUrls: string[] = [];
        const placeholderRef = await addDoc(collection(db, "conversations", user.uid, "messages"), {
          senderId: user.uid,
          senderEmail: user.email ?? null,
          text: text.trim(),
          imageUrls: [],
          videoUrls: [],
          audioUrls: [],
          createdAt: serverTimestamp(),
        });
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const url = await uploadDmFile(storage, user.uid, placeholderRef.id, file);
          if (file.type.startsWith("video/")) videoUrls.push(url);
          else imageUrls.push(url);
        }
        await updateDoc(placeholderRef, { imageUrls, videoUrls, audioUrls });
        await updateDoc(doc(db, "conversations", user.uid), {
          updatedAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(),
          lastMessagePreview: text.trim() || "(attachment)",
        });
        await createNotificationForAdmin(
          text.trim()
            ? (user.displayName || user.email || "A member") + ": " + text.trim().slice(0, 60) + (text.length > 60 ? "…" : "")
            : "New attachment from member."
        );
        setText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSelectedFilesCount(0);
        return;
      }
      await sendMessage(db, user.uid, user.uid, user.email ?? null, text.trim());
      await createNotificationForAdmin(
        (user.displayName || user.email || "A member") + ": " + text.trim().slice(0, 60) + (text.length > 60 ? "…" : "")
      );
      setText("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Failed to send.");
    } finally {
      setSending(false);
      setUploading(false);
    }
  }, [db, user, text, selectedFilesCount, storage, createNotificationForAdmin]);

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
    <main
      className="member-main"
      style={{
        padding: "1rem",
        height: "calc(min(100vh, 100dvh) - var(--header-height, 80px) - 2rem)",
        minHeight: 420,
        display: "flex",
        flexDirection: "column",
        maxWidth: 800,
        margin: "0 auto",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div className="chat-page" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
        <div className="chat-thread" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          <div className="chat-thread-header">
            {avatarUrl ? (
              <span className="chat-thread-avatar">
                <img src={avatarUrl} alt="" />
              </span>
            ) : (
              <span className="chat-thread-avatar" aria-hidden>{initials}</span>
            )}
            <h1 className="chat-thread-name" style={{ margin: 0, fontSize: "1.1rem" }}>Messages</h1>
          </div>
          {convError && (
            <p style={{ padding: "0.75rem 1rem", margin: 0, background: "rgba(200,0,0,0.1)", color: "var(--text)", borderRadius: 8, fontSize: "0.9rem" }}>
              {convError}
            </p>
          )}
          <div className="chat-messages" style={{ maxHeight: "none", minHeight: 0, overflowY: "auto" }}>
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
                        <button
                          key={url}
                          type="button"
                          onClick={() => setMediaPreview({ url, type: "image" })}
                          style={{ border: "none", background: "transparent", padding: 0, cursor: "zoom-in" }}
                        >
                          <img src={url} alt="" onContextMenu={(e) => e.preventDefault()} draggable={false} />
                        </button>
                      ))}
                    </div>
                  )}
                  {item.message.videoUrls.length > 0 && (
                    <div className="chat-bubble-videos">
                      {item.message.videoUrls.map((url) => (
                        <video
                          key={url}
                          src={url}
                          controls
                          playsInline
                          preload="metadata"
                          controlsList="nodownload noplaybackrate noremoteplayback"
                          disablePictureInPicture
                          onContextMenu={(e) => e.preventDefault()}
                        />
                      ))}
                    </div>
                  )}
                  {item.message.audioUrls.length > 0 && (
                    <div className="chat-bubble-videos">
                      {item.message.audioUrls.map((url) => (
                        <audio
                          key={url}
                          src={url}
                          controls
                          controlsList="nodownload noplaybackrate noremoteplayback"
                          onContextMenu={(e) => e.preventDefault()}
                          style={{ width: "100%" }}
                        />
                      ))}
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
              type="file"
              ref={fileInputRef}
              accept="image/*,video/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                setSelectedFilesCount(e.target.files?.length ?? 0);
                setError(null);
              }}
            />
            <button type="button" className="icon-btn" onClick={() => fileInputRef.current?.click()} disabled={sending || uploading} title="Photo / video">
              <ImageIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={toggleVoiceRecording}
              disabled={sending || uploading}
              title={isRecording ? "Stop recording" : "Record voice message"}
              style={isRecording ? { color: "var(--error, #c53030)" } : undefined}
            >
              <MicIcon />
            </button>
            <input
              type="text"
              className="chat-input-field"
              placeholder="Message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            />
            <button type="button" className="send-btn" onClick={handleSend} disabled={sending || uploading || (!text.trim() && selectedFilesCount === 0)}>{sending ? "…" : "Send"}</button>
          </div>
          {selectedFilesCount > 0 && (
            <p style={{ padding: "0.25rem 1rem", margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {selectedFilesCount} file{selectedFilesCount === 1 ? "" : "s"} selected
            </p>
          )}
          {uploading && (
            <p style={{ padding: "0.25rem 1rem", margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Uploading attachment{selectedFilesCount === 1 ? "" : "s"}…
            </p>
          )}
          {isRecording && (
            <p style={{ padding: "0.25rem 1rem", margin: 0, fontSize: "0.85rem", color: "var(--error, #c53030)" }}>
              Recording voice… tap mic again to send.
            </p>
          )}
          {recordingCountdown != null && (
            <p style={{ padding: "0.25rem 1rem", margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Recording starts in {recordingCountdown}…
            </p>
          )}
          {error && (
            <p style={{ padding: "0.5rem 1rem", margin: 0, fontSize: "0.85rem", color: "var(--text)", background: "rgba(200,0,0,0.1)", borderRadius: 8 }}>
              {error}
            </p>
          )}
        </div>
      </div>
      {mediaPreview && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setMediaPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 120,
            padding: "1rem",
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "min(760px, 92vw)", width: "100%" }}>
            {mediaPreview.type === "image" ? (
              <img
                src={mediaPreview.url}
                alt=""
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
                style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 10, display: "block", background: "#111" }}
              />
            ) : (
              <video
                src={mediaPreview.url}
                controls
                controlsList="nodownload noplaybackrate noremoteplayback"
                disablePictureInPicture
                onContextMenu={(e) => e.preventDefault()}
                style={{ width: "100%", maxHeight: "70vh", borderRadius: 10, display: "block", background: "#111" }}
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
