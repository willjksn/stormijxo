"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { collection, getDocsFromServer, addDoc, doc, getDoc, serverTimestamp, query, where, getDocs, updateDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseStorage } from "../../../../lib/firebase";
import {
  ensureConversation,
  subscribeConversations,
  subscribeMessages,
  sendMessage,
  uploadDmFile,
  setFirstMessageFlagIfFirst,
  type ConversationDoc,
  type MessageDoc,
} from "../../../../lib/dms";
import { NOTIFICATIONS_COLLECTION } from "../../../../lib/notifications";
import { useAuth } from "../../../contexts/AuthContext";
import { MemberProfileCard } from "../../components/MemberProfileCard";

type UserOption = { uid: string; email: string | null; displayName: string | null; memberId?: string };

function formatMessageTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatMessageDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatRelativeTime(d: Date | null): string {
  if (!d) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffWeeks < 4) return `${diffWeeks}w`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName?.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase().slice(0, 2);
    return (parts[0][0] ?? "?").toUpperCase();
  }
  if (email?.trim()) return email.trim()[0].toUpperCase();
  return "?";
}

function EnvelopeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function ThreeDotsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function AdminDmsPage() {
  const { user } = useAuth();
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();
  const [conversations, setConversations] = useState<ConversationDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [userList, setUserList] = useState<UserOption[]>([]);
  const [userListLoading, setUserListLoading] = useState(false);
  const [userListError, setUserListError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [selectedFilesCount, setSelectedFilesCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAll, setFilterAll] = useState(true);
  const [profileOpenForId, setProfileOpenForId] = useState<string | null>(null);
  const profileCardAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [memberPhotoUrls, setMemberPhotoUrls] = useState<Record<string, string>>({});
  const fetchedPhotoUidsRef = useRef<Set<string>>(new Set());

  const selected = conversations.find((c) => c.id === selectedId);
  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (!filterAll) {
      list = list.filter((c) => c.firstMessageFromMember === true);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.memberDisplayName ?? "").toLowerCase().includes(q) ||
          (c.memberEmail ?? "").toLowerCase().includes(q) ||
          (c.lastMessagePreview ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [conversations, searchQuery, filterAll]);

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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!db) return;
    const unsub = subscribeConversations(db, setConversations);
    return () => unsub();
  }, [db]);

  useEffect(() => {
    if (!db || conversations.length === 0) return;
    const toFetch = conversations.map((c) => c.id).filter((uid) => !fetchedPhotoUidsRef.current.has(uid));
    if (toFetch.length === 0) return;
    toFetch.forEach((uid) => fetchedPhotoUidsRef.current.add(uid));
    let cancelled = false;
    Promise.all(
      toFetch.slice(0, 25).map((uid) =>
        getDoc(doc(db, "users", uid)).then((snap) => {
          if (cancelled || !snap.exists()) return null;
          const d = snap.data() as Record<string, unknown>;
          const url = (d.avatarUrl ?? d.photoURL ?? null) != null ? String(d.avatarUrl ?? d.photoURL) : null;
          return url ? { uid, url } : null;
        })
      )
    ).then((results) => {
      if (cancelled) return;
      setMemberPhotoUrls((prev) => {
        const next = { ...prev };
        results.forEach((r) => {
          if (r) next[r.uid] = r.url;
        });
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [db, conversations]);

  const loadUserList = useCallback(() => {
    if (!db) return;
    setUserListLoading(true);
    setUserListError(null);
    Promise.all([
      getDocsFromServer(collection(db, "users")),
      getDocsFromServer(collection(db, "members")),
    ])
      .then(([usersSnap, membersSnap]) => {
        const byEmail = new Map<string, UserOption>();
        usersSnap.forEach((d) => {
          const data = d.data();
          const emailRaw = data.email != null ? String(data.email).trim().toLowerCase() : "";
          if (!emailRaw) return;
          const displayNameRaw = data.displayName != null ? String(data.displayName).trim() : "";
          const existing = byEmail.get(emailRaw);
          if (!existing) {
            byEmail.set(emailRaw, {
              uid: d.id,
              email: emailRaw,
              displayName: displayNameRaw || emailRaw,
            });
            return;
          }
          if ((!existing.displayName || existing.displayName === existing.email) && displayNameRaw) {
            byEmail.set(emailRaw, { ...existing, displayName: displayNameRaw });
          }
          if ((!existing.uid || existing.uid.startsWith("member-")) && d.id) {
            byEmail.set(emailRaw, { ...byEmail.get(emailRaw)!, uid: d.id });
          }
        });
        membersSnap.forEach((d) => {
          const data = d.data();
          const uid = (data.uid ?? data.userId ?? "").toString().trim();
          const email = data.email != null ? String(data.email).trim().toLowerCase() : "";
          const displayName = (data.displayName ?? data.instagram_handle ?? data.note ?? data.email ?? null) != null
            ? String(data.displayName ?? data.instagram_handle ?? data.note ?? data.email).trim()
            : null;
          if (!email) return;
          const existing = byEmail.get(email);
          const memberKey = uid || ("member-" + d.id);
          if (!existing) {
            byEmail.set(email, {
              uid: memberKey,
              email,
              displayName: displayName || email,
              memberId: uid ? undefined : d.id,
            });
            return;
          }
          const next: UserOption = { ...existing };
          if ((!next.displayName || next.displayName === next.email) && displayName) next.displayName = displayName;
          if ((next.uid.startsWith("member-") || !next.uid) && uid) next.uid = uid;
          if (!uid) next.memberId = existing.memberId ?? d.id;
          byEmail.set(email, next);
        });
        const list = Array.from(byEmail.values());
        list.sort((a, b) => {
          const na = (a.displayName || a.email || a.uid).toLowerCase();
          const nb = (b.displayName || b.email || b.uid).toLowerCase();
          return na.localeCompare(nb);
        });
        setUserList(list);
      })
      .catch((e) => {
        setUserList([]);
        setUserListError((e instanceof Error ? e.message : String(e)) || "Could not load members. Check admin access or try Refresh.");
      })
      .finally(() => setUserListLoading(false));
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("forAdmin", "==", true),
      where("type", "==", "dm"),
      where("read", "==", false)
    );
    getDocs(q)
      .then((snap) => Promise.all(snap.docs.map((d) => updateDoc(doc(db, NOTIFICATIONS_COLLECTION, d.id), { read: true }))))
      .catch(() => {});
  }, [db]);

  const handleStartNewConversation = useCallback(
    async (userOption: UserOption) => {
      if (!db) return;
      setShowNewConversation(false);
      let uid = userOption.uid;
      if (userOption.memberId) {
        try {
          const token = user ? await user.getIdToken(true) : null;
          if (!token) throw new Error("Not signed in.");
          const res = await fetch("/api/admin/ensure-member-auth", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ memberId: userOption.memberId }),
          });
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; uid?: string; error?: string };
          if (!res.ok || !data.uid) throw new Error(data.error || "Could not create sign-in for member.");
          uid = data.uid;
        } catch (e) {
          console.error(e);
          setShowNewConversation(true);
          return;
        }
      }
      try {
        await ensureConversation(db, uid, userOption.email, userOption.displayName);
        setSelectedId(uid);
        setConversations((prev) => {
          if (prev.some((c) => c.id === uid)) return prev;
          return [
            ...prev,
            {
              id: uid,
              memberUid: uid,
              memberEmail: userOption.email,
              memberDisplayName: userOption.displayName,
              createdAt: null,
              updatedAt: null,
              lastMessageAt: null,
              lastMessagePreview: null,
            },
          ];
        });
        if (userOption.memberId) {
          setUserList((prev) =>
            prev.map((u) =>
              u.memberId === userOption.memberId ? { ...u, uid, memberId: undefined } : u
            )
          );
        }
      } catch (e) {
        console.error(e);
      }
    },
    [db, user]
  );

  useEffect(() => {
    if (!db || !selectedId) {
      setMessages([]);
      return;
    }
    const unsub = subscribeMessages(db, selectedId, (list) => {
      setMessages(list);
      setTimeout(scrollToBottom, 100);
    });
    return () => unsub();
  }, [db, selectedId, scrollToBottom]);

  const createNotificationForMember = useCallback(
    async (memberEmail: string | null, body: string) => {
      if (!db || !memberEmail) return;
      await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
        forMemberEmail: memberEmail.trim().toLowerCase(),
        type: "dm",
        title: "New message",
        body,
        link: "/dms",
        read: false,
        createdAt: serverTimestamp(),
      });
    },
    [db]
  );

  const handleSend = useCallback(async () => {
    if (!db || !user || !selectedId) return;
    const hasText = text.trim().length > 0;
    const hasFiles = selectedFilesCount > 0;
    if (!hasText && !hasFiles) return;
    setSending(true);
    setSendError(null);
    try {
      if (storage && hasFiles) {
        setUploading(true);
        const { doc, addDoc, updateDoc } = await import("firebase/firestore");
        const messagesRef = collection(db, "conversations", selectedId, "messages");
        const imageUrls: string[] = [];
        const videoUrls: string[] = [];
        const placeholderRef = await addDoc(messagesRef, {
          senderId: user.uid,
          senderEmail: user.email ?? null,
          text: text.trim(),
          imageUrls: [],
          videoUrls: [],
          createdAt: serverTimestamp(),
        });
        const files = fileInputRef.current?.files;
        if (!files || files.length === 0) {
          throw new Error("No files were selected.");
        }
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const isVideo = file.type.startsWith("video/");
          const url = await uploadDmFile(storage, selectedId, placeholderRef.id, file);
          if (isVideo) videoUrls.push(url);
          else imageUrls.push(url);
        }
        await updateDoc(placeholderRef, { imageUrls, videoUrls });
        await updateDoc(doc(db, "conversations", selectedId), {
          updatedAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(),
          lastMessagePreview: "(attachment)",
        });
        await setFirstMessageFlagIfFirst(db, selectedId, user.uid);
        setUploading(false);
        setText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSelectedFilesCount(0);
        await createNotificationForMember(selected?.memberEmail ?? null, "You received a new message.");
        return;
      }
      if (!storage && hasFiles) {
        throw new Error("File upload is not available right now. Please refresh and try again.");
      }
      await sendMessage(db, selectedId, user.uid, user.email ?? null, text.trim());
      await createNotificationForMember(
        selected?.memberEmail ?? null,
        "New message: " + text.trim().slice(0, 50) + (text.length > 50 ? "…" : "")
      );
      setText("");
    } catch (e) {
      console.error(e);
      setSendError((e as Error)?.message ?? "Failed to send/upload message.");
    } finally {
      setSending(false);
      setUploading(false);
    }
  }, [db, user, selectedId, selected?.memberEmail, text, storage, createNotificationForMember, selectedFilesCount]);

  return (
    <main
      className="admin-main admin-content-main"
      style={{
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div className="chat-page" style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "row" }}>
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2 className="chat-sidebar-title">Chat</h2>
            <div className="chat-sidebar-actions">
              <button type="button" onClick={() => { setShowNewConversation(true); loadUserList(); }} title="New message" aria-label="New message"><EnvelopeIcon /></button>
            </div>
          </div>
          <div className="chat-search-wrap">
            <input type="search" className="chat-search" placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="Search conversations" />
          </div>
          <div className="chat-filters">
            <button type="button" className={`chat-filter-pill ${filterAll ? "active" : ""}`} onClick={() => setFilterAll(true)}>All</button>
            <button type="button" className={`chat-filter-pill ${!filterAll ? "active" : ""}`} onClick={() => setFilterAll(false)}>Requests</button>
          </div>
          <div style={{ overflow: "auto", flex: 1 }} className="chat-conversation-list">
            {filteredConversations.length === 0 && (
              <p className="chat-empty-state" style={{ margin: "1rem" }}>
                {conversations.length === 0 ? "No conversations yet. Click the envelope to start one." : "No matches for your search."}
              </p>
            )}
            {filteredConversations.map((c) => (
              <div
                key={c.id}
                className={`chat-conversation-item ${selectedId === c.id ? "active" : ""}`}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  borderBottom: "1px solid var(--border)",
                  background: selectedId === c.id ? "var(--accent-soft)" : "transparent",
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    border: "none",
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    font: "inherit",
                    background: "transparent",
                    minWidth: 0,
                  }}
                >
                  <span className="chat-conversation-avatar" style={memberPhotoUrls[c.id] ? { overflow: "hidden", padding: 0 } : undefined}>
                    {memberPhotoUrls[c.id] ? (
                      <img src={memberPhotoUrls[c.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "50%" }} />
                    ) : (
                      getInitials(c.memberDisplayName, c.memberEmail)
                    )}
                  </span>
                  <div className="chat-conversation-body" style={{ flex: 1, minWidth: 0 }}>
                    <p className="chat-conversation-name" style={{ margin: 0, fontWeight: 600, fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.memberDisplayName || c.memberEmail || "Member"}</p>
                    <p className="chat-conversation-preview" style={{ margin: "0.15rem 0 0", fontSize: "0.85rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessagePreview ? (c.lastMessagePreview.length > 40 ? c.lastMessagePreview.slice(0, 40) + "…" : c.lastMessagePreview) : "No messages yet"}</p>
                  </div>
                  <span className="chat-conversation-time" style={{ fontSize: "0.75rem", color: "var(--text-muted)", flexShrink: 0 }}>{formatRelativeTime(c.lastMessageAt)}</span>
                </button>
                {/* Profile menu intentionally only in right thread header */}
              </div>
            ))}
          </div>
        </aside>

        <div className="chat-thread" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!selectedId ? (
            <div className="chat-empty-state">Select a conversation or start a new one.</div>
          ) : (
            <>
              <div className="chat-thread-header">
                <span className="chat-thread-avatar" style={selected && memberPhotoUrls[selectedId ?? ""] ? { overflow: "hidden", padding: 0 } : undefined}>
                  {selected && memberPhotoUrls[selectedId ?? ""] ? (
                    <img src={memberPhotoUrls[selectedId ?? ""]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "50%" }} />
                  ) : selected ? (
                    getInitials(selected.memberDisplayName, selected.memberEmail)
                  ) : (
                    "?"
                  )}
                </span>
                <h3 className="chat-thread-name" style={{ margin: 0 }}>{selected?.memberDisplayName || selected?.memberEmail || "Member"}</h3>
                <div className="chat-thread-actions" style={{ position: "relative" }}>
                  <button
                    type="button"
                    ref={profileOpenForId === selectedId ? profileCardAnchorRef : undefined}
                    onClick={(e) => {
                      if (selectedId) {
                        profileCardAnchorRef.current = e.currentTarget;
                        setProfileOpenForId(profileOpenForId === selectedId ? null : selectedId);
                      }
                    }}
                    title="View profile"
                    aria-label="View member profile"
                  >
                    <ThreeDotsIcon />
                  </button>
                  {selectedId && profileOpenForId === selectedId && (
                    <MemberProfileCard
                      member={{ uid: selectedId, email: selected?.memberEmail ?? null, displayName: selected?.memberDisplayName ?? null }}
                      anchorRef={profileCardAnchorRef}
                      open={true}
                      onClose={() => setProfileOpenForId(null)}
                    />
                  )}
                </div>
              </div>
              <div className="chat-messages">
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
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,video/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    setSelectedFilesCount(e.target.files?.length ?? 0);
                    setSendError(null);
                  }}
                />
                <button type="button" className="icon-btn" onClick={() => fileInputRef.current?.click()} disabled={sending || uploading} title="Photo / video"><ImageIcon /></button>
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
                <p style={{ margin: 0, padding: "0 1rem 0.35rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                  {selectedFilesCount} file{selectedFilesCount === 1 ? "" : "s"} selected
                </p>
              )}
              {sendError && (
                <p style={{ margin: 0, padding: "0.5rem 1rem", color: "var(--error, #c53030)", fontSize: "0.85rem" }}>
                  {sendError}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {showNewConversation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-conversation-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
          onClick={() => setShowNewConversation(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: "1.25rem",
              maxWidth: 400,
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="new-conversation-title" style={{ margin: "0 0 1rem", fontSize: "1.2rem" }}>
              Start new conversation
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <button
                type="button"
                onClick={() => loadUserList()}
                disabled={userListLoading}
                style={{
                  padding: "0.35rem 0.6rem",
                  fontSize: "0.85rem",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--bg-card)",
                  cursor: userListLoading ? "wait" : "pointer",
                }}
              >
                {userListLoading ? "Loading…" : "Refresh list"}
              </button>
            </div>
            {userListError && (
              <p style={{ margin: "0 0 1rem", padding: "0.75rem", background: "rgba(200,0,0,0.1)", color: "var(--text)", borderRadius: 8, fontSize: "0.9rem" }}>
                {userListError}
              </p>
            )}
            {conversations.length === 0 && (
              <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                Choose a member (they must have signed in at least once to appear here).
              </p>
            )}
            {userListLoading ? (
              <p style={{ margin: 0, color: "var(--text-muted)" }}>Loading…</p>
            ) : userList.length === 0 && conversations.length === 0 ? (
              <p style={{ margin: 0, color: "var(--text-muted)" }}>No members with accounts yet.</p>
            ) : userList.length === 0 ? null : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {userList.map((u) => {
                  const userEmailNorm = (u.email || "").trim().toLowerCase();
                  const alreadyHasConv =
                    conversations.some((c) => c.id === u.uid) ||
                    (userEmailNorm
                      ? conversations.some((c) => (c.memberEmail || "").trim().toLowerCase() === userEmailNorm)
                      : false);
                  return (
                    <li key={u.uid} style={{ borderBottom: "1px solid var(--border)" }}>
                      <button
                        type="button"
                        onClick={() => handleStartNewConversation(u)}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "0.75rem 0",
                          textAlign: "left",
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          font: "inherit",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{u.displayName || u.email || "Member"}</span>
                        {u.email && (
                          <span style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)" }}>{u.email}</span>
                        )}
                        {alreadyHasConv && (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>• existing</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div style={{ marginTop: "1rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowNewConversation(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
