"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  limit,
  Timestamp,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseStorage } from "../../../../lib/firebase";
import { listMediaLibrary, uploadToMediaLibrary, type MediaItem } from "../../../../lib/media-library";
import { useAuth } from "../../../contexts/AuthContext";
import { LazyMediaImage } from "../../../components/LazyMediaImage";
import type { PostStatus } from "../../../../lib/posts";
import { useRouter } from "next/navigation";

const OVERLAY_ANIMATIONS = [
  { id: "static", label: "Static" },
  { id: "scroll-up", label: "Scroll up" },
  { id: "scroll-across", label: "Scroll across" },
  { id: "dissolve", label: "Dissolve" },
] as const;

const AI_TONES = [
  { id: "", label: "Default" },
  { id: "flirty", label: "Flirty" },
  { id: "casual", label: "Casual" },
  { id: "motivational", label: "Motivational" },
  { id: "premium", label: "Premium" },
];

const AI_LENGTHS = [
  { id: "", label: "Any" },
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
];

const EMOJI_CATEGORIES = {
  faces: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😎 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😭 😤 😠 😡 🤬 😳 😱 😨 😰 😥 😓 🤗 🤔 😴 🤤 😪 🤒 🤕 🤠 🤡 💩 👻 💀 🎃".split(" "),
  people: "👩 👩‍🦰 👩‍🦱 👩‍🦳 👩‍🦲 👱‍♀️ 👵 👸 💃 🕺 👯‍♀️ 🧚‍♀️ 🧜‍♀️ 🦸‍♀️ 🧝‍♀️ 🙋‍♀️ 🙆‍♀️ 🙅‍♀️ 🤷‍♀️ 👩‍💻 👩‍🎤 👩‍🎨 👩‍🍳 👰‍♀️ 🤰 🤱".split(" "),
  animals: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐵 🦄 🦋 🐝 🐢 🐙 🐬 🐳 🦈 🐊 🐘 🦒 🦘 🐎 🐕 🐓 🦅 🦆 🦢 🦉 🦚 🦜 🐸".split(" "),
  plants: "🌹 🥀 🌺 🌻 🌼 🌷 🌱 🌲 🌳 🌴 🌵 🌿 🍀 🍁 🍄 🔥 ✨ ⭐ ☀️ 🌙 ☁️ 🌊 🌎".split(" "),
  food: "🍇 🍉 🍊 🍋 🍌 🍍 🍎 🍏 🍐 🍑 🍒 🍓 🥝 🍅 🥥 🥑 🍆 🥔 🥕 🌽 🌶️ 🥒 🥬 🥦 🍞 🥐 🥖 🧀 🍖 🍔 🍟 🍕 🌮 🍣 🍤 🍦 🍩 🍪 🎂 🍰 🧁 🍫 🍬 ☕ 🍵 🍾 🍷 🍸 🍹 🍺 🍻 🥂".split(" "),
  sports: "⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🏒 ⛳ 🏹 🥊 🥋 ⛸️ 🎿 🏂 🏋️ 🤸 🏇 🏊 🏄 🎯 🎳 🎮 🎲 🧩 ♟️".split(" "),
  travel: "🎨 🎬 🎤 🎧 🎹 🥁 🎉 🎊 🎄 🎆 🚀 ✈️ 🚁 🛰️ ⛵ 🚢 🚗 🚕 🚌 🚓 🚑 🚒 🚚 🚂 🚲 🚦 🗽 🗼 🏰 🎡 🎢 🎪 ⛺ 🏠 🏡 🏢 🏨 🏦 🏥 🏫 🏛️ 🏝️ 🏞️ ⛰️".split(" "),
  objects: "💡 💻 🖥️ 🖱️ 📱 ☎️ 📺 📷 📹 🎥 💿 💾 💰 💵 💎 🔧 🔨 🛠️ 🔑 🚪 🪑 🛏️ 🛁 🚽 🎁 🎈 📚 📖 📄 📰 🔗 📎 ✂️ 🗑️ 🔒 🔓 🔔 👗 👠 👑 💍 💄 👛 👜".split(" "),
  symbols: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ ☯️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 💯 ✅ ❌ ❓ ❕ ©️ ®️ ™️".split(" "),
} as const;
const EMOJI_CATEGORY_ORDER = ["all", "faces", "people", "animals", "plants", "food", "sports", "travel", "objects", "symbols"] as const;
type EmojiCategory = (typeof EMOJI_CATEGORY_ORDER)[number];
const EMOJI_CATEGORY_ICONS: Record<EmojiCategory, string> = {
  all: "😀",
  faces: "😀",
  people: "👩",
  animals: "🐶",
  plants: "🌹",
  food: "🍎",
  sports: "⚽",
  travel: "✈️",
  objects: "💡",
  symbols: "❤️",
};

const DRAFT_STORAGE_KEY = "admin-posts-draft";

function EmojiPicker({
  onPick,
  onClose,
  query,
  setQuery,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
  query: string;
  setQuery: (v: string) => void;
}) {
  const [category, setCategory] = useState<EmojiCategory>("all");
  const normalized = query.trim().toLowerCase();
  const visibleEmojis = useMemo(() => {
    const source =
      category === "all"
        ? EMOJI_CATEGORY_ORDER.filter((c) => c !== "all").flatMap((c) => EMOJI_CATEGORIES[c])
        : EMOJI_CATEGORIES[category];
    if (!normalized) return source;
    return source.filter((e) => e.includes(normalized));
  }, [category, normalized]);

  return (
    <div className="admin-emoji-picker-wrap" role="dialog" aria-label="Pick emoji">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search emoji..."
        className="admin-emoji-search"
      />
      <div className="admin-emoji-grid">
        {visibleEmojis.length === 0 ? (
          <p className="admin-emoji-empty">No emoji found.</p>
        ) : (
          visibleEmojis.map((e, i) => (
            <button
              key={`${category}-${i}-${e}`}
              type="button"
              className="admin-emoji-btn"
              onClick={() => {
                onPick(e);
                onClose();
              }}
              aria-label={`Emoji ${e}`}
            >
              {e}
            </button>
          ))
        )}
      </div>
      <div className="admin-emoji-category-bar" role="tablist" aria-label="Emoji categories">
        {EMOJI_CATEGORY_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            className={`admin-emoji-category-btn${category === c ? " active" : ""}`}
            onClick={() => setCategory(c)}
            aria-label={`Show ${c} emoji`}
            title={c}
          >
            {EMOJI_CATEGORY_ICONS[c]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminPostsPage() {
  const { user } = useAuth();
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("edit") || null;

  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(!!editId);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; isVideo: boolean; alt?: string }[]>([]);
  const [caption, setCaption] = useState("");
  const [overlayAnimation, setOverlayAnimation] = useState<(typeof OVERLAY_ANIMATIONS)[number]["id"]>("static");
  const [overlayText, setOverlayText] = useState("");
  const [overlayTextColor, setOverlayTextColor] = useState("#ffffff");
  const [overlayHighlight, setOverlayHighlight] = useState(false);
  const [overlayUnderline, setOverlayUnderline] = useState(false);
  const [overlayItalic, setOverlayItalic] = useState(false);
  const [overlayTextSize, setOverlayTextSize] = useState<number>(18);
  const [hideComments, setHideComments] = useState(false);
  const [hideLikes, setHideLikes] = useState(false);
  const [emojiOpenFor, setEmojiOpenFor] = useState<"caption" | "pollQuestion" | "tipGoal" | "overlayText" | null>(null);
  const [emojiQuery, setEmojiQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [publishLoading, setPublishLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [creatorBio, setCreatorBio] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTone, setAiTone] = useState("");
  const [aiLength, setAiLength] = useState("");
  const [existingPosts, setExistingPosts] = useState<{ id: string; body: string; status?: PostStatus; createdAt: unknown }[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("12:00");
  const [poll, setPoll] = useState<{ question: string; options: string[] } | null>(null);
  const [tipGoalEnabled, setTipGoalEnabled] = useState(false);
  const [tipGoalDescription, setTipGoalDescription] = useState("");
  const [tipGoalTargetDollars, setTipGoalTargetDollars] = useState("");
  const [tipGoalRaisedCents, setTipGoalRaisedCents] = useState(0);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockPriceDollars, setLockPriceDollars] = useState("");
  const [overlaySectionOpen, setOverlaySectionOpen] = useState(false);
  const captionRef = useRef<HTMLTextAreaElement | null>(null);
  const pollQuestionRef = useRef<HTMLInputElement | null>(null);
  const tipGoalRef = useRef<HTMLInputElement | null>(null);
  const overlayTextRef = useRef<HTMLInputElement | null>(null);
  const captionEmojiWrapRef = useRef<HTMLDivElement | null>(null);
  const pollEmojiWrapRef = useRef<HTMLDivElement | null>(null);
  const tipEmojiWrapRef = useRef<HTMLDivElement | null>(null);
  const overlayEmojiWrapRef = useRef<HTMLDivElement | null>(null);

  const insertEmojiAtCursor = (field: "caption" | "pollQuestion" | "tipGoal" | "overlayText", emoji: string) => {
    if (field === "caption") {
      const el = captionRef.current;
      if (!el) return setCaption((c) => c + emoji);
      const start = el.selectionStart ?? caption.length;
      const end = el.selectionEnd ?? caption.length;
      const next = `${caption.slice(0, start)}${emoji}${caption.slice(end)}`;
      setCaption(next);
      return requestAnimationFrame(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
    }
    if (field === "pollQuestion") {
      const current = poll?.question ?? "";
      const el = pollQuestionRef.current;
      const start = el?.selectionStart ?? current.length;
      const end = el?.selectionEnd ?? current.length;
      const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
      setPoll((p) => (p ? { ...p, question: next } : p));
      return requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
    }
    if (field === "tipGoal") {
      const current = tipGoalDescription;
      const el = tipGoalRef.current;
      const start = el?.selectionStart ?? current.length;
      const end = el?.selectionEnd ?? current.length;
      const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
      setTipGoalDescription(next);
      return requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
    }
    const current = overlayText;
    const el = overlayTextRef.current;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
    setOverlayText(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const loadLibrary = useCallback(() => {
    if (!storage) return;
    setLibraryLoading(true);
    listMediaLibrary(storage)
      .then(setLibrary)
      .catch(() => setLibrary([]))
      .finally(() => setLibraryLoading(false));
  }, [storage]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    if (editId) return;
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(DRAFT_STORAGE_KEY) : null;
      if (raw) {
        const d = JSON.parse(raw) as { media?: { url: string; isVideo: boolean; alt?: string }[]; caption?: string };
        if (Array.isArray(d.media) && d.media.length > 0) setSelectedMedia(d.media);
        if (typeof d.caption === "string") setCaption(d.caption);
      }
    } catch {
      // ignore invalid draft
    }
  }, [editId]);

  useEffect(() => {
    if (editId) return;
    try {
      if (selectedMedia.length === 0 && !caption.trim()) {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } else {
        sessionStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({ media: selectedMedia, caption: caption || "" })
        );
      }
    } catch {
      // ignore quota or private mode
    }
  }, [editId, selectedMedia, caption]);

  useEffect(() => {
    if (!editId || !db) {
      if (editId) setEditLoading(false);
      return;
    }
    getDoc(doc(db, "posts", editId))
      .then((snap) => {
        if (!snap.exists()) {
          setEditLoading(false);
          return;
        }
        const d = snap.data();
        setCaption((d.body as string) ?? "");
        setOverlayAnimation((d.captionStyle as (typeof OVERLAY_ANIMATIONS)[number]["id"]) ?? "static");
        setOverlayText((d.overlayText as string) ?? "");
        setOverlayTextColor((d.overlayTextColor as string) ?? "#ffffff");
        setOverlayHighlight(!!d.overlayHighlight);
        setOverlayUnderline(!!d.overlayUnderline);
        setOverlayItalic(!!d.overlayItalic);
        const sizeRaw = d.overlayTextSize;
        const sizeNum = typeof sizeRaw === "number" && sizeRaw >= 10 && sizeRaw <= 72 ? sizeRaw : (sizeRaw === "small" ? 14 : sizeRaw === "large" ? 24 : 18);
        setOverlayTextSize(sizeNum);
        const hasOverlay = !!((d.overlayText as string)?.trim()) || (d.captionStyle as string) !== "static";
        setOverlaySectionOpen(hasOverlay);
        setHideComments(!!d.hideComments);
        setHideLikes(!!d.hideLikes);
        const p = d.poll as { question: string; options: string[] } | undefined;
        if (p?.question && Array.isArray(p.options) && p.options.length >= 2) {
          setPoll({ question: p.question, options: p.options });
        } else {
          setPoll(null);
        }
        const tg = d.tipGoal as { enabled?: boolean; description?: string; targetCents?: number; raisedCents?: number } | undefined;
        if (tg?.enabled && tg.targetCents != null) {
          setTipGoalEnabled(true);
          setTipGoalDescription((tg.description ?? "").toString());
          setTipGoalTargetDollars(tg.targetCents ? String(tg.targetCents / 100) : "");
          setTipGoalRaisedCents(tg.raisedCents ?? 0);
        } else {
          setTipGoalEnabled(false);
          setTipGoalDescription("");
          setTipGoalTargetDollars("");
          setTipGoalRaisedCents(0);
        }
        const locked = d.lockedContent as { enabled?: boolean; priceCents?: number } | undefined;
        if (locked?.enabled) {
          setLockEnabled(true);
          setLockPriceDollars(
            typeof locked.priceCents === "number" && locked.priceCents > 0
              ? String((locked.priceCents / 100).toFixed(2))
              : ""
          );
        } else {
          setLockEnabled(false);
          setLockPriceDollars("");
        }
        const urls = (d.mediaUrls as string[]) ?? [];
        const types = (d.mediaTypes as ("image" | "video")[]) ?? [];
        const alts = (d.altTexts as string[]) ?? [];
        setSelectedMedia(
          urls.map((url, i) => ({
            url,
            isVideo: types[i] === "video" || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url),
            alt: alts[i] ?? "",
          }))
        );
      })
      .catch(() => {})
      .finally(() => setEditLoading(false));
  }, [editId, db]);

  useEffect(() => {
    if (!user || !db) return;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        const d = snap.exists() ? snap.data() : {};
        setCreatorBio((d.bio ?? "").toString().trim());
      })
      .catch(() => {});
  }, [user, db]);

  useEffect(() => {
    if (!db) return;
    getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50)))
      .then((snap) => {
        setExistingPosts(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              body: (data.body ?? "").slice(0, 60),
              status: data.status as PostStatus | undefined,
              createdAt: data.createdAt,
            };
          })
        );
      })
      .catch(() => {});
  }, [db]);

  useEffect(() => {
    if (!emojiOpenFor) return;
    const activeContainer =
      emojiOpenFor === "caption"
        ? captionEmojiWrapRef.current
        : emojiOpenFor === "pollQuestion"
          ? pollEmojiWrapRef.current
          : emojiOpenFor === "tipGoal"
            ? tipEmojiWrapRef.current
            : overlayEmojiWrapRef.current;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (activeContainer?.contains(target)) return;
      setEmojiOpenFor(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [emojiOpenFor]);

  useEffect(() => {
    if (!message || message.type !== "success") return;
    const timer = window.setTimeout(() => setMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  function getCalendarDateAndTime(): { calendarDate: string; calendarTime: string; scheduledAt?: Timestamp; publishedAt?: Timestamp } {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const calendarDate = `${y}-${m}-${d}`;
    const calendarTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return { calendarDate, calendarTime, publishedAt: Timestamp.fromDate(now) };
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !storage) return;
    setUploading(true);
    const file = files[0];
    const isVideo = file.type.startsWith("video/");
    uploadToMediaLibrary(storage, file, setUploadProgress)
      .then((url) => {
        setSelectedMedia((prev) => [...prev, { url, isVideo, alt: "" }]);
        loadLibrary();
      })
      .catch((err) => setMessage({ type: "error", text: (err as Error).message || "Upload failed" }))
      .finally(() => { setUploading(false); setUploadProgress(0); e.target.value = ""; });
  };

  const removeSelected = (index: number) => {
    setSelectedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const setAltAt = (index: number, alt: string) => {
    setSelectedMedia((prev) => prev.map((m, i) => (i === index ? { ...m, alt } : m)));
  };

  const moveMedia = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= selectedMedia.length) return;
    setSelectedMedia((prev) => {
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr;
    });
  };

  const addFromLibrary = (item: MediaItem) => {
    setSelectedMedia((prev) => [...prev, { url: item.url, isVideo: item.isVideo, alt: "" }]);
  };

  const handleAiCaption = async () => {
    setAiLoading(true);
    setMessage(null);
    const hadStarterText = !!caption.trim();
    try {
      const imageUrl = selectedMedia.find((m) => !m.isVideo)?.url ?? selectedMedia[0]?.url ?? "";
      const res = await fetch("/api/caption-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: imageUrl || undefined,
          bio: creatorBio || undefined,
          tone: aiTone || undefined,
          length: aiLength || undefined,
          starterText: caption.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.caption) {
        if (hadStarterText && !imageUrl) setCaption(data.caption);
        else setCaption((c) => (c ? `${c} ${data.caption}` : data.caption));
      } else if (data.error) setMessage({ type: "error", text: data.error });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message || "AI suggestion failed" });
    } finally {
      setAiLoading(false);
    }
  };

  async function savePost(action: "publish" | "schedule" | "draft") {
    if (!db) return;
    const hasMedia = selectedMedia.length > 0;
    const hasCaption = caption.trim().length > 0;
    const hasPoll = !!(poll?.question?.trim() && poll.options.filter((o) => o.trim()).length >= 2);
    const hasAnySavableContent = hasMedia || hasCaption || hasPoll || !!editId;
    if (!hasAnySavableContent) {
      setMessage({ type: "error", text: "Add media, a caption, or a poll." });
      return;
    }
    const lockPriceCents = lockEnabled ? Math.round(parseFloat(lockPriceDollars || "0") * 100) : 0;
    if (lockEnabled && (!Number.isFinite(lockPriceCents) || lockPriceCents < 100 || lockPriceCents > 100000)) {
      setMessage({ type: "error", text: "Set unlock price between $1 and $1000." });
      return;
    }
    const now = new Date();
    let calendarDate: string;
    let calendarTime: string;
    let status: PostStatus;
    let scheduledAt: Timestamp | null = null;
    let publishedAt: Timestamp | null = null;

    if (action === "publish") {
      calendarDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      calendarTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      status = "published";
      publishedAt = Timestamp.fromDate(now);
    } else if (action === "schedule" && scheduleDate && scheduleTime) {
      calendarDate = scheduleDate;
      calendarTime = scheduleTime;
      status = "scheduled";
      const [h, min] = scheduleTime.split(":").map(Number);
      const sched = new Date(scheduleDate);
      sched.setHours(h, min, 0, 0);
      scheduledAt = Timestamp.fromDate(sched);
    } else if (action === "draft") {
      calendarDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      calendarTime = "";
      status = "draft";
    } else {
      if (action === "schedule") setMessage({ type: "error", text: "Pick date and time for schedule." });
      return;
    }

    setPublishLoading(true);
    setMessage(null);
    try {
      const altTextsArr = selectedMedia.map((m) => (m.alt ?? "").trim()).filter(Boolean);
      const payload: Record<string, unknown> = {
        title: caption.slice(0, 80) || "Untitled",
        body: caption,
        mediaUrls: selectedMedia.map((m) => m.url),
        mediaTypes: selectedMedia.map((m) => (m.isVideo ? "video" : "image")),
        captionStyle: overlayAnimation,
        hideComments,
        hideLikes,
        status,
        calendarDate,
        scheduledAt: scheduledAt ?? null,
        publishedAt: publishedAt ?? null,
        published: status === "published",
        likeCount: 0,
        comments: [],
        viewCount: 0,
      };
      if (altTextsArr.length > 0) payload.altTexts = selectedMedia.map((m) => (m.alt ?? "").trim() || "");
      if (overlayText.trim()) {
        payload.overlayText = overlayText.trim();
        payload.overlayTextColor = overlayTextColor;
        payload.overlayHighlight = overlayHighlight;
        payload.overlayUnderline = overlayUnderline;
        payload.overlayItalic = overlayItalic;
        payload.overlayTextSize = overlayTextSize;
      }
      if (poll?.question?.trim() && poll.options.filter((o) => o.trim()).length >= 2) {
        payload.poll = { question: poll.question.trim(), options: poll.options.map((o) => o.trim()).filter(Boolean) };
      }
      if (tipGoalEnabled && tipGoalDescription.trim() && tipGoalTargetDollars) {
        payload.tipGoal = {
          enabled: true,
          description: tipGoalDescription.trim(),
          targetCents: Math.round(parseFloat(tipGoalTargetDollars) * 100) || 0,
          raisedCents: tipGoalRaisedCents,
        };
      }
      payload.lockedContent = {
        enabled: lockEnabled,
        priceCents: lockEnabled ? lockPriceCents : 0,
      };
      if (calendarTime) payload.calendarTime = calendarTime;

      if (editId) {
        await updateDoc(doc(db, "posts", editId), { ...payload, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "posts"), { ...payload, createdAt: serverTimestamp() });
      }
      setMessage({
        type: "success",
        text: editId
          ? "Post updated."
          : action === "publish"
            ? "Post published and added to calendar (green)."
            : action === "schedule"
              ? "Post scheduled and added to calendar (pink)."
              : "Draft saved and added to calendar (grey).",
      });
      if (!editId) {
        try {
          sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {}
        setCaption("");
        setSelectedMedia([]);
        setOverlayAnimation("static");
        setOverlayText("");
        setOverlayTextColor("#ffffff");
        setOverlayHighlight(false);
        setOverlayUnderline(false);
        setOverlayItalic(false);
        setOverlayTextSize(18);
        setHideComments(false);
        setHideLikes(false);
        setPoll(null);
        setTipGoalEnabled(false);
        setTipGoalDescription("");
        setTipGoalTargetDollars("");
        setTipGoalRaisedCents(0);
        setLockEnabled(false);
        setLockPriceDollars("");
      }
      setShowScheduleModal(false);
      setScheduleDate("");
      setScheduleTime("12:00");
      getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50)))
        .then((snap) => {
          setExistingPosts(
            snap.docs.map((d) => {
              const data = d.data();
              return { id: d.id, body: (data.body ?? "").slice(0, 60), status: data.status as PostStatus | undefined, createdAt: data.createdAt };
            })
          );
        })
        .catch(() => {});
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message || "Failed to save" });
    } finally {
      setPublishLoading(false);
    }
  }

  const handlePublishNow = (e: React.FormEvent) => {
    e.preventDefault();
    savePost("publish");
  };

  const handleScheduleClick = (e: React.FormEvent) => {
    e.preventDefault();
    const hasMedia = selectedMedia.length > 0;
    const hasCaption = caption.trim().length > 0;
    const hasPoll = !!(poll?.question?.trim() && poll.options.filter((o) => o.trim()).length >= 2);
    const hasAnySavableContent = hasMedia || hasCaption || hasPoll || !!editId;
    if (!hasAnySavableContent) {
      setMessage({ type: "error", text: "Add media, a caption, or a poll." });
      return;
    }
    const today = new Date();
    setScheduleDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
    setShowScheduleModal(true);
  };

  const handleScheduleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    savePost("schedule");
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    savePost("draft");
  };

  const handleUnlockPostNow = async () => {
    if (!db || !editId) {
      setLockEnabled(false);
      setLockPriceDollars("");
      return;
    }
    setPublishLoading(true);
    setMessage(null);
    try {
      await updateDoc(doc(db, "posts", editId), {
        lockedContent: { enabled: false, priceCents: 0 },
        updatedAt: serverTimestamp(),
      });
      setLockEnabled(false);
      setLockPriceDollars("");
      setMessage({ type: "success", text: "Post unlocked." });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message || "Could not unlock post." });
    } finally {
      setPublishLoading(false);
    }
  };

  const handleDeletePost = async () => {
    if (!db || !editId) return;
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setPublishLoading(true);
    setMessage(null);
    try {
      await deleteDoc(doc(db, "posts", editId));
      setMessage({ type: "success", text: "Post deleted." });
      router.push("/admin/posts");
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message || "Could not delete post." });
    } finally {
      setPublishLoading(false);
    }
  };

  const handleExitEditing = () => {
    router.push("/admin/posts");
  };

  if (editLoading) {
    return (
      <main className="admin-main admin-posts-main" style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1>Post</h1>
        <p className="admin-posts-loading">Loading post…</p>
      </main>
    );
  }

  const hasMedia = selectedMedia.length > 0;
  const hasCaption = caption.trim().length > 0;
  const hasPoll = !!(poll?.question?.trim() && poll.options.filter((o) => o.trim()).length >= 2);
  const canSavePost = hasMedia || hasCaption || hasPoll || !!editId;

  return (
    <main className="admin-main admin-posts-main">
      <div className="admin-posts-one-card">
        <h1>Post</h1>
        <p className="admin-posts-intro">Create and schedule member feed posts. Add media, write a caption, and publish now or schedule for later.</p>
        {editId && (
          <div className="admin-posts-edit-badge-wrap">
            <p className="admin-posts-edit-badge">Editing post</p>
            <button type="button" className="btn btn-secondary" onClick={handleExitEditing}>
              Exit editing
            </button>
          </div>
        )}

        {message && (
          <p className={`admin-posts-message admin-posts-message-${message.type}`} role="alert">
            {message.text}
          </p>
        )}

        <form onSubmit={(e) => e.preventDefault()} className="admin-posts-form">
          <section className="admin-posts-card-section">
            <h2 className="admin-posts-card-heading">Media</h2>
            <div className="admin-posts-selected">
            {selectedMedia.map((m, i) => (
              <div key={i} className="admin-posts-thumb-wrap">
                <div className="admin-posts-thumb">
                  {m.isVideo ? (
                    <video src={m.url} muted playsInline className="admin-posts-thumb-media" />
                  ) : (
                    <img src={m.url} alt={m.alt || ""} className="admin-posts-thumb-media" loading="lazy" decoding="async" />
                  )}
                  <button type="button" className="admin-posts-thumb-remove" onClick={() => removeSelected(i)} aria-label="Remove">×</button>
                </div>
              </div>
            ))}
            <div className="admin-posts-media-buttons">
              <label className="admin-posts-btn-upload">
                <input type="file" accept="image/*,video/*" onChange={handleUpload} disabled={uploading} className="sr-only" />
                {uploading ? `Uploading… ${Math.round(uploadProgress)}%` : "Upload from device"}
              </label>
              <button type="button" className="admin-posts-btn-library" onClick={() => { loadLibrary(); setShowLibraryModal(true); }}>
                From library
              </button>
            </div>
          </div>
          </section>

          <section className="admin-posts-card-section">
            <h2 className="admin-posts-card-heading">Caption</h2>
            <div className="admin-posts-caption-wrap" ref={captionEmojiWrapRef}>
              <textarea
                ref={captionRef}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption…"
                className="admin-posts-caption-input"
                rows={4}
                maxLength={2200}
              />
              <button
                type="button"
                className="admin-posts-emoji-trigger admin-posts-emoji-trigger-inline"
                onClick={() => {
                  setEmojiOpenFor((o) => (o === "caption" ? null : "caption"));
                  setEmojiQuery("");
                }}
                aria-label="Add emoji"
              >
                😀
              </button>
              {emojiOpenFor === "caption" && (
                <div className="admin-emoji-picker-inline">
                  <EmojiPicker
                    onPick={(emoji) => insertEmojiAtCursor("caption", emoji)}
                    onClose={() => setEmojiOpenFor(null)}
                    query={emojiQuery}
                    setQuery={setEmojiQuery}
                  />
                </div>
              )}
            </div>
            <div className="admin-posts-caption-toolbar">
              <select value={aiTone} onChange={(e) => setAiTone(e.target.value)} className="admin-posts-ai-select" aria-label="AI tone">
                {AI_TONES.map((t) => (
                  <option key={t.id || "default"} value={t.id}>{t.label}</option>
                ))}
              </select>
              <select value={aiLength} onChange={(e) => setAiLength(e.target.value)} className="admin-posts-ai-select" aria-label="AI length">
                {AI_LENGTHS.map((l) => (
                  <option key={l.id || "any"} value={l.id}>{l.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="admin-posts-ai-btn"
                onClick={handleAiCaption}
                disabled={aiLoading}
              >
                {aiLoading ? "…" : "✨ AI suggest"}
              </button>
            </div>
          </section>

          <section className="admin-posts-card-section">
            <h2 className="admin-posts-card-heading">Poll</h2>
            {poll === null ? (
              <button type="button" className="admin-posts-poll-add" onClick={() => setPoll({ question: "", options: ["", ""] })}>
                + Add poll
              </button>
            ) : (
              <div className="admin-posts-poll-block">
                <div className="admin-posts-input-emoji-wrap" ref={pollEmojiWrapRef}>
                  <input
                    ref={pollQuestionRef}
                    type="text"
                    value={poll.question}
                    onChange={(e) => setPoll((p) => (p ? { ...p, question: e.target.value } : null))}
                    placeholder="Poll question"
                    className="admin-posts-poll-question admin-posts-input-with-emoji"
                  />
                  <button
                    type="button"
                    className="admin-posts-emoji-trigger admin-posts-emoji-trigger-field"
                    onClick={() => {
                      setEmojiOpenFor((o) => (o === "pollQuestion" ? null : "pollQuestion"));
                      setEmojiQuery("");
                    }}
                    aria-label="Add emoji to poll question"
                  >
                    😀
                  </button>
                  {emojiOpenFor === "pollQuestion" && (
                    <div className="admin-emoji-picker-inline admin-emoji-picker-inline-field">
                      <EmojiPicker
                        onPick={(emoji) => insertEmojiAtCursor("pollQuestion", emoji)}
                        onClose={() => setEmojiOpenFor(null)}
                        query={emojiQuery}
                        setQuery={setEmojiQuery}
                      />
                    </div>
                  )}
                </div>
                <div className="admin-posts-poll-options">
                  {poll.options.map((opt, i) => (
                    <div key={i} className="admin-posts-poll-option-row">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) =>
                          setPoll((p) =>
                            p ? { ...p, options: p.options.map((o, j) => (j === i ? e.target.value : o)) } : null
                          )
                        }
                        placeholder={`Option ${i + 1}`}
                        className="admin-posts-poll-option-input"
                      />
                      <button
                        type="button"
                        className="admin-posts-poll-option-remove"
                        onClick={() => setPoll((p) => (p && p.options.length > 2 ? { ...p, options: p.options.filter((_, j) => j !== i) } : p))}
                        aria-label="Remove option"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="admin-posts-poll-actions">
                  {poll.options.length < 6 && (
                    <button type="button" className="admin-posts-poll-option-add" onClick={() => setPoll((p) => (p ? { ...p, options: [...p.options, ""] } : null))}>
                      + Option
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => savePost("draft")}
                    disabled={publishLoading || !canSavePost}
                  >
                    Save
                  </button>
                  <button type="button" className="btn btn-secondary admin-posts-poll-remove" onClick={() => setPoll(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="admin-posts-card-section">
            <h2 className="admin-posts-card-heading">Tip goal</h2>
            {!tipGoalEnabled ? (
              <button type="button" className="admin-posts-poll-add" onClick={() => setTipGoalEnabled(true)}>
                + Enable tips for this post
              </button>
            ) : (
              <div className="admin-posts-tip-goal-block">
                <div className="admin-posts-input-emoji-wrap" ref={tipEmojiWrapRef}>
                  <input
                    ref={tipGoalRef}
                    type="text"
                    value={tipGoalDescription}
                    onChange={(e) => setTipGoalDescription(e.target.value)}
                    placeholder="What are tips for? e.g. If I raise $500 I’ll take my top off and show my bra"
                    className="admin-posts-overlay-text-input admin-posts-input-with-emoji"
                    maxLength={300}
                  />
                  <button
                    type="button"
                    className="admin-posts-emoji-trigger admin-posts-emoji-trigger-field"
                    onClick={() => {
                      setEmojiOpenFor((o) => (o === "tipGoal" ? null : "tipGoal"));
                      setEmojiQuery("");
                    }}
                    aria-label="Add emoji to tip goal"
                  >
                    😀
                  </button>
                  {emojiOpenFor === "tipGoal" && (
                    <div className="admin-emoji-picker-inline admin-emoji-picker-inline-field">
                      <EmojiPicker
                        onPick={(emoji) => insertEmojiAtCursor("tipGoal", emoji)}
                        onClose={() => setEmojiOpenFor(null)}
                        query={emojiQuery}
                        setQuery={setEmojiQuery}
                      />
                    </div>
                  )}
                </div>
                <div className="admin-posts-tip-goal-row">
                  <label className="admin-posts-overlay-label">Target ($)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={tipGoalTargetDollars}
                    onChange={(e) => setTipGoalTargetDollars(e.target.value)}
                    placeholder="500"
                    className="admin-posts-tip-goal-amount"
                  />
                </div>
                {tipGoalTargetDollars && parseFloat(tipGoalTargetDollars) > 0 && (
                  <div className="admin-posts-tip-goal-bar-wrap">
                    <div className="admin-posts-tip-goal-bar">
                      <div
                        className="admin-posts-tip-goal-bar-fill"
                        style={{
                          width: `${Math.min(100, (tipGoalRaisedCents / (parseFloat(tipGoalTargetDollars) * 100)) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="admin-posts-tip-goal-raised">
                      ${(tipGoalRaisedCents / 100).toFixed(2)} of ${parseFloat(tipGoalTargetDollars).toFixed(2)} raised
                    </p>
                  </div>
                )}
                <div className="admin-posts-poll-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => savePost("draft")}
                    disabled={publishLoading || !canSavePost}
                  >
                    Save
                  </button>
                  <button type="button" className="btn btn-secondary admin-posts-poll-remove" onClick={() => { setTipGoalEnabled(false); setTipGoalDescription(""); setTipGoalTargetDollars(""); setTipGoalRaisedCents(0); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="admin-posts-card-section">
            <h2 className="admin-posts-card-heading">Lock / Unlock</h2>
            {!lockEnabled ? (
              <button type="button" className="admin-posts-poll-add" onClick={() => setLockEnabled(true)}>
                + Lock this post behind paid unlock
              </button>
            ) : (
              <div className="admin-posts-tip-goal-block">
                <p className="admin-posts-hint">
                  Blur all post media and require one-time payment to unlock permanently for that customer.
                </p>
                <div className="admin-posts-tip-goal-row">
                  <label className="admin-posts-overlay-label">Unlock price ($)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    value={lockPriceDollars}
                    onChange={(e) => setLockPriceDollars(e.target.value)}
                    placeholder="10"
                    className="admin-posts-tip-goal-amount"
                  />
                </div>
                <div className="admin-posts-poll-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => savePost("draft")}
                    disabled={publishLoading || !canSavePost}
                  >
                    Save
                  </button>
                  {editId && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleUnlockPostNow}
                      disabled={publishLoading}
                    >
                      Unlock post
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary admin-posts-poll-remove"
                    onClick={() => {
                      setLockEnabled(false);
                      setLockPriceDollars("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="admin-posts-card-section">
            <h2 className="admin-posts-card-heading">Text overlay (on image)</h2>
            {!overlaySectionOpen ? (
              <button type="button" className="admin-posts-poll-add" onClick={() => setOverlaySectionOpen(true)}>
                + Add text overlay (on image)
              </button>
            ) : (
              <>
                <p className="admin-posts-hint">Optional text on the image.</p>
                <div className="admin-posts-overlay-row">
                  <label className="admin-posts-overlay-label">Animation</label>
                  <select
                    value={overlayAnimation}
                    onChange={(e) => setOverlayAnimation(e.target.value as (typeof OVERLAY_ANIMATIONS)[number]["id"])}
                    className="admin-posts-overlay-select"
                    aria-label="Overlay animation"
                  >
                    {OVERLAY_ANIMATIONS.map((a) => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-posts-overlay-row">
                  <label className="admin-posts-overlay-label">Overlay text</label>
                  <div className="admin-posts-input-emoji-wrap" ref={overlayEmojiWrapRef}>
                    <input
                      ref={overlayTextRef}
                      type="text"
                      value={overlayText}
                      onChange={(e) => setOverlayText(e.target.value)}
                      placeholder="Quote or line to show on the image…"
                      className="admin-posts-overlay-text-input admin-posts-input-with-emoji"
                      maxLength={500}
                    />
                    <button
                      type="button"
                      className="admin-posts-emoji-trigger admin-posts-emoji-trigger-field"
                      onClick={() => {
                        setEmojiOpenFor((o) => (o === "overlayText" ? null : "overlayText"));
                        setEmojiQuery("");
                      }}
                      aria-label="Add emoji to overlay text"
                    >
                      😀
                    </button>
                    {emojiOpenFor === "overlayText" && (
                      <div className="admin-emoji-picker-inline admin-emoji-picker-inline-field">
                        <EmojiPicker
                          onPick={(emoji) => insertEmojiAtCursor("overlayText", emoji)}
                          onClose={() => setEmojiOpenFor(null)}
                          query={emojiQuery}
                          setQuery={setEmojiQuery}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="admin-posts-overlay-row admin-posts-overlay-format">
                  <span className="admin-posts-overlay-label">Text color</span>
                  <input
                    type="color"
                    value={overlayTextColor}
                    onChange={(e) => setOverlayTextColor(e.target.value)}
                    className="admin-posts-color-picker"
                    aria-label="Overlay text color"
                  />
                  <span className="admin-posts-overlay-label">Text size</span>
                  <input
                    type="number"
                    min={10}
                    max={72}
                    value={overlayTextSize}
                    onChange={(e) => setOverlayTextSize(e.target.value === "" ? 18 : Math.max(10, Math.min(72, Number(e.target.value) || 18)))}
                    placeholder="18"
                    aria-label="Overlay text size (px)"
                    className="admin-posts-overlay-size-input"
                  />
                  <span className="admin-posts-overlay-label">Format</span>
                  <div className="admin-posts-format-buttons">
                    <button
                      type="button"
                      className={`admin-posts-format-btn${overlayHighlight ? " active" : ""}`}
                      onClick={() => setOverlayHighlight((v) => !v)}
                      aria-pressed={overlayHighlight}
                      title="Highlight"
                    >
                      Highlight
                    </button>
                    <button
                      type="button"
                      className={`admin-posts-format-btn${overlayUnderline ? " active" : ""}`}
                      onClick={() => setOverlayUnderline((v) => !v)}
                      aria-pressed={overlayUnderline}
                      title="Underline"
                    >
                      Underline
                    </button>
                    <button
                      type="button"
                      className={`admin-posts-format-btn${overlayItalic ? " active" : ""}`}
                      onClick={() => setOverlayItalic((v) => !v)}
                      aria-pressed={overlayItalic}
                      title="Italic"
                    >
                      Italic
                    </button>
                  </div>
                </div>
                <div className="admin-posts-poll-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => savePost("draft")}
                    disabled={publishLoading || !(selectedMedia.length > 0 || caption.trim() || (poll?.question?.trim() && poll.options.filter((o) => o.trim()).length >= 2))}
                  >
                    Save
                  </button>
                  <button type="button" className="btn btn-secondary admin-posts-poll-remove" onClick={() => setOverlaySectionOpen(false)}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="admin-posts-card-section">
            <h2 className="admin-posts-card-heading">Options</h2>
            <div className="admin-posts-option-buttons">
              <button
                type="button"
                className={`admin-posts-option-btn${hideComments ? " active" : ""}`}
                onClick={() => setHideComments((v) => !v)}
                aria-pressed={hideComments}
              >
                Hide comments
              </button>
              <button
                type="button"
                className={`admin-posts-option-btn${hideLikes ? " active" : ""}`}
                onClick={() => setHideLikes((v) => !v)}
                aria-pressed={hideLikes}
              >
                Hide likes
              </button>
            </div>
          </section>

          <div className="admin-posts-actions">
            <button type="button" className="btn btn-primary" onClick={handlePublishNow} disabled={publishLoading || !canSavePost}>
              {publishLoading ? "Saving…" : "Publish now"}
            </button>
            <button type="button" className="btn btn-secondary admin-posts-schedule-btn" onClick={handleScheduleClick} disabled={publishLoading || !canSavePost}>
              Schedule
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleSaveDraft} disabled={publishLoading || !canSavePost}>
              Save as draft
            </button>
            {editId && (
              <button type="button" className="btn btn-secondary" onClick={handleDeletePost} disabled={publishLoading}>
                Delete post
              </button>
            )}
          </div>
        </form>

      {showLibraryModal && (
        <div className="admin-posts-overlay" onClick={() => setShowLibraryModal(false)}>
          <div className="admin-posts-library-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Choose from library</h3>
            <p className="admin-posts-hint">Click an image or video to add it to your post.</p>
            {libraryLoading ? (
              <p className="admin-posts-loading">Loading library…</p>
            ) : library.length === 0 ? (
              <p className="admin-posts-loading">No media in library. Upload from device or from the Media page.</p>
            ) : (
              <div className="admin-posts-library-grid">
                {library
                  .filter((item) => !selectedMedia.some((m) => m.url === item.url))
                  .map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      className="admin-posts-library-item"
                      onClick={() => { addFromLibrary(item); setShowLibraryModal(false); }}
                      title={item.name}
                    >
                      {item.isVideo ? (
                        <video src={item.url} muted playsInline className="admin-posts-library-media" />
                      ) : (
                        <LazyMediaImage src={item.url} alt="" className="admin-posts-library-media" loading="lazy" />
                      )}
                    </button>
                  ))}
              </div>
            )}
            <div className="admin-posts-library-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowLibraryModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {showScheduleModal && (
        <div className="admin-posts-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="admin-posts-modal" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <h3>Schedule post</h3>
            <p className="admin-posts-hint">Choose date and time. Post will appear on the calendar in pink until it’s published.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (scheduleDate && scheduleTime && !publishLoading) savePost("schedule");
              }}
            >
              <div className="admin-posts-form-row">
                <label>Date</label>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} required />
              </div>
              <div className="admin-posts-form-row">
                <label>Time</label>
                <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} required />
              </div>
              <div className="admin-posts-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!scheduleDate || !scheduleTime || publishLoading}
                >
                  {publishLoading ? "Saving…" : "Schedule post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {existingPosts.length > 0 && (
        <section className="admin-posts-card-section admin-posts-recent">
          <h2 className="admin-posts-card-heading">Recent posts</h2>
          <ul className="admin-posts-list">
            {existingPosts.map((p) => (
              <li key={p.id}>
                <Link href={`/post/${p.id}`} className="admin-posts-list-link">{p.body || "Untitled"}…</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </main>
  );
}
