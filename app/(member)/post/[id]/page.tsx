"use client";

import { use, useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, runTransaction } from "firebase/firestore";
import { getFirebaseDb } from "../../../../lib/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { isAdminEmail } from "../../../../lib/auth-redirect";

type PostCommentReply = {
  author?: string;
  text: string;
};

type PostComment = {
  username?: string;
  author?: string;
  text: string;
  replies?: PostCommentReply[];
};

type PostData = {
  title: string;
  body: string;
  mediaUrls: string[];
  mediaTypes?: ("image" | "video")[];
  altTexts?: string[];
  dateStr: string;
  comments: PostComment[];
  captionStyle?: "static" | "scroll-up" | "scroll-across" | "dissolve";
  overlayTextSize?: number;
  hideComments?: boolean;
  hideLikes?: boolean;
  tipGoal?: { description: string; targetCents: number; raisedCents: number };
  lockedContent?: { enabled?: boolean; priceCents?: number };
};

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
}

function displayPublicName(nameLike: string): string {
  const n = (nameLike || "").toString().trim();
  if (!n) return "user";
  if (isAdminEmail(n.includes("@") ? n : null)) return "stormij";
  if (/^will\b/i.test(n) || /will[\s_.-]*jackson/i.test(n)) return "stormij";
  return n;
}

export default function PostByIdPage({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const resolved = use(params);
  const id = resolved?.id ?? "";
  const searchParams = useSearchParams();
  const imgIndex = Math.max(0, parseInt(searchParams.get("img") ?? "0", 10));

  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [post, setPost] = useState<PostData | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replySavingIndex, setReplySavingIndex] = useState<number | null>(null);
  const [commentEmojiOpen, setCommentEmojiOpen] = useState(false);
  const [replyEmojiOpenFor, setReplyEmojiOpenFor] = useState<number | null>(null);
  const [emojiQuery, setEmojiQuery] = useState("");
  const [emojiCategory, setEmojiCategory] = useState<CommentEmojiCategory>("all");
  const [unlockedPostIds, setUnlockedPostIds] = useState<string[]>([]);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const db = getFirebaseDb();
  const { user } = useAuth();
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const replyInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const commentEmojiWrapRef = useRef<HTMLDivElement | null>(null);
  const replyEmojiWrapRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (post) {
      document.title = `${post.title} — Inner Circle`;
    }
  }, [post]);

  useEffect(() => {
    if (!commentEmojiOpen && replyEmojiOpenFor == null) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (commentEmojiOpen && commentEmojiWrapRef.current?.contains(target)) return;
      if (replyEmojiOpenFor != null && replyEmojiWrapRefs.current[replyEmojiOpenFor]?.contains(target)) return;
      setCommentEmojiOpen(false);
      setReplyEmojiOpenFor(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [commentEmojiOpen, replyEmojiOpenFor]);

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
    if (!db || !user?.uid) {
      setUnlockedPostIds([]);
      return;
    }
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        const d = snap.exists() ? snap.data() : {};
        const unlocked = Array.isArray(d.unlockedPostIds)
          ? (d.unlockedPostIds as unknown[]).map((v) => String(v))
          : [];
        setUnlockedPostIds(unlocked);
      })
      .catch(() => setUnlockedPostIds([]));
  }, [db, user?.uid]);

  useEffect(() => {
    if (!id) {
      setStatus("error");
      return;
    }
    if (!db) {
      setStatus("error");
      return;
    }
    getDoc(doc(db, "posts", id))
      .then((snap) => {
        if (!snap.exists()) {
          setStatus("error");
          return;
        }
        const d = snap.data();
        const status = (d.status as string) ?? (d.published === true ? "published" : "");
        if (status !== "published") {
          setStatus("error");
          return;
        }
        const createdAt = d.createdAt;
        const dateStr =
          createdAt?.toDate?.()?.toLocaleDateString(undefined, { dateStyle: "medium" }) ?? "";
        setPost({
          title: (d.title as string) || "Untitled",
          body: (d.body as string) || "",
          mediaUrls: (d.mediaUrls as string[]) || [],
          mediaTypes: (d.mediaTypes as PostData["mediaTypes"]) || [],
          altTexts: (d.altTexts as string[]) || [],
          dateStr,
          comments: (d.comments as PostData["comments"]) || [],
          captionStyle: (d.captionStyle as PostData["captionStyle"]) ?? "static",
          overlayTextSize: typeof d.overlayTextSize === "number" ? d.overlayTextSize : (d.overlayTextSize === "small" ? 14 : d.overlayTextSize === "large" ? 24 : 18),
          hideComments: !!d.hideComments,
          hideLikes: !!d.hideLikes,
          tipGoal: d.tipGoal as PostData["tipGoal"] | undefined,
          lockedContent: d.lockedContent as PostData["lockedContent"] | undefined,
        });
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [id, db]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !id || !user) return;
    const text = newComment.trim();
    if (!text) return;
    setCommentSaving(true);
    try {
      const postRef = doc(db, "posts", id);
      const username =
        isAdminEmail(user.email ?? null)
          ? "stormij"
          : (user.displayName || user.email?.split("@")[0] || "member").toString().trim().slice(0, 60);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(postRef);
        if (!snap.exists()) throw new Error("Post not found.");
        const data = snap.data() as Record<string, unknown>;
        const existing = Array.isArray(data.comments) ? (data.comments as PostComment[]) : [];
        tx.update(postRef, {
          comments: [...existing, { username, text: text.slice(0, 500) }],
        });
      });
      setPost((prev) => (prev ? { ...prev, comments: [...prev.comments, { username, text: text.slice(0, 500) }] } : prev));
      setNewComment("");
      setCommentEmojiOpen(false);
    } catch {
      // keep UX simple; member can retry
    } finally {
      setCommentSaving(false);
    }
  };

  const insertCommentEmoji = (emoji: string) => {
    const input = commentInputRef.current;
    const current = newComment;
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
    setNewComment(next);
    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      const pos = start + emoji.length;
      input.setSelectionRange(pos, pos);
    });
  };

  const insertReplyEmoji = (commentIndex: number, emoji: string) => {
    const input = replyInputRefs.current[commentIndex] ?? null;
    const current = replyDrafts[commentIndex] ?? "";
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
    setReplyDrafts((s) => ({ ...s, [commentIndex]: next }));
    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      const pos = start + emoji.length;
      input.setSelectionRange(pos, pos);
    });
  };

  const submitReply = async (commentIndex: number) => {
    if (!db || !id || !user || !isAdminEmail(user.email ?? null)) return;
    const text = (replyDrafts[commentIndex] || "").trim();
    if (!text) return;
    setReplySavingIndex(commentIndex);
    try {
      const postRef = doc(db, "posts", id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(postRef);
        if (!snap.exists()) throw new Error("Post not found.");
        const data = snap.data() as Record<string, unknown>;
        const existing = Array.isArray(data.comments) ? ([...data.comments] as PostComment[]) : [];
        if (!existing[commentIndex]) throw new Error("Comment not found.");
        const comment = existing[commentIndex] as PostComment;
        const replies = Array.isArray(comment.replies) ? [...comment.replies] : [];
        replies.push({ author: "stormij", text: text.slice(0, 500) });
        existing[commentIndex] = { ...comment, replies };
        tx.update(postRef, { comments: existing });
      });
      setPost((prev) => {
        if (!prev?.comments?.[commentIndex]) return prev;
        const comments = [...prev.comments];
        const c = comments[commentIndex]!;
        const replies = Array.isArray(c.replies) ? [...c.replies] : [];
        replies.push({ author: "stormij", text: text.slice(0, 500) });
        comments[commentIndex] = { ...c, replies };
        return { ...prev, comments };
      });
      setReplyDrafts((s) => ({ ...s, [commentIndex]: "" }));
    } catch {
      // keep UX simple; admin can retry
    } finally {
      setReplySavingIndex(null);
    }
  };

  if (!id) {
    return (
      <main className="member-main member-post-main">
        <p className="post-error">No post specified.</p>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main className="member-main member-post-main">
        <div className="post-loading">Loading…</div>
      </main>
    );
  }

  if (status === "error" || !post) {
    return (
      <main className="member-main member-post-main">
        <div className="post-error">Could not load post.</div>
      </main>
    );
  }

  const urls = post.mediaUrls || [];
  const altTexts = post.altTexts ?? [];
  const startIdx = imgIndex >= 0 && imgIndex < urls.length ? imgIndex : 0;
  const mediaTypes = post.mediaTypes ?? [];
  const captionStyle = post.captionStyle ?? "static";
  const showCaptionOnMedia = captionStyle !== "static" && post.body?.trim();
  const visibleIndex = urls.length ? (currentMediaIndex % urls.length) : 0;
  const visibleUrl = urls[visibleIndex];
  const visibleIsVideo = mediaTypes[visibleIndex] === "video" || (visibleUrl && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(visibleUrl));
  const isLockedForViewer =
    !!post.lockedContent?.enabled &&
    (post.lockedContent?.priceCents ?? 0) >= 100 &&
    !unlockedPostIds.includes(id);

  const startUnlockCheckout = async () => {
    if (!user || !id || unlockLoading) return;
    setUnlockLoading(true);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch("/api/unlock-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: id,
          uid: user.uid,
          customer_email: user.email || "",
          base_url: base,
          success_url: `${base}/post/${encodeURIComponent(id)}?unlocked=1`,
          cancel_url: `${base}/post/${encodeURIComponent(id)}`,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      alert(data.error || "Could not start unlock checkout.");
    } catch {
      alert("Could not start unlock checkout.");
    } finally {
      setUnlockLoading(false);
    }
  };

  return (
    <main className="member-main member-post-main">
      <article className="post-article">
        <nav className="post-back">
          <Link href="/home">&larr; Back to Home</Link>
        </nav>
        <h1 className="post-title">{post.title}</h1>
        <p className="post-date">{post.dateStr}</p>
        <div className="post-media">
          {urls.length > 0 && (
            <div className="post-media-carousel">
              <div className="post-media-item">
                {visibleIsVideo ? (
                  <video src={visibleUrl} controls playsInline className={`post-media-img${isLockedForViewer ? " post-media-img-locked" : ""}`} key={visibleIndex} />
                ) : (
                  <img
                    src={visibleUrl}
                    alt={altTexts[visibleIndex]?.trim() || ""}
                    className={`post-media-img${isLockedForViewer ? " post-media-img-locked" : ""}`}
                    loading="eager"
                    key={visibleIndex}
                  />
                )}
                {showCaptionOnMedia && (
                  <div className={`post-caption-overlay post-caption-overlay-${captionStyle}`}>
                    <span className="post-caption-overlay-text" style={post.overlayTextSize != null && post.overlayTextSize > 0 ? { fontSize: `${post.overlayTextSize}px` } : undefined}>{post.body}</span>
                  </div>
                )}
                {isLockedForViewer && (
                  <div className="post-lock-overlay">
                    <button type="button" className="post-unlock-btn" onClick={startUnlockCheckout} disabled={unlockLoading}>
                      {unlockLoading
                        ? "Opening checkout..."
                        : `Unlock for $${((post.lockedContent?.priceCents ?? 0) / 100).toFixed(0)}`}
                    </button>
                  </div>
                )}
              </div>
              {urls.length > 1 && (
                <>
                  <button
                    type="button"
                    className="post-carousel-prev"
                    onClick={() => setCurrentMediaIndex((i) => (i - 1 + urls.length) % urls.length)}
                    aria-label="Previous"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="post-carousel-next"
                    onClick={() => setCurrentMediaIndex((i) => (i + 1) % urls.length)}
                    aria-label="Next"
                  >
                    ›
                  </button>
                  <div className="post-carousel-dots">
                    {urls.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`post-carousel-dot${i === visibleIndex ? " active" : ""}`}
                        onClick={() => setCurrentMediaIndex(i)}
                        aria-label={`Slide ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {post.tipGoal && post.tipGoal.targetCents > 0 && (
          <div className="feed-card-tip-goal post-detail-tip-goal">
            <p className="feed-card-tip-goal-desc">{post.tipGoal.description}</p>
            <div className="feed-card-tip-goal-bar-wrap">
              <div
                className="feed-card-tip-goal-bar-fill"
                style={{
                  width: `${Math.min(100, (post.tipGoal.raisedCents / post.tipGoal.targetCents) * 100)}%`,
                }}
                aria-hidden
              />
            </div>
            <p className="feed-card-tip-goal-raised">
              ${(post.tipGoal.raisedCents / 100).toFixed(2)} of ${(post.tipGoal.targetCents / 100).toFixed(2)} raised
            </p>
            <Link
              href={`/tip?postId=${encodeURIComponent(id)}`}
              className="post-tip-for-post-btn"
            >
              Tip for this post
            </Link>
          </div>
        )}
        {!post.hideComments && (
          <div className="post-comments" id="comments">
            <h3>Comments</h3>
            {user ? (
              <form className="post-comment-form" onSubmit={submitComment}>
                <div className="post-comment-input-wrap" ref={commentEmojiWrapRef}>
                  <input
                    ref={commentInputRef}
                    type="text"
                    className="post-comment-input"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    maxLength={500}
                  />
                  <button
                    type="button"
                    className="post-comment-emoji-btn"
                    onClick={() => {
                      setCommentEmojiOpen((v) => !v);
                      setReplyEmojiOpenFor(null);
                    }}
                    aria-label="Add emoji to comment"
                  >
                    😀
                  </button>
                  {commentEmojiOpen && (
                    <div className="post-comment-emoji-picker">
                      <input
                        type="text"
                        value={emojiQuery}
                        onChange={(e) => setEmojiQuery(e.target.value)}
                        placeholder="Search emoji..."
                        className="post-comment-emoji-search"
                      />
                      <div className="post-comment-emoji-grid">
                        {visibleEmojis.length === 0 ? (
                          <p className="post-comment-emoji-empty">No emoji found.</p>
                        ) : (
                          visibleEmojis.map((e, idx) => (
                            <button
                              key={`comment-emoji-${idx}-${e}`}
                              type="button"
                              className="post-comment-emoji-item"
                              onClick={() => insertCommentEmoji(e)}
                              aria-label={`Emoji ${e}`}
                            >
                              {e}
                            </button>
                          ))
                        )}
                      </div>
                      <div className="post-comment-emoji-category-bar" role="tablist" aria-label="Emoji categories">
                        {COMMENT_EMOJI_CATEGORY_ORDER.map((c) => (
                          <button
                            key={`comment-cat-${c}`}
                            type="button"
                            className={`post-comment-emoji-category-btn${emojiCategory === c ? " active" : ""}`}
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
                <button type="submit" className="post-comment-send" disabled={commentSaving || !newComment.trim()}>
                  {commentSaving ? "Posting..." : "Post"}
                </button>
              </form>
            ) : (
              <p className="post-comment-note">Sign in to comment.</p>
            )}
            {post.comments && post.comments.length > 0 ? (
              post.comments.map((c, i) => (
                <div key={i} className="post-comment">
                  <div>
                    <span className="post-comment-username">
                      {escapeHtml(displayPublicName((c.username ?? c.author ?? "user").slice(0, 100)))}
                    </span>{" "}
                    <span dangerouslySetInnerHTML={{ __html: escapeHtml((c.text ?? "").slice(0, 2000)) }} />
                  </div>
                  {Array.isArray(c.replies) && c.replies.length > 0 && (
                    <div className="post-comment-replies">
                      {c.replies.map((r, ridx) => (
                        <div key={ridx} className="post-comment-reply">
                          <span className="post-comment-username">{escapeHtml(displayPublicName((r.author ?? "stormij").slice(0, 100)))}</span>{" "}
                          <span dangerouslySetInnerHTML={{ __html: escapeHtml((r.text ?? "").slice(0, 2000)) }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {isAdminEmail(user?.email ?? null) && (
                    <div className="post-reply-form">
                      <div
                        className="post-reply-input-wrap"
                        ref={(el) => {
                          replyEmojiWrapRefs.current[i] = el;
                        }}
                      >
                        <input
                          ref={(el) => {
                            replyInputRefs.current[i] = el;
                          }}
                          type="text"
                          className="post-reply-input"
                          value={replyDrafts[i] ?? ""}
                          onChange={(e) => setReplyDrafts((s) => ({ ...s, [i]: e.target.value }))}
                          placeholder="Reply as stormij..."
                          maxLength={500}
                        />
                        <button
                          type="button"
                          className="post-comment-emoji-btn"
                          onClick={() => {
                            setReplyEmojiOpenFor((v) => (v === i ? null : i));
                            setCommentEmojiOpen(false);
                          }}
                          aria-label="Add emoji to reply"
                        >
                          😀
                        </button>
                        {replyEmojiOpenFor === i && (
                          <div className="post-comment-emoji-picker">
                            <input
                              type="text"
                              value={emojiQuery}
                              onChange={(e) => setEmojiQuery(e.target.value)}
                              placeholder="Search emoji..."
                              className="post-comment-emoji-search"
                            />
                            <div className="post-comment-emoji-grid">
                              {visibleEmojis.length === 0 ? (
                                <p className="post-comment-emoji-empty">No emoji found.</p>
                              ) : (
                                visibleEmojis.map((e, idx) => (
                                  <button
                                    key={`reply-${i}-emoji-${idx}-${e}`}
                                    type="button"
                                    className="post-comment-emoji-item"
                                    onClick={() => insertReplyEmoji(i, e)}
                                    aria-label={`Emoji ${e}`}
                                  >
                                    {e}
                                  </button>
                                ))
                              )}
                            </div>
                            <div className="post-comment-emoji-category-bar" role="tablist" aria-label="Emoji categories">
                              {COMMENT_EMOJI_CATEGORY_ORDER.map((c) => (
                                <button
                                  key={`reply-${i}-cat-${c}`}
                                  type="button"
                                  className={`post-comment-emoji-category-btn${emojiCategory === c ? " active" : ""}`}
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
                      <button
                        type="button"
                        className="post-reply-send"
                        onClick={() => submitReply(i)}
                        disabled={replySavingIndex === i || !(replyDrafts[i] || "").trim()}
                      >
                        {replySavingIndex === i ? "Replying..." : "Reply"}
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="post-comment-note">No comments yet.</p>
            )}
          </div>
        )}
      </article>
    </main>
  );
}
