"use client";

import Link from "next/link";
import { useEffect, useState, useMemo, useRef } from "react";
import { collection, getDocs, query, orderBy, limit, doc, runTransaction, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { isAdminEmail } from "../../../lib/auth-redirect";

const GridIcon = () => (
  <svg className="icon-grid" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const HeartOutline = () => (
  <svg className="heart-outline" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const HeartFilled = () => (
  <svg className="heart-filled" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const CommentIcon = () => (
  <svg className="feed-card-comment-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const BookmarkOutline = () => (
  <svg className="bookmark-outline" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const BookmarkFilled = () => (
  <svg className="bookmark-filled" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const PencilIcon = () => (
  <svg className="feed-card-edit-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const MediaImageIcon = () => (
  <svg className="feed-card-count-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
    <circle cx="8.5" cy="10" r="1.5" />
    <path d="M21 15l-4.5-4.5a1 1 0 0 0-1.4 0L9 16.6" />
  </svg>
);

const MediaVideoIcon = () => (
  <svg className="feed-card-count-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="6" width="13" height="12" rx="2" ry="2" />
    <path d="M16 10l5-3v10l-5-3z" />
  </svg>
);

/** Format post date as relative time */
function formatRelativeDate(dateInput: Date | string | { toDate?: () => Date } | null | undefined): string {
  let date: Date | null = null;
  if (dateInput instanceof Date) date = dateInput;
  else if (typeof dateInput === "string") date = new Date(dateInput);
  else if (dateInput && typeof (dateInput as { toDate?: () => Date }).toDate === "function") date = (dateInput as { toDate: () => Date }).toDate();
  if (!date || Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffMs / 604800000);
  const diffMonths = Math.floor(diffMs / 2592000000);
  if (diffMs < 60000) return "Just now";
  if (diffMs < 3600000) return `${diffMins} min${diffMins !== 1 ? "s" : ""}`;
  if (diffMs < 86400000) return `${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
  if (diffMs < 604800000) return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
  if (diffMs < 2592000000) return `${diffWeeks} week${diffWeeks !== 1 ? "s" : ""}`;
  if (diffMs < 31536000000) return `${diffMonths} month${diffMonths !== 1 ? "s" : ""}`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export type FeedPost = {
  id: string;
  body: string;
  mediaUrls: string[];
  mediaTypes?: ("image" | "video")[];
  dateStr?: string;
  createdAt?: { toDate: () => Date };
  likeCount: number;
  likedBy?: string[];
  comments: { username?: string; author?: string; text: string; hidden?: boolean }[];
  captionStyle?: "static" | "scroll-up" | "scroll-across" | "dissolve";
  overlayTextSize?: number;
  hideComments?: boolean;
  hideLikes?: boolean;
  poll?: { question: string; options: string[]; optionVotes?: number[] };
  tipGoal?: { description: string; targetCents: number; raisedCents: number };
  lockedContent?: { enabled?: boolean; priceCents?: number };
};

function displayPublicName(nameLike: string): string {
  const n = (nameLike || "").toString().trim();
  if (!n) return "user";
  if (isAdminEmail(n.includes("@") ? n : null)) return "stormij";
  if (/^will\b/i.test(n) || /will[\s_.-]*jackson/i.test(n)) return "stormij";
  return n;
}

function getCommentAvatarName(nameLike: string): string {
  const name = displayPublicName(nameLike);
  return name || "user";
}

const COMMENT_EMOJI_CATEGORIES = {
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
const COMMENT_EMOJI_CATEGORY_ORDER = ["all", "faces", "people", "animals", "plants", "food", "sports", "travel", "objects", "symbols"] as const;
type CommentEmojiCategory = (typeof COMMENT_EMOJI_CATEGORY_ORDER)[number];
const COMMENT_EMOJI_CATEGORY_ICONS: Record<CommentEmojiCategory, string> = {
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

function FeedCardCaptionOverlay({ caption, style: captionStyle, size }: { caption: string; style?: string; size?: number }) {
  if (!caption?.trim()) return null;
  return (
    <div className={`feed-card-caption-overlay feed-card-caption-overlay-${captionStyle || "static"}`} aria-hidden>
      <span className="feed-card-caption-overlay-text" style={size != null && size > 0 ? { fontSize: `${size}px` } : undefined}>{caption}</span>
    </div>
  );
}

function FeedCard({
  post,
  showAdminEdit,
  onCommentsUpdated,
  onLikeUpdated,
  currentUser,
  savedPostIds,
  onSavedUpdated,
}: {
  post: FeedPost;
  showAdminEdit?: boolean;
  onCommentsUpdated?: (postId: string, comments: FeedPost["comments"]) => void;
  onLikeUpdated?: (postId: string, likedBy: string[], likeCount: number) => void;
  currentUser: { uid: string; email: string | null; displayName: string | null } | null;
  savedPostIds: string[];
  unlockedPostIds: string[];
  onSavedUpdated?: (savedIds: string[]) => void;
  onUnlockRequest?: (postId: string) => Promise<boolean>;
}) {
  const firstUrl = post.mediaUrls?.[0];
  const isVideo = post.mediaTypes?.[0] === "video" || (firstUrl && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(firstUrl));
  const mediaTotals = useMemo(() => {
    const items = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
    return items.reduce(
      (acc, url, index) => {
        const explicitType = post.mediaTypes?.[index];
        const detectedType =
          explicitType === "video" || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url || "")
            ? "video"
            : "image";
        if (detectedType === "video") acc.videos += 1;
        else acc.images += 1;
        return acc;
      },
      { images: 0, videos: 0 }
    );
  }, [post.mediaUrls, post.mediaTypes]);
  const dateStr = post.dateStr ?? (post.createdAt?.toDate ? formatRelativeDate(post.createdAt) : "");
  const captionStyle = post.captionStyle ?? "static";
  const showCaptionOnMedia = captionStyle !== "static" && post.body?.trim();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentActionIndex, setCommentActionIndex] = useState<number | null>(null);
  const [likeSaving, setLikeSaving] = useState(false);
  const [modalComment, setModalComment] = useState("");
  const [modalCommentSaving, setModalCommentSaving] = useState(false);
  const [commentEmojiOpen, setCommentEmojiOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");
  const [emojiCategory, setEmojiCategory] = useState<CommentEmojiCategory>("all");
  const db = getFirebaseDb();
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const commentEmojiWrapRef = useRef<HTMLDivElement | null>(null);
  const visibleComments = useMemo(() => post.comments.filter((c) => !c.hidden), [post.comments]);
  const commentsForViewer = showAdminEdit ? post.comments : visibleComments;
  const isLiked = !!currentUser?.uid && (post.likedBy ?? []).includes(currentUser.uid);
  const isSaved = savedPostIds.includes(post.id);
  const isLockedForViewer =
    !!post.lockedContent?.enabled &&
    (post.lockedContent?.priceCents ?? 0) >= 100 &&
    !unlockedPostIds.includes(post.id);
  const [unlockLoading, setUnlockLoading] = useState(false);

  const visibleEmojis = useMemo(() => {
    const q = emojiQuery.trim().toLowerCase();
    const source =
      emojiCategory === "all"
        ? COMMENT_EMOJI_CATEGORY_ORDER.filter((c) => c !== "all").flatMap((c) => COMMENT_EMOJI_CATEGORIES[c])
        : COMMENT_EMOJI_CATEGORIES[emojiCategory];
    if (!q) return source;
    return source.filter((e) => e.includes(q));
  }, [emojiCategory, emojiQuery]);

  useEffect(() => {
    if (!commentEmojiOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (commentEmojiWrapRef.current?.contains(target)) return;
      setCommentEmojiOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [commentEmojiOpen]);

  const toggleHideComment = async (index: number) => {
    if (!showAdminEdit || !db || !post.id) return;
    setCommentActionIndex(index);
    try {
      const postRef = doc(db, "posts", post.id);
      let nextComments: FeedPost["comments"] = post.comments;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(postRef);
        if (!snap.exists()) throw new Error("Post not found.");
        const data = snap.data() as Record<string, unknown>;
        const existing = Array.isArray(data.comments) ? ([...data.comments] as FeedPost["comments"]) : [];
        if (!existing[index]) return;
        const target = existing[index]!;
        existing[index] = { ...target, hidden: !target.hidden };
        tx.update(postRef, { comments: existing });
        nextComments = existing;
      });
      onCommentsUpdated?.(post.id, nextComments);
    } finally {
      setCommentActionIndex(null);
    }
  };

  const deleteComment = async (index: number) => {
    if (!showAdminEdit || !db || !post.id) return;
    setCommentActionIndex(index);
    try {
      const postRef = doc(db, "posts", post.id);
      let nextComments: FeedPost["comments"] = post.comments;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(postRef);
        if (!snap.exists()) throw new Error("Post not found.");
        const data = snap.data() as Record<string, unknown>;
        const existing = Array.isArray(data.comments) ? ([...data.comments] as FeedPost["comments"]) : [];
        if (!existing[index]) return;
        existing.splice(index, 1);
        tx.update(postRef, { comments: existing });
        nextComments = existing;
      });
      onCommentsUpdated?.(post.id, nextComments);
    } finally {
      setCommentActionIndex(null);
    }
  };

  const toggleLike = async () => {
    if (!db || !post.id || !currentUser?.uid || likeSaving) return;
    setLikeSaving(true);
    try {
      const postRef = doc(db, "posts", post.id);
      let nextLikedBy = post.likedBy ?? [];
      let nextLikeCount = post.likeCount ?? 0;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(postRef);
        if (!snap.exists()) throw new Error("Post not found.");
        const data = snap.data() as Record<string, unknown>;
        const existingLikedBy = Array.isArray(data.likedBy)
          ? (data.likedBy as unknown[]).map((v) => String(v))
          : [];
        const uid = currentUser.uid;
        const hasLiked = existingLikedBy.includes(uid);
        nextLikedBy = hasLiked ? existingLikedBy.filter((v) => v !== uid) : [...existingLikedBy, uid];
        nextLikeCount = nextLikedBy.length;
        tx.update(postRef, { likedBy: nextLikedBy, likeCount: nextLikeCount });
      });
      onLikeUpdated?.(post.id, nextLikedBy, nextLikeCount);
    } finally {
      setLikeSaving(false);
    }
  };

  const insertEmojiAtCursor = (emoji: string) => {
    const el = commentInputRef.current;
    const current = modalComment;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
    setModalComment(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const submitModalComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !post.id || !currentUser) return;
    const text = modalComment.trim();
    if (!text || modalCommentSaving) return;
    setModalCommentSaving(true);
    try {
      const postRef = doc(db, "posts", post.id);
      const username = isAdminEmail(currentUser.email ?? null)
        ? "stormij"
        : (currentUser.displayName || currentUser.email?.split("@")[0] || "member").toString().trim().slice(0, 60);
      let nextComments: FeedPost["comments"] = post.comments;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(postRef);
        if (!snap.exists()) throw new Error("Post not found.");
        const data = snap.data() as Record<string, unknown>;
        const existing = Array.isArray(data.comments) ? (data.comments as FeedPost["comments"]) : [];
        nextComments = [...existing, { username, text: text.slice(0, 500) }];
        tx.update(postRef, { comments: nextComments });
      });
      onCommentsUpdated?.(post.id, nextComments);
      setModalComment("");
      setCommentEmojiOpen(false);
    } finally {
      setModalCommentSaving(false);
    }
  };

  const toggleSavePost = async () => {
    if (!db || !currentUser?.uid || !post.id) return;
    const userRef = doc(db, "users", currentUser.uid);
    let nextSaved = savedPostIds;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
      const existing = Array.isArray(data.savedPostIds)
        ? (data.savedPostIds as unknown[]).map((v) => String(v))
        : [];
      const has = existing.includes(post.id);
      nextSaved = has ? existing.filter((id) => id !== post.id) : [...existing, post.id];
      tx.set(
        userRef,
        {
          savedPostIds: nextSaved,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
    onSavedUpdated?.(nextSaved);
  };

  const startUnlock = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!post.id || !onUnlockRequest || unlockLoading) return;
    setUnlockLoading(true);
    try {
      await onUnlockRequest(post.id);
    } finally {
      setUnlockLoading(false);
    }
  };

  return (
    <article className={`feed-card${commentsOpen ? " comments-open" : ""}`} key={post.id}>
      <div className="feed-card-header">
        <div className="feed-card-avatar">
          <img src="/assets/sj-heart-avatar.png" alt="stormij" className="feed-card-avatar-img" />
        </div>
        <div className="feed-card-creator">
          <span className="feed-card-username">stormij</span>
        </div>
        <span className="feed-card-time">{dateStr}</span>
        {showAdminEdit && (
          <Link href={`/admin/posts?edit=${post.id}`} className="feed-card-edit" title="Edit post" aria-label="Edit post">
            <PencilIcon />
          </Link>
        )}
      </div>

      <Link href={`/post/${post.id}`} className="feed-card-media-wrap">
        {firstUrl &&
          (isVideo ? (
            <video src={firstUrl} muted playsInline className={`feed-card-media feed-card-media-video${isLockedForViewer ? " feed-card-media-locked" : ""}`} preload="metadata" />
          ) : (
            <img src={firstUrl} alt="" className={`feed-card-media${isLockedForViewer ? " feed-card-media-locked" : ""}`} loading="lazy" decoding="async" />
          ))}
        {showCaptionOnMedia && (
          <FeedCardCaptionOverlay caption={post.body} style={captionStyle} size={post.overlayTextSize} />
        )}
        {(mediaTotals.images + mediaTotals.videos) > 1 && (
          <span className="feed-card-count">
            {mediaTotals.images > 0 && (
              <span className="feed-card-count-item">
                <MediaImageIcon />
                {mediaTotals.images} image{mediaTotals.images === 1 ? "" : "s"}
              </span>
            )}
            {mediaTotals.videos > 0 && (
              <span className="feed-card-count-item">
                <MediaVideoIcon />
                {mediaTotals.videos} video{mediaTotals.videos === 1 ? "" : "s"}
              </span>
            )}
          </span>
        )}
        {isLockedForViewer && (
          <div className="feed-card-lock-overlay" aria-hidden={unlockLoading ? "true" : "false"}>
            <button type="button" className="feed-card-unlock-btn" onClick={startUnlock} disabled={unlockLoading}>
              {unlockLoading
                ? "Opening checkout..."
                : `Unlock for $${((post.lockedContent?.priceCents ?? 0) / 100).toFixed(0)}`}
            </button>
          </div>
        )}
      </Link>

      {!post.hideLikes && (
        <div className="feed-card-actions">
          <span className="feed-card-action-group">
            <button
              type="button"
              className={`feed-card-action-btn${isLiked ? " liked" : ""}`}
              aria-label="Like"
              onClick={toggleLike}
              disabled={!currentUser?.uid || likeSaving}
            >
              <HeartOutline />
              <HeartFilled />
            </button>
            <span className="feed-card-action-count">{post.likeCount ?? 0}</span>
          </span>
          {!post.hideComments && (
            <button type="button" className="feed-card-action-group feed-card-action-link" aria-label="Comments" onClick={() => setCommentsOpen(true)}>
              <CommentIcon />
              <span className="feed-card-action-count">{commentsForViewer.length}</span>
            </button>
          )}
          <button
            type="button"
            className={`feed-card-action-btn bookmark-btn${isSaved ? " bookmarked" : ""}`}
            aria-label={isSaved ? "Unsave post" : "Save post"}
            onClick={toggleSavePost}
            disabled={!currentUser?.uid}
          >
            <BookmarkOutline />
            <BookmarkFilled />
          </button>
        </div>
      )}

      <div className="feed-card-body">
        <p className="feed-card-caption">
          <span className="caption-username">stormij</span>
          {post.body}
        </p>
        {post.poll && post.poll.question && post.poll.options?.length >= 2 && (
          <div className="feed-card-poll">
            <p className="feed-card-poll-question">{post.poll.question}</p>
            <ul className="feed-card-poll-options">
              {(() => {
                const votes = post.poll.optionVotes ?? post.poll.options.map(() => 0);
                const total = votes.reduce((a, b) => a + b, 0);
                return post.poll.options.map((opt, i) => {
                  const v = votes[i] ?? 0;
                  const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                  return (
                    <li key={i} className="feed-card-poll-option">
                      <span className="feed-card-poll-option-label">{opt}</span>
                      <span className="feed-card-poll-option-meta">
                        {total > 0 ? `${pct}%` : "0%"}
                        {total > 0 && <span className="feed-card-poll-option-votes"> ({v} vote{v !== 1 ? "s" : ""})</span>}
                      </span>
                      {total > 0 && (
                        <div className="feed-card-poll-option-bar" style={{ width: `${pct}%` }} aria-hidden />
                      )}
                    </li>
                  );
                });
              })()}
            </ul>
          </div>
        )}
        {post.tipGoal && post.tipGoal.targetCents > 0 && (
          <div className="feed-card-tip-goal">
            <p className="feed-card-tip-goal-desc">{post.tipGoal.description}</p>
            <div className="feed-card-tip-goal-bar-wrap">
              <div
                className="feed-card-tip-goal-bar-fill"
                style={{
                  width: `${Math.min(100, (post.tipGoal.raisedCents / post.tipGoal.targetCents) * 100)}%`,
                }}
              />
            </div>
            <p className="feed-card-tip-goal-raised">
              ${(post.tipGoal.raisedCents / 100).toFixed(2)} of ${(post.tipGoal.targetCents / 100).toFixed(2)}
            </p>
            <Link href={`/tip?postId=${encodeURIComponent(post.id)}`} className="feed-card-tip-for-post">
              Tip for this post
            </Link>
          </div>
        )}
        {!post.hideComments && (
          <>
            {commentsForViewer.length > 0 && (
              <button type="button" className="feed-card-view-comments" onClick={() => setCommentsOpen(true)}>
                View all {commentsForViewer.length} comments
              </button>
            )}
            <div className="feed-card-comments-list">
              {commentsForViewer.length === 0 ? (
                <div className="feed-card-comment feed-card-comment-empty">No comments yet.</div>
              ) : (
                commentsForViewer.slice(0, 2).map((c, i) => (
                  <div key={i} className="feed-card-comment">
                    <span className="comment-username">{displayPublicName(c.username ?? c.author ?? "user")}</span>
                    {c.text}
                  </div>
                ))
              )}
            </div>
          </>
        )}
        <Link href={`/post/${post.id}`} className="feed-card-link">
          View post
        </Link>
      </div>
      {commentsOpen && (
        <div className="feed-comments-modal-backdrop" role="presentation" onClick={() => setCommentsOpen(false)}>
          <div
            className="feed-comments-modal"
            role="dialog"
            aria-modal="true"
            aria-label="All comments"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="feed-comments-modal-head">
              <h3>Comments</h3>
              <button type="button" className="feed-comments-modal-close" onClick={() => setCommentsOpen(false)} aria-label="Close comments">
                ×
              </button>
            </div>
            <div className={`feed-comments-modal-content${firstUrl ? "" : " no-media"}`}>
              {firstUrl && (
                <div className="feed-comments-modal-media-wrap">
                  {isVideo ? (
                    <video src={firstUrl} controls playsInline className="feed-comments-modal-media feed-comments-modal-media-video" preload="metadata" />
                  ) : (
                    <img src={firstUrl} alt="" className="feed-comments-modal-media" />
                  )}
                </div>
              )}
              <div className="feed-comments-modal-panel">
                <div className="feed-comments-modal-list">
                  {commentsForViewer.length === 0 ? (
                    <p className="feed-comments-modal-empty">No comments yet.</p>
                  ) : (
                    commentsForViewer.map((c, idx) => {
                      const sourceIndex = showAdminEdit ? idx : post.comments.findIndex((x) => x === c);
                      const authorName = getCommentAvatarName(c.username ?? c.author ?? "user");
                      return (
                        <div className="feed-comments-modal-item" key={`${idx}-${c.text.slice(0, 12)}`}>
                          <div className="feed-comments-modal-item-avatar" aria-hidden>
                            {authorName === "stormij" ? (
                              <img src="/assets/sj-heart-avatar.png" alt="" className="feed-comments-modal-avatar-img" />
                            ) : (
                              <span>{authorName.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="feed-comments-modal-item-body">
                            <p className="feed-comments-modal-text">
                              <span className="comment-username">{authorName}</span>
                              {c.hidden && showAdminEdit ? <span className="feed-comments-hidden-tag">Hidden</span> : null}
                              {c.text}
                            </p>
                            {showAdminEdit && sourceIndex >= 0 && (
                              <div className="feed-comments-admin-actions">
                                <button
                                  type="button"
                                  className="feed-comments-admin-btn"
                                  onClick={() => toggleHideComment(sourceIndex)}
                                  disabled={commentActionIndex === sourceIndex}
                                >
                                  {c.hidden ? "Unhide" : "Hide"}
                                </button>
                                <button
                                  type="button"
                                  className="feed-comments-admin-btn danger"
                                  onClick={() => deleteComment(sourceIndex)}
                                  disabled={commentActionIndex === sourceIndex}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {currentUser && (
                  <form className="feed-comments-modal-compose" onSubmit={submitModalComment}>
                    <div className="feed-comments-modal-item-avatar feed-comments-modal-compose-avatar" aria-hidden>
                      {isAdminEmail(currentUser.email ?? null) ? (
                        <img src="/assets/sj-heart-avatar.png" alt="" className="feed-comments-modal-avatar-img" />
                      ) : (
                        <span>{(currentUser.displayName || currentUser.email || "u").charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div
                      className="feed-comments-modal-compose-input-wrap"
                      ref={(el) => {
                        commentEmojiWrapRef.current = el;
                      }}
                    >
                      <input
                        ref={(el) => {
                          commentInputRef.current = el;
                        }}
                        type="text"
                        className="feed-comments-modal-compose-input"
                        value={modalComment}
                        onChange={(e) => setModalComment(e.target.value)}
                        placeholder="Write a comment..."
                        maxLength={500}
                      />
                      <button
                        type="button"
                        className="feed-comments-modal-emoji-trigger"
                        onClick={() => setCommentEmojiOpen((v) => !v)}
                        aria-label="Add emoji"
                      >
                        😀
                      </button>
                      {commentEmojiOpen && (
                        <div className="feed-comments-modal-emoji-picker">
                          <input
                            type="text"
                            value={emojiQuery}
                            onChange={(e) => setEmojiQuery(e.target.value)}
                            placeholder="Search emoji..."
                            className="feed-comments-modal-emoji-search"
                          />
                          <div className="feed-comments-modal-emoji-grid">
                            {visibleEmojis.length === 0 ? (
                              <p className="feed-comments-modal-emoji-empty">No emoji found.</p>
                            ) : (
                              visibleEmojis.map((e, idx) => (
                                <button
                                  key={`modal-comment-emoji-${idx}-${e}`}
                                  type="button"
                                  className="feed-comments-modal-emoji-item"
                                  onClick={() => insertEmojiAtCursor(e)}
                                  aria-label={`Emoji ${e}`}
                                >
                                  {e}
                                </button>
                              ))
                            )}
                          </div>
                          <div className="feed-comments-modal-emoji-cats">
                            {COMMENT_EMOJI_CATEGORY_ORDER.map((c) => (
                              <button
                                key={`modal-comment-cat-${c}`}
                                type="button"
                                className={`feed-comments-modal-emoji-cat${emojiCategory === c ? " active" : ""}`}
                                onClick={() => setEmojiCategory(c)}
                                aria-label={`Show ${c} emoji`}
                                title={c}
                              >
                                {COMMENT_EMOJI_CATEGORY_ICONS[c]}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button type="submit" className="feed-comments-modal-compose-send" disabled={modalCommentSaving || !modalComment.trim()}>
                      {modalCommentSaving ? "Posting..." : "Post"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function HomeFeedPage() {
  const [firestorePosts, setFirestorePosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [unlockedPostIds, setUnlockedPostIds] = useState<string[]>([]);
  const db = getFirebaseDb();
  const { user } = useAuth();
  const showAdminEdit = !!user && isAdminEmail(user.email ?? null);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50)))
      .then((snap) => {
        const list: FeedPost[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const status = (d.status as "published" | "scheduled" | "draft") ?? "published";
          if (status !== "published") return;
          list.push({
            id: docSnap.id,
            body: (d.body as string) ?? "",
            mediaUrls: (d.mediaUrls as string[]) ?? [],
            mediaTypes: (d.mediaTypes as ("image" | "video")[]) ?? [],
            createdAt: d.createdAt as { toDate: () => Date },
            likeCount: typeof d.likeCount === "number" ? d.likeCount : 0,
            likedBy: (d.likedBy as string[]) ?? [],
            comments: (d.comments as FeedPost["comments"]) ?? [],
            captionStyle: (d.captionStyle as FeedPost["captionStyle"]) ?? "static",
            overlayTextSize: typeof d.overlayTextSize === "number" ? d.overlayTextSize : (d.overlayTextSize === "small" ? 14 : d.overlayTextSize === "large" ? 24 : 18),
            hideComments: !!d.hideComments,
            hideLikes: !!d.hideLikes,
            poll: d.poll as FeedPost["poll"] | undefined,
            tipGoal: d.tipGoal as FeedPost["tipGoal"] | undefined,
            lockedContent: d.lockedContent as FeedPost["lockedContent"] | undefined,
          });
        });
        setFirestorePosts(list);
      })
      .catch(() => setFirestorePosts([]))
      .finally(() => setLoading(false));
  }, [db]);

  useEffect(() => {
    if (!db || !user?.uid) {
      setSavedPostIds([]);
      setUnlockedPostIds([]);
      return;
    }
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        const d = snap.exists() ? snap.data() : {};
        const ids = Array.isArray(d.savedPostIds) ? (d.savedPostIds as unknown[]).map((v) => String(v)) : [];
        const unlocked = Array.isArray(d.unlockedPostIds)
          ? (d.unlockedPostIds as unknown[]).map((v) => String(v))
          : [];
        setSavedPostIds(ids);
        setUnlockedPostIds(unlocked);
      })
      .catch(() => {
        setSavedPostIds([]);
        setUnlockedPostIds([]);
      });
  }, [db, user?.uid]);

  const startUnlockCheckout = async (postId: string): Promise<boolean> => {
    if (!user) return false;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const res = await fetch("/api/unlock-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          uid: user.uid,
          customer_email: user.email || "",
          base_url: base,
          success_url: `${base}/post/${encodeURIComponent(postId)}?unlocked=1`,
          cancel_url: `${base}/post/${encodeURIComponent(postId)}`,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return true;
      }
      alert(data.error || "Could not start unlock checkout.");
      return false;
    } catch {
      alert("Could not start unlock checkout.");
      return false;
    }
  };

  const posts: FeedPost[] = useMemo(() => firestorePosts, [firestorePosts]);

  return (
    <main className="member-main member-feed-main">
      <div className="feed-header">
        <Link href="/grid" className="feed-view-toggle" title="Switch to grid view" aria-label="Switch to grid view">
          <GridIcon />
        </Link>
        {!!user && !showAdminEdit && (
          <Link href="/saved" className="feed-saved-link" title="Saved posts" aria-label="Saved posts">
            Saved Posts ({savedPostIds.length})
          </Link>
        )}
      </div>

      {loading && <p className="feed-loading">Loading…</p>}
      <div className="feed-list">
        {!loading && posts.length === 0 && (
          <p className="feed-empty">No posts yet.</p>
        )}
        {!loading && posts.map((post) => (
          <FeedCard
            key={post.id}
            post={post}
            showAdminEdit={showAdminEdit}
            onCommentsUpdated={(postId, comments) => {
              setFirestorePosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments } : p)));
            }}
            onLikeUpdated={(postId, likedBy, likeCount) => {
              setFirestorePosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likedBy, likeCount } : p)));
            }}
            currentUser={user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null}
            savedPostIds={savedPostIds}
            unlockedPostIds={unlockedPostIds}
            onSavedUpdated={(savedIds) => setSavedPostIds(savedIds)}
            onUnlockRequest={startUnlockCheckout}
          />
        ))}
      </div>
    </main>
  );
}
