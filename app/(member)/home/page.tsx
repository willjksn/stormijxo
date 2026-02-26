"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
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
  comments: { username?: string; author?: string; text: string }[];
  captionStyle?: "static" | "scroll-up" | "scroll-across" | "dissolve";
  overlayTextSize?: number;
  hideComments?: boolean;
  hideLikes?: boolean;
  poll?: { question: string; options: string[]; optionVotes?: number[] };
  tipGoal?: { description: string; targetCents: number; raisedCents: number };
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
}: {
  post: FeedPost;
  showAdminEdit?: boolean;
}) {
  const firstUrl = post.mediaUrls?.[0];
  const isVideo = post.mediaTypes?.[0] === "video" || (firstUrl && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(firstUrl));
  const dateStr = post.dateStr ?? (post.createdAt?.toDate ? formatRelativeDate(post.createdAt) : "");
  const captionStyle = post.captionStyle ?? "static";
  const showCaptionOnMedia = captionStyle !== "static" && post.body?.trim();

  return (
    <article className="feed-card" key={post.id}>
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
            <video src={firstUrl} muted playsInline className="feed-card-media" />
          ) : (
            <img src={firstUrl} alt="" className="feed-card-media" loading="lazy" decoding="async" />
          ))}
        {showCaptionOnMedia && (
          <FeedCardCaptionOverlay caption={post.body} style={captionStyle} size={post.overlayTextSize} />
        )}
        {post.mediaUrls?.length > 1 && (
          <span className="feed-card-count">+{post.mediaUrls.length - 1}</span>
        )}
      </Link>

      {!post.hideLikes && (
        <div className="feed-card-actions">
          <span className="feed-card-action-group">
            <button type="button" className="feed-card-action-btn" aria-label="Like">
              <HeartOutline />
              <HeartFilled />
            </button>
            <span className="feed-card-action-count">{post.likeCount ?? 0}</span>
          </span>
          {!post.hideComments && (
            <Link href={`/post/${post.id}#comments`} className="feed-card-action-group feed-card-action-link" aria-label="Comments">
              <CommentIcon />
              <span className="feed-card-action-count">{post.comments?.length ?? 0}</span>
            </Link>
          )}
          <button type="button" className="feed-card-action-btn bookmark-btn" aria-label="Save">
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
        {!post.hideComments && post.comments?.length > 0 && (
          <>
            <Link href={`/post/${post.id}#comments`} className="feed-card-view-comments">
              View all {post.comments.length} comments
            </Link>
            <div className="feed-card-comments-list">
              {post.comments.slice(0, 2).map((c, i) => (
                <div key={i} className="feed-card-comment">
                  <span className="comment-username">{c.username ?? c.author ?? "user"}</span>
                  {c.text}
                </div>
              ))}
            </div>
          </>
        )}
        <Link href={`/post/${post.id}`} className="feed-card-link">
          View post
        </Link>
      </div>
    </article>
  );
}

export default function HomeFeedPage() {
  const [firestorePosts, setFirestorePosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
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
            comments: (d.comments as FeedPost["comments"]) ?? [],
            captionStyle: (d.captionStyle as FeedPost["captionStyle"]) ?? "static",
            overlayTextSize: typeof d.overlayTextSize === "number" ? d.overlayTextSize : (d.overlayTextSize === "small" ? 14 : d.overlayTextSize === "large" ? 24 : 18),
            hideComments: !!d.hideComments,
            hideLikes: !!d.hideLikes,
            poll: d.poll as FeedPost["poll"] | undefined,
            tipGoal: d.tipGoal as FeedPost["tipGoal"] | undefined,
          });
        });
        setFirestorePosts(list);
      })
      .catch(() => setFirestorePosts([]))
      .finally(() => setLoading(false));
  }, [db]);

  const posts: FeedPost[] = useMemo(() => firestorePosts, [firestorePosts]);

  return (
    <main className="member-main member-feed-main">
      <div className="feed-header">
        <Link href="/grid" className="feed-view-toggle" title="Switch to grid view" aria-label="Switch to grid view">
          <GridIcon />
        </Link>
      </div>

      {loading && <p className="feed-loading">Loading…</p>}
      <div className="feed-list">
        {!loading && posts.length === 0 && (
          <p className="feed-empty">No posts yet.</p>
        )}
        {!loading && posts.map((post) => (
          <FeedCard key={post.id} post={post} showAdminEdit={showAdminEdit} />
        ))}
      </div>
    </main>
  );
}
