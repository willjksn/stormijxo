"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { collection, getDocs, query, where, updateDoc, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseStorage } from "../../../../lib/firebase";
import {
  subscribeMessages,
  sendMessage,
  uploadDmFile,
  getNewMessageRef,
  generateUnlockId,
  subscribeNewMediaUnlocks,
  type MessageDoc,
  type LockedMediaItem,
} from "../../../../lib/dms";
import { subscribeSubscribers, type SubscriberDoc } from "../../../../lib/subscribers";
import { CHAT_SESSIONS_COLLECTION } from "../../../../lib/chat-sessions";
import { NOTIFICATIONS_COLLECTION } from "../../../../lib/notifications";
import { getChatSessionSummary, saveChatSessionSummary } from "../../../../lib/chat-session-summaries";
import { listMediaLibrary, listMediaLibraryAll, type MediaItem } from "../../../../lib/media-library";
import type { FanOption } from "../types";
import type { SextingContextMessage } from "../types";
import { FanDropdown } from "./FanDropdown";
import { AISuggestionsPanel } from "./AISuggestionsPanel";
import { SessionEndModal } from "./SessionEndModal";
import { generateSextingSuggestion, generateChatSessionSummary } from "../api/client";
import { AdminEmojiPicker } from "../../../admin/components/AdminEmojiPicker";
import { useStudioSettings } from "../hooks/useStudioSettings";

function subscriberToFan(s: SubscriberDoc): FanOption {
  const uid = s.uid || s.userId || s.id;
  return {
    uid,
    displayName: s.displayName || s.email,
    email: s.email,
    memberId: s.id,
  };
}

function messagesToContext(messages: MessageDoc[], adminUid: string): SextingContextMessage[] {
  return messages.map((m) => ({
    role: m.senderId === adminUid ? "assistant" : "user",
    content: m.text?.trim() || "(media)",
  }));
}

const ROLEPLAY_TYPES = [
  "GFE",
  "Dominant",
  "Teacher",
  "Boss",
  "Fitness",
  "Soft",
  "Nurse",
  "Celebrity",
] as const;

const TONES = ["Soft", "Teasing", "Playful", "Explicit"] as const;

function SparklesIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

interface SextingSessionPanelProps {
  getToken: () => Promise<string>;
  adminUid: string;
  adminEmail: string | null;
  usageRemaining?: number;
}

export function SextingSessionPanel({ getToken, adminUid, adminEmail, usageRemaining = 200 }: SextingSessionPanelProps) {
  const db = getFirebaseDb();
  const { creatorPersonality, profanity, spiciness, formality, humor, empathy } = useStudioSettings();
  const [subscribers, setSubscribers] = useState<SubscriberDoc[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [personalityOpen, setPersonalityOpen] = useState(false);
  const [roleplayType, setRoleplayType] = useState<string>("GFE");
  const [tone, setTone] = useState<string>("Teasing");
  const [sessionEndModalOpen, setSessionEndModalOpen] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(30);
  const [customDurationMinutes, setCustomDurationMinutes] = useState<number>(20);
  const [durationPreset, setDurationPreset] = useState<"15" | "30" | "45" | "60" | "custom">("30");
  const [customChatTypeValue, setCustomChatTypeValue] = useState("");
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0);
  const [myMessageInput, setMyMessageInput] = useState("");
  const [autoSuggestions, setAutoSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");
  const [pendingMedia, setPendingMedia] = useState<{ file?: File; libraryUrl?: string; type: "image" | "video"; isLocked: boolean; priceCents: number; preview?: string }[]>([]);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState<MediaItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const mediaLibraryAnchorRef = useRef<HTMLDivElement>(null);
  const [unlockBanner, setUnlockBanner] = useState<{ amountCents: number } | null>(null);
  const [chatBotEnabled, setChatBotEnabled] = useState(false);
  const [chatBotReplying, setChatBotReplying] = useState(false);
  const [fanSessionContext, setFanSessionContext] = useState<string | null>(null);
  const [fanProfileData, setFanProfileData] = useState<{
    bio: string | null;
    avatarUrl: string | null;
    displayName: string | null;
    username: string | null;
    likes: string;
    whatYouWantToSee: string;
    notes: string;
    lastSessionSummaries: { endedAt: string; summary: string }[];
  } | null>(null);
  const sendInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const lastFetchedMessageCountRef = useRef(0);
  const lastChatBotRepliedCountRef = useRef(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!db) return;
    const unsub = subscribeSubscribers(db, setSubscribers);
    return () => unsub();
  }, [db]);

  useEffect(() => {
    if (!db || !selectedUid) {
      setMessages([]);
      return;
    }
    const unsub = subscribeMessages(db, selectedUid, setMessages);
    return () => unsub();
  }, [db, selectedUid]);

  useEffect(() => {
    if (!db || !selectedUid || !sessionStarted) return;
    const timeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
    const unsub = subscribeNewMediaUnlocks(db, selectedUid, (amountCents) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setUnlockBanner({ amountCents });
      timeoutRef.current = setTimeout(() => {
        setUnlockBanner(null);
        timeoutRef.current = null;
      }, 5000);
    });
    return () => {
      unsub();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [db, selectedUid, sessionStarted]);

  useEffect(() => {
    if (!db || !selectedUid || !adminUid) {
      setFanSessionContext(null);
      setFanProfileData(null);
      return;
    }
    const fan = subscribers.find(
      (s) => (s.uid || s.userId || "member-" + s.id) === selectedUid
    );
    const memberId = fan?.id ?? null;
    Promise.all([
      getChatSessionSummary(db, adminUid, selectedUid),
      selectedUid && !selectedUid.startsWith("member-")
        ? getDoc(doc(db, "users", selectedUid)).then((s) => (s.exists() ? s.data() : null))
        : Promise.resolve(null),
      memberId ? getDoc(doc(db, "members", memberId)).then((s) => (s.exists() ? s.data() : null)) : Promise.resolve(null),
    ])
      .then(([summaryDoc, userData, memberData]) => {
        const u = userData as Record<string, unknown> | null;
        const m = memberData as Record<string, unknown> | null;
        const parts: string[] = [];
        if (summaryDoc?.summary) parts.push(summaryDoc.summary);
        if (summaryDoc?.preferences) parts.push("Preferences: " + summaryDoc.preferences);
        setFanSessionContext(parts.length > 0 ? parts.join(" ") : null);
        setFanProfileData({
          bio: (u?.bio ?? "").toString().trim() || null,
          avatarUrl: (u?.avatarUrl ?? u?.photoURL ?? "").toString().trim() || null,
          displayName: (u?.displayName ?? "").toString().trim() || null,
          username: (u?.username ?? "").toString().trim() || null,
          likes: (m?.likes ?? "").toString().trim(),
          whatYouWantToSee: (m?.whatYouWantToSee ?? "").toString().trim(),
          notes: (m?.notes ?? "").toString().trim(),
          lastSessionSummaries: summaryDoc?.lastSessionSummaries ?? [],
        });
      })
      .catch(() => {
        setFanSessionContext(null);
        setFanProfileData(null);
      });
  }, [db, adminUid, selectedUid, subscribers]);

  useEffect(() => {
    if (!mediaLibraryOpen) return;
    const storage = getFirebaseStorage();
    if (!storage) {
      setLibraryItems([]);
      return;
    }
    setLibraryLoading(true);
    const load = async () => {
      try {
        let folderIds: string[] = ["general"];
        if (db) {
          const configSnap = await getDoc(doc(db, "mediaLibrary", "config"));
          const data = configSnap.data();
          const customFolders = (data?.folders as { id: string; name: string }[] | undefined) || [];
          folderIds = ["general", ...customFolders.map((f) => f.id).filter((id) => id !== "general")];
        }
        const items = await listMediaLibraryAll(storage, folderIds);
        setLibraryItems(items);
      } catch {
        setLibraryItems([]);
      } finally {
        setLibraryLoading(false);
      }
    };
    load();
  }, [mediaLibraryOpen]);

  const fans: FanOption[] = subscribers.map(subscriberToFan);
  const selectedFan = fans.find((f) => f.uid === selectedUid);
  const recentMessages = messagesToContext(messages, adminUid);

  const handleSuggestionSelect = useCallback((text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
  }, []);

  const handleStartSession = useCallback(() => {
    if (!selectedUid) return;
    const mins = durationPreset === "custom" ? customDurationMinutes : sessionDurationMinutes;
    const totalSeconds = Math.max(1, mins) * 60;
    setTimeRemainingSeconds(totalSeconds);
    setSessionStarted(true);
    setSessionPaused(false);
    lastFetchedMessageCountRef.current = 0;
    lastChatBotRepliedCountRef.current = 0;
    setAutoSuggestions([]);
    // Mark scheduled chat session as started and notify the fan
    if (db) {
      getDocs(query(collection(db, CHAT_SESSIONS_COLLECTION), where("conversationId", "==", selectedUid)))
        .then((snap) => {
          const now = Date.now();
          for (const d of snap.docs) {
            const data = d.data();
            const scheduledStart = (data.scheduledStart as { toDate?: () => Date })?.toDate?.();
            if (!scheduledStart) continue;
            const durationMinutes = typeof data.durationMinutes === "number" ? data.durationMinutes : 15;
            const end = scheduledStart.getTime() + durationMinutes * 60 * 1000;
            if (data.startedAt) continue;
            if (now >= scheduledStart.getTime() && now < end) {
              const memberEmail = (data.memberEmail ?? "").toString().trim().toLowerCase();
              return updateDoc(doc(db, CHAT_SESSIONS_COLLECTION, d.id), {
                startedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }).then(() => {
                if (memberEmail) {
                  return addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
                    forMemberEmail: memberEmail,
                    type: "chat_session_live",
                    title: "Your chat is live",
                    body: "Join now to chat!",
                    link: "/chat-session",
                    read: false,
                    createdAt: serverTimestamp(),
                  });
                }
              });
            }
          }
        })
        .catch(() => {});
    }
  }, [selectedUid, durationPreset, customDurationMinutes, sessionDurationMinutes, db]);

  useEffect(() => {
    if (!sessionStarted || sessionPaused || timeRemainingSeconds <= 0) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }
    timerIntervalRef.current = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [sessionStarted, sessionPaused, timeRemainingSeconds <= 0]);

  // When timer hits 0: auto-end session, disable chatbot, save summary (with AI summary)
  useEffect(() => {
    if (!sessionStarted || timeRemainingSeconds !== 0) return;
    setChatBotEnabled(false);
    setSessionStarted(false);
    setSessionPaused(false);
    if (db && selectedUid && adminUid) {
      const msgs = recentMessages;
      const fanName = selectedFan?.displayName ?? selectedFan?.email ?? undefined;
      getToken()
        .then((token) => {
          if (!token || msgs.length === 0) return saveChatSessionSummary(db, {
            creatorUid: adminUid,
            conversationId: selectedUid,
            memberEmail: selectedFan?.email ?? null,
            memberName: selectedFan?.displayName ?? null,
            messageCountAtEnd: messages.length,
          });
          return generateChatSessionSummary(token, { recentMessages: msgs, fanName })
            .then((res) =>
              saveChatSessionSummary(db, {
                creatorUid: adminUid,
                conversationId: selectedUid,
                memberEmail: selectedFan?.email ?? null,
                memberName: selectedFan?.displayName ?? null,
                messageCountAtEnd: messages.length,
                summary: res.summary || null,
              })
            );
        })
        .catch(() =>
          saveChatSessionSummary(db, {
            creatorUid: adminUid,
            conversationId: selectedUid,
            memberEmail: selectedFan?.email ?? null,
            memberName: selectedFan?.displayName ?? null,
            messageCountAtEnd: messages.length,
          })
        );
      getDocs(query(collection(db, CHAT_SESSIONS_COLLECTION), where("conversationId", "==", selectedUid)))
        .then((snap) => {
          const now = Date.now();
          for (const d of snap.docs) {
            const data = d.data();
            const scheduledStart = (data.scheduledStart as { toDate?: () => Date })?.toDate?.();
            if (!scheduledStart) continue;
            const durationMinutes = typeof data.durationMinutes === "number" ? data.durationMinutes : 15;
            const end = scheduledStart.getTime() + durationMinutes * 60 * 1000;
            if (now < end && data.status !== "ended") {
              return updateDoc(doc(db, CHAT_SESSIONS_COLLECTION, d.id), {
                status: "ended",
                updatedAt: serverTimestamp(),
              });
            }
          }
        })
        .catch(() => {});
    }
  }, [sessionStarted, timeRemainingSeconds, db, selectedUid, adminUid, selectedFan, messages.length, recentMessages, getToken]);

  // Chatbot: auto-reply to new fan messages when enabled
  useEffect(() => {
    if (
      !chatBotEnabled ||
      !sessionStarted ||
      sessionPaused ||
      !selectedUid ||
      !db ||
      chatBotReplying ||
      recentMessages.length === 0
    ) return;
    const last = recentMessages[recentMessages.length - 1];
    if (last.role !== "user") return;
    if (recentMessages.length <= lastChatBotRepliedCountRef.current) return;
    lastChatBotRepliedCountRef.current = recentMessages.length;
    setChatBotReplying(true);
    const toneId = tone.toLowerCase();
    const toneParam = toneId === "teasing" ? "tease" : toneId === "playful" || toneId === "intimate" || toneId === "sweet" ? toneId : "playful";
    const wrappingUp = timeRemainingSeconds <= 60;
    getToken()
      .then((token) => {
        if (!token) return null;
        return generateSextingSuggestion(token, {
          recentMessages,
          fanName: selectedFan?.displayName ?? selectedFan?.email ?? undefined,
          creatorPersona: creatorPersonality,
          tone: toneParam as "playful" | "intimate" | "tease" | "sweet",
          numSuggestions: 1,
          profanity: profanity !== undefined ? profanity : undefined,
          spiciness: spiciness !== undefined ? spiciness : undefined,
          formality: formality !== undefined ? formality : undefined,
          humor: humor !== undefined ? humor : undefined,
          empathy: empathy !== undefined ? empathy : undefined,
          wrappingUp,
          fanSessionContext: fanSessionContext ?? undefined,
        });
      })
      .then((res) => {
        if (res?.error || !res?.suggestion?.trim()) return;
        return sendMessage(db, selectedUid, adminUid, adminEmail ?? null, res.suggestion.trim());
      })
      .catch(() => {})
      .finally(() => setChatBotReplying(false));
  }, [
    chatBotEnabled,
    sessionStarted,
    sessionPaused,
    selectedUid,
    db,
    recentMessages,
    tone,
    creatorPersonality,
    profanity,
    formality,
    humor,
    empathy,
    getToken,
    selectedFan,
    adminUid,
    adminEmail,
    timeRemainingSeconds,
    fanSessionContext,
  ]);

  useEffect(() => {
    if (!sessionStarted || !selectedUid || recentMessages.length === 0 || chatBotEnabled) return;
    const last = recentMessages[recentMessages.length - 1];
    if (last.role !== "user") return;
    if (recentMessages.length <= lastFetchedMessageCountRef.current) return;
    lastFetchedMessageCountRef.current = recentMessages.length;
    const toneId = tone.toLowerCase() as "playful" | "intimate" | "tease" | "sweet";
    getToken().then((token) => {
      if (!token) return;
      return generateSextingSuggestion(token, {
        recentMessages: recentMessages,
        fanName: selectedFan?.displayName ?? selectedFan?.email ?? undefined,
        creatorPersona: creatorPersonality,
        tone: toneId === "teasing" ? "tease" : toneId in { playful: 1, intimate: 1, tease: 1, sweet: 1 } ? toneId : "playful",
        numSuggestions: 6,
        profanity: profanity !== undefined ? profanity : undefined,
        spiciness: spiciness !== undefined ? spiciness : undefined,
        formality: formality !== undefined ? formality : undefined,
        humor: humor !== undefined ? humor : undefined,
        empathy: empathy !== undefined ? empathy : undefined,
        fanSessionContext: fanSessionContext ?? undefined,
      });
    }).then((res) => {
      if (res?.error || !res?.suggestions?.length) return;
      setAutoSuggestions(res.suggestions);
    }).catch(() => {});
  }, [sessionStarted, selectedUid, recentMessages, creatorPersonality, profanity, tone, getToken, selectedFan, chatBotEnabled, fanSessionContext]);

  const handleSendMyMessage = useCallback(async () => {
    const t = myMessageInput.trim();
    if (!selectedUid || !db) return;
    const hasMedia = pendingMedia.length > 0;
    if (!t && !hasMedia) return;
    const storage = getFirebaseStorage();
    setMyMessageInput("");
    if (hasMedia && (storage || pendingMedia.some((p) => p.libraryUrl))) {
      const { id: messageId } = getNewMessageRef(db, selectedUid);
      const imageUrls: string[] = [];
      const videoUrls: string[] = [];
      const lockedMedia: LockedMediaItem[] = [];
      for (const item of pendingMedia) {
        if (item.libraryUrl) {
          if (item.isLocked) {
            lockedMedia.push({
              url: item.libraryUrl,
              priceCents: Math.max(100, Math.min(50000, item.priceCents)),
              unlockId: generateUnlockId(),
              type: item.type,
            });
          } else {
            if (item.type === "image") imageUrls.push(item.libraryUrl);
            else videoUrls.push(item.libraryUrl);
          }
          continue;
        }
        if (!item.file || !storage) continue;
        try {
          const url = await uploadDmFile(storage, selectedUid, messageId, item.file);
          if (item.isLocked) {
            lockedMedia.push({
              url,
              priceCents: Math.max(100, Math.min(50000, item.priceCents)),
              unlockId: generateUnlockId(),
              type: item.type,
            });
          } else {
            if (item.type === "image") imageUrls.push(url);
            else videoUrls.push(url);
          }
        } catch (_e) {
          // skip failed upload
        }
      }
      setPendingMedia([]);
      setMediaLibraryOpen(false);
      try {
        await sendMessage(
          db,
          selectedUid,
          adminUid,
          adminEmail ?? null,
          t || "",
          imageUrls,
          videoUrls,
          [],
          lockedMedia.length > 0 ? lockedMedia : undefined,
          messageId
        );
      } catch (_err) {}
      return;
    }
    setPendingMedia([]);
    setMediaLibraryOpen(false);
    try {
      await sendMessage(db, selectedUid, adminUid, adminEmail ?? null, t);
    } catch (_err) {
      // could set error state
    }
  }, [myMessageInput, pendingMedia, selectedUid, db, adminUid, adminEmail]);

  const handleUseSuggestion = useCallback((text: string) => {
    setMyMessageInput(text);
  }, []);

  const insertEmojiInMessage = useCallback((emoji: string) => {
    const input = sendInputRef.current;
    if (input) {
      const start = input.selectionStart ?? myMessageInput.length;
      const end = input.selectionEnd ?? myMessageInput.length;
      const next = myMessageInput.slice(0, start) + emoji + myMessageInput.slice(end);
      setMyMessageInput(next);
      setTimeout(() => {
        input.focus();
        const pos = start + emoji.length;
        input.setSelectionRange(pos, pos);
      }, 0);
    } else {
      setMyMessageInput((prev) => prev + emoji);
    }
    setEmojiPickerOpen(false);
    setEmojiQuery("");
  }, [myMessageInput]);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (sendInputRef.current?.closest(".chat-session-send-row")?.contains(target)) return;
      setEmojiPickerOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [emojiPickerOpen]);

  useEffect(() => {
    if (!mediaLibraryOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (mediaLibraryAnchorRef.current?.contains(target)) return;
      setMediaLibraryOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [mediaLibraryOpen]);

  const handleRequestSuggestions = useCallback(() => {
    if (!selectedUid || recentMessages.length === 0) return;
    const last = recentMessages[recentMessages.length - 1];
    if (last.role !== "user") return;
    setSuggestionsLoading(true);
    const toneId = tone.toLowerCase();
    const toneParam = toneId === "teasing" ? "tease" : toneId === "playful" || toneId === "intimate" || toneId === "sweet" ? toneId : "playful";
    getToken().then((token) => {
      if (!token) return;
      return generateSextingSuggestion(token, {
        recentMessages,
        fanName: selectedFan?.displayName ?? selectedFan?.email ?? undefined,
        creatorPersona: creatorPersonality,
        tone: toneParam as "playful" | "intimate" | "tease" | "sweet",
        numSuggestions: 6,
        profanity: profanity !== undefined ? profanity : undefined,
        spiciness: spiciness !== undefined ? spiciness : undefined,
        formality: formality !== undefined ? formality : undefined,
        humor: humor !== undefined ? humor : undefined,
        empathy: empathy !== undefined ? empathy : undefined,
        fanSessionContext: fanSessionContext ?? undefined,
      });
    }).then((res) => {
      if (res?.suggestions?.length) setAutoSuggestions(res.suggestions);
    }).catch(() => {}).finally(() => setSuggestionsLoading(false));
  }, [selectedUid, recentMessages, tone, creatorPersonality, profanity, getToken, selectedFan, fanSessionContext]);

  const handleEndSession = useCallback(() => {
    setSessionEndModalOpen(false);
    setChatBotEnabled(false);
    setSessionStarted(false);
    setSessionPaused(false);
    if (db && selectedUid) {
      const msgs = recentMessages;
      const fanName = selectedFan?.displayName ?? selectedFan?.email ?? undefined;
      getToken()
        .then((token) => {
          if (!token || msgs.length === 0) return saveChatSessionSummary(db, {
            creatorUid: adminUid,
            conversationId: selectedUid,
            memberEmail: selectedFan?.email ?? null,
            memberName: selectedFan?.displayName ?? null,
            messageCountAtEnd: messages.length,
          });
          return generateChatSessionSummary(token, { recentMessages: msgs, fanName }).then((res) =>
            saveChatSessionSummary(db, {
              creatorUid: adminUid,
              conversationId: selectedUid,
              memberEmail: selectedFan?.email ?? null,
              memberName: selectedFan?.displayName ?? null,
              messageCountAtEnd: messages.length,
              summary: res.summary || null,
            })
          );
        })
        .catch(() =>
          saveChatSessionSummary(db, {
            creatorUid: adminUid,
            conversationId: selectedUid,
            memberEmail: selectedFan?.email ?? null,
            memberName: selectedFan?.displayName ?? null,
            messageCountAtEnd: messages.length,
          })
        );
      getDocs(query(collection(db, CHAT_SESSIONS_COLLECTION), where("conversationId", "==", selectedUid)))
        .then((snap) => {
          const now = Date.now();
          for (const d of snap.docs) {
            const data = d.data();
            const scheduledStart = (data.scheduledStart as { toDate?: () => Date })?.toDate?.();
            if (!scheduledStart) continue;
            const durationMinutes = typeof data.durationMinutes === "number" ? data.durationMinutes : 15;
            const end = scheduledStart.getTime() + durationMinutes * 60 * 1000;
            if (now < end && data.status !== "ended") {
              return updateDoc(doc(db, CHAT_SESSIONS_COLLECTION, d.id), {
                status: "ended",
                updatedAt: serverTimestamp(),
              });
            }
          }
        })
        .catch(() => {});
    }
  }, [db, selectedUid, adminUid, selectedFan, messages.length, recentMessages, getToken]);

  if (sessionStarted) {
    return (
      <>
      <div className="chat-session-active-wrap">
        <header className="chat-session-active-header">
          <div className="chat-session-active-header-left">
            <h2 className="chat-session-active-title">Active Session</h2>
            <p className="chat-session-active-subtitle">
              {roleplayType === "GFE" ? "GFE (Girlfriend Experience)" : roleplayType === "Custom" && customChatTypeValue.trim() ? customChatTypeValue.trim() : roleplayType} — {tone} — active
            </p>
          </div>
          <div className="chat-session-active-header-actions">
            <span className="chat-session-timer-display" aria-live="polite">
              {Math.floor(timeRemainingSeconds / 60)}:{(timeRemainingSeconds % 60).toString().padStart(2, "0")}
            </span>
            <button
              type="button"
              className={`chat-session-ai-chatbot-btn ${chatBotEnabled ? "active" : ""}`}
              onClick={() => setChatBotEnabled((on) => !on)}
              title={chatBotEnabled ? "AI Chat Bot is on — auto-replying to fan" : "Turn on AI Chat Bot to auto-reply"}
              aria-pressed={chatBotEnabled}
            >
              {chatBotReplying ? "…" : "🤖"} AI Chat Bot {chatBotEnabled ? "On" : "Off"}
            </button>
            <button
              type="button"
              className="chat-session-pause-btn"
              onClick={() => setSessionPaused((p) => !p)}
            >
              <span aria-hidden>{sessionPaused ? "▶" : "II"}</span> {sessionPaused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              className="chat-session-end-btn"
              onClick={() => setSessionEndModalOpen(true)}
            >
              <span aria-hidden>■</span> End Session
            </button>
          </div>
        </header>

        {unlockBanner && (
          <div
            role="alert"
            className="chat-session-unlock-banner"
            style={{
              padding: "0.6rem 1rem",
              background: "var(--accent-soft)",
              borderBottom: "1px solid var(--accent)",
              fontSize: "0.9rem",
              color: "var(--text)",
            }}
          >
            Payment successful. Fan unlocked content — ${(unlockBanner.amountCents / 100).toFixed(2)}
          </div>
        )}

        <div className="chat-session-active-layout">
          <div className="chat-session-conversation-panel">
            <h3 className="chat-session-panel-title">Conversation</h3>
            <div className="chat-session-messages-wrap chat-session-messages-wrap-active">
              {messages.length === 0 ? (
                <p className="chat-session-empty-msg">No messages yet. Start the conversation!</p>
              ) : (
                messages.map((m) => {
                  const isYou = m.senderId === adminUid;
                  return (
                    <div key={m.id} className={isYou ? "chat-session-msg-you" : "chat-session-msg-fan"}>
                      <span className="chat-session-msg-label">{isYou ? "You" : "Fan"}</span>
                      {m.text ? (
                        <p className="chat-session-msg-text">{m.text}</p>
                      ) : null}
                      {m.imageUrls?.length ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.25rem" }}>
                          {m.imageUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="" style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8, objectFit: "contain" }} />
                            </a>
                          ))}
                        </div>
                      ) : null}
                      {m.videoUrls?.length ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.25rem" }}>
                          {m.videoUrls.map((url, i) => (
                            <video
                              key={`${m.id}-v-${i}-${url.slice(0, 40)}`}
                              src={url.includes("#t=") ? url : `${url}#t=0.1`}
                              controls
                              playsInline
                              preload="auto"
                              onLoadedMetadata={(e) => {
                                const video = e.currentTarget;
                                try {
                                  if (Number.isFinite(video.duration) && video.duration > 0.15) {
                                    video.currentTime = 0.1;
                                  }
                                } catch {
                                  // ignore
                                }
                              }}
                              onSeeked={(e) => {
                                try {
                                  e.currentTarget.pause();
                                } catch {
                                  // ignore
                                }
                              }}
                              controlsList="nodownload noplaybackrate noremoteplayback"
                              disablePictureInPicture
                              onContextMenu={(e) => e.preventDefault()}
                              style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8 }}
                            />
                          ))}
                        </div>
                      ) : null}
                      {m.lockedMedia?.length ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.25rem" }}>
                          {m.lockedMedia.map((item, i) =>
                            item.type === "image" ? (
                              <img key={i} src={item.url} alt="" style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8, objectFit: "contain" }} />
                            ) : (
                              <video
                                key={i}
                                src={item.url.includes("#t=") ? item.url : `${item.url}#t=0.1`}
                                controls
                                playsInline
                                preload="auto"
                                onLoadedMetadata={(e) => {
                                  const video = e.currentTarget;
                                  try {
                                    if (Number.isFinite(video.duration) && video.duration > 0.15) {
                                      video.currentTime = 0.1;
                                    }
                                  } catch {
                                    // ignore
                                  }
                                }}
                                onSeeked={(e) => {
                                  try {
                                    e.currentTarget.pause();
                                  } catch {
                                    // ignore
                                  }
                                }}
                                controlsList="nodownload noplaybackrate noremoteplayback"
                                disablePictureInPicture
                                onContextMenu={(e) => e.preventDefault()}
                                style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8 }}
                              />
                            )
                          )}
                        </div>
                      ) : null}
                      {!m.text && !(m.imageUrls?.length) && !(m.videoUrls?.length) && !(m.lockedMedia?.length) ? (
                        <p className="chat-session-msg-text">(media)</p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            <div className="chat-session-send-row">
              <div className="chat-session-send-input-wrap">
                <input
                  ref={sendInputRef}
                  type="text"
                  className="chat-session-input chat-session-send-input"
                  placeholder="Type your message..."
                  value={myMessageInput}
                  onChange={(e) => setMyMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMyMessage()}
                  aria-label="Type your message"
                />
                <button
                  type="button"
                  className="chat-session-emoji-trigger"
                  onClick={() => setEmojiPickerOpen((o) => !o)}
                  aria-label="Add emoji"
                  aria-expanded={emojiPickerOpen}
                >
                  😀
                </button>
                {emojiPickerOpen && (
                  <div className="chat-session-emoji-picker-dropdown">
                    <AdminEmojiPicker
                      onPick={insertEmojiInMessage}
                      onClose={() => setEmojiPickerOpen(false)}
                      query={emojiQuery}
                      setQuery={setEmojiQuery}
                    />
                  </div>
                )}
              </div>
              <button type="button" className="chat-session-send-btn" onClick={handleSendMyMessage}>
                Send
              </button>
            </div>
            <div className="chat-session-media-row" style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPendingMedia((prev) => [
                        ...prev,
                        {
                          file: f,
                          type: "image",
                          isLocked: false,
                          priceCents: 500,
                          preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
                        },
                      ]);
                      e.target.value = "";
                    }
                  }}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*,.mp4,.webm,.mov,.mkv,.m4v,video/mp4,video/webm,video/quicktime"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPendingMedia((prev) => [...prev, { file: f, type: "video", isLocked: false, priceCents: 500 }]);
                      e.target.value = "";
                    }
                  }}
                />
                <button type="button" className="btn btn-secondary" style={{ fontSize: "0.85rem" }} onClick={() => imageInputRef.current?.click()}>
                  Add image
                </button>
                <button type="button" className="btn btn-secondary" style={{ fontSize: "0.85rem" }} onClick={() => videoInputRef.current?.click()}>
                  Add video
                </button>
                <div ref={mediaLibraryAnchorRef} style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: "0.85rem" }}
                    onClick={() => setMediaLibraryOpen((o) => !o)}
                    aria-expanded={mediaLibraryOpen}
                  >
                    Media from library
                  </button>
                  {mediaLibraryOpen && (
                    <div
                      className="chat-session-media-library-dropdown"
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "100%",
                        marginTop: 4,
                        zIndex: 50,
                        minWidth: 280,
                        maxWidth: 360,
                        maxHeight: 320,
                        overflow: "auto",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                        padding: "0.5rem",
                      }}
                    >
                      {libraryLoading ? (
                        <p style={{ margin: 0, padding: "0.75rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>Loading…</p>
                      ) : libraryItems.length === 0 ? (
                        <p style={{ margin: 0, padding: "0.75rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>No media in library.</p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: "0.5rem" }}>
                          {libraryItems.map((item, i) => (
                            <button
                              key={i}
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: "0.25rem", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
                              onClick={() => {
                                setPendingMedia((prev) => [
                                  ...prev,
                                  {
                                    libraryUrl: item.url,
                                    type: item.isVideo ? "video" : "image",
                                    isLocked: false,
                                    priceCents: 500,
                                    preview: item.isVideo ? undefined : item.url,
                                  },
                                ]);
                                setMediaLibraryOpen(false);
                              }}
                            >
                              {item.isVideo ? (
                                <span style={{ fontSize: "1.5rem" }}>🎬</span>
                              ) : (
                                <img src={item.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {pendingMedia.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {pendingMedia.map((item, idx) => (
                    <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--bg-card)" }}>
                      {item.type === "image" && (
                        <img src={item.preview ?? item.libraryUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />
                      )}
                      {item.type === "video" && <span style={{ fontSize: "0.9rem" }}>🎬</span>}
                      <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.85rem" }}>
                        <input
                          type="checkbox"
                          checked={item.isLocked}
                          onChange={(e) =>
                            setPendingMedia((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, isLocked: e.target.checked } : p))
                            )
                          }
                        />
                        Tip to unlock
                      </label>
                      {item.isLocked && (
                        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.85rem" }}>
                          $<input
                            type="number"
                            min={1}
                            max={500}
                            value={item.priceCents / 100}
                            onChange={(e) =>
                              setPendingMedia((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, priceCents: Math.max(100, Math.min(50000, Math.round(parseFloat(e.target.value || "0") * 100))) } : p))
                              )
                            }
                            className="chat-session-input"
                            style={{ width: 52, padding: "0.35rem 0.5rem", boxSizing: "border-box" }}
                          />
                        </label>
                      )}
                      <button type="button" className="btn btn-secondary" style={{ padding: "0.2rem 0.4rem", fontSize: "0.8rem" }} onClick={() => setPendingMedia((prev) => {
                        const item = prev[idx];
                        if (item?.preview) URL.revokeObjectURL(item.preview);
                        return prev.filter((_, i) => i !== idx);
                      })}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {sessionStarted && selectedUid && fanProfileData && (
              <div className="chat-session-fan-profile-wrap" style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                <h4 className="chat-session-panel-title" style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>Fan profile</h4>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
                  {fanProfileData.avatarUrl && (
                    <img src={fanProfileData.avatarUrl} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />
                  )}
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <p style={{ margin: "0 0 0.25rem", fontWeight: 600 }}>{fanProfileData.displayName || selectedFan?.displayName || selectedFan?.email || "—"}</p>
                    {fanProfileData.username && <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>@{fanProfileData.username}</p>}
                    {fanProfileData.bio && <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{fanProfileData.bio}</p>}
                    {(fanProfileData.likes || fanProfileData.whatYouWantToSee || fanProfileData.notes) && (
                      <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                        {fanProfileData.likes && <p style={{ margin: "0.25rem 0" }}><strong>Likes:</strong> {fanProfileData.likes}</p>}
                        {fanProfileData.whatYouWantToSee && <p style={{ margin: "0.25rem 0" }}><strong>Wants to see:</strong> {fanProfileData.whatYouWantToSee}</p>}
                        {fanProfileData.notes && <p style={{ margin: "0.25rem 0" }}><strong>Notes:</strong> {fanProfileData.notes}</p>}
                      </div>
                    )}
                    {fanProfileData.lastSessionSummaries.length > 0 && (
                      <div style={{ marginTop: "0.75rem" }}>
                        <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Last session summary</p>
                        <p style={{ margin: 0, fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>
                          {fanProfileData.lastSessionSummaries[fanProfileData.lastSessionSummaries.length - 1]?.summary ?? "—"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="chat-session-suggestions-panel">
            <h3 className="chat-session-panel-title">AI Suggestions</h3>
            <AISuggestionsPanel
              getToken={getToken}
              recentMessages={recentMessages}
              fanName={selectedFan?.displayName ?? selectedFan?.email ?? undefined}
              creatorPersona={creatorPersonality}
              profanity={profanity}
              spiciness={spiciness}
              formality={formality}
              humor={humor}
              empathy={empathy}
              tone={tone}
              onSuggestionSelect={handleSuggestionSelect}
              onUseSuggestion={handleUseSuggestion}
              usageRemaining={usageRemaining}
              cardMode
              initialSuggestions={autoSuggestions}
              onRequestSuggestions={handleRequestSuggestions}
              suggestionsLoading={suggestionsLoading}
              suggestionsDisabled={chatBotEnabled}
            />
          </div>
        </div>
        <button type="button" className="chat-session-back-btn" onClick={() => setSessionStarted(false)} style={{ marginTop: "1rem" }}>
          ← Back to setup
        </button>
      </div>
      <SessionEndModal
        open={sessionEndModalOpen}
        onClose={() => setSessionEndModalOpen(false)}
        onConfirm={handleEndSession}
        fanName={selectedFan?.displayName ?? selectedFan?.email ?? undefined}
      />
    </>
    );
  }

  return (
    <div className="chat-session-assistant-panel">
      <div className="chat-session-assistant-inner">
        <FanDropdown
          fans={fans}
          selectedUid={selectedUid}
          onSelect={setSelectedUid}
          loading={!db}
          placeholder="Select Fan"
        />

        <div className="chat-session-personality-wrap">
          <div className="chat-session-personality-duration-row">
            <button
              type="button"
              className={`chat-session-personality-btn ${personalityOpen ? "active" : ""}`}
              onClick={() => setPersonalityOpen((o) => !o)}
              aria-expanded={personalityOpen}
            >
              <span className="chat-session-personality-icon"><SparklesIcon /></span>
              Personality
            </button>
            <div className="chat-session-duration-wrap">
              <label className="chat-session-label">Session duration</label>
              <div className="chat-session-duration-row">
              {([15, 30, 45, 60] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`chat-session-duration-btn ${durationPreset === String(m) ? "active" : ""}`}
                  onClick={() => {
                    setDurationPreset(String(m) as "15" | "30" | "45" | "60");
                    setSessionDurationMinutes(m);
                  }}
                >
                  {m === 60 ? "1 hr" : `${m} min`}
                </button>
              ))}
              <button
                type="button"
                className={`chat-session-duration-btn ${durationPreset === "custom" ? "active" : ""}`}
                onClick={() => setDurationPreset("custom")}
              >
                Custom
              </button>
            </div>
            {durationPreset === "custom" && (
              <div className="chat-session-custom-duration">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={customDurationMinutes}
                  onChange={(e) => setCustomDurationMinutes(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
                  className="chat-session-input chat-session-duration-input"
                />
                <span className="chat-session-duration-unit">min</span>
              </div>
            )}
          </div>
          </div>
          {personalityOpen && (
            <div className="chat-session-personality-content">
              <label className="chat-session-label">Creator personality (from AI Training)</label>
              <p className="admin-posts-hint" style={{ marginBottom: "0.5rem" }}>
                Set and edit in <a href="/admin/ai-training" className="admin-posts-message" style={{ color: "var(--accent)" }}>AI Training</a>. Used for all AI features.
              </p>
              <div
                className="admin-posts-caption-input"
                style={{ minHeight: 80, whiteSpace: "pre-wrap", padding: "0.75rem" }}
                role="textbox"
                aria-readonly
              >
                {creatorPersonality || "No personality set. Add one in AI Training for consistent voice across chat, captions, and prompts."}
              </div>
            </div>
          )}
        </div>

        <label className="chat-session-label">Chat Type</label>
        <div className="chat-session-role-grid">
          {ROLEPLAY_TYPES.map((r) => (
            <button
              key={r}
              type="button"
              className={`chat-session-role-btn ${roleplayType === r ? "active" : ""}`}
              onClick={() => setRoleplayType(r)}
            >
              {r}
            </button>
          ))}
          <button
            type="button"
            className={`chat-session-role-btn chat-session-role-btn-custom ${roleplayType === "Custom" ? "active" : ""}`}
            onClick={() => setRoleplayType("Custom")}
          >
            Custom
          </button>
        </div>
        {roleplayType === "Custom" && (
          <div className="chat-session-custom-chat-type">
            <input
              type="text"
              className="chat-session-input"
              placeholder="Enter custom chat type..."
              value={customChatTypeValue}
              onChange={(e) => setCustomChatTypeValue(e.target.value)}
              aria-label="Custom chat type"
            />
          </div>
        )}

        <label className="chat-session-label">Tone</label>
        <div className="chat-session-tone-row">
          {TONES.map((t) => (
            <button
              key={t}
              type="button"
              className={`chat-session-role-btn ${tone === t ? "active" : ""}`}
              onClick={() => setTone(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="chat-session-start-btn"
          onClick={handleStartSession}
          title="Start chat session"
          disabled={!selectedUid}
        >
          <span className="chat-session-start-icon"><PlayIcon /></span>
          Start Session
        </button>
      </div>

      <SessionEndModal
        open={sessionEndModalOpen}
        onClose={() => setSessionEndModalOpen(false)}
        onConfirm={handleEndSession}
        fanName={selectedFan?.displayName ?? selectedFan?.email ?? undefined}
      />
    </div>
  );
}
