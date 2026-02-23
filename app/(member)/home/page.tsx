import Link from "next/link";
import { DEMO_POSTS } from "./demo-posts";

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

/** Format post date as relative time: "37 mins", "2 days", "1 week", "Jan 22, 2026", etc. */
function formatRelativeDate(dateInput: Date | string | null | undefined): string {
  const date = dateInput instanceof Date ? dateInput : dateInput ? new Date(dateInput) : null;
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

export default function HomeFeedPage() {
  return (
    <main className="member-main member-feed-main">
      <div className="feed-header">
        <Link href="/grid" className="feed-view-toggle" title="Switch to grid view" aria-label="Switch to grid view">
          <GridIcon />
        </Link>
      </div>

      <div className="feed-list">
        {DEMO_POSTS.map((post) => (
          <article className="feed-card" key={post.id}>
            <div className="feed-card-header">
              <div className="feed-card-avatar">
                <img src="/assets/sj-heart-avatar.png" alt="stormij" className="feed-card-avatar-img" />
              </div>
              <div className="feed-card-creator">
                <span className="feed-card-username">stormij</span>
              </div>
              <span className="feed-card-time">{formatRelativeDate(post.dateStr)}</span>
            </div>

            <Link href={`/post?id=${post.id}`} className="feed-card-media-wrap">
              <img src={post.mediaUrls[0]} alt={post.title} className="feed-card-media" loading="lazy" />
              {post.mediaUrls.length > 1 && (
                <span className="feed-card-count">+{post.mediaUrls.length - 1}</span>
              )}
            </Link>

            <div className="feed-card-actions">
              <span className="feed-card-action-group">
                <button type="button" className="feed-card-action-btn" aria-label="Like">
                  <HeartOutline />
                  <HeartFilled />
                </button>
                <span className="feed-card-action-count">{post.likeCount}</span>
              </span>
              <Link href={`/post?id=${post.id}#comments`} className="feed-card-action-group feed-card-action-link" aria-label="Comments">
                <CommentIcon />
                <span className="feed-card-action-count">{post.comments.length}</span>
              </Link>
              <button type="button" className="feed-card-action-btn bookmark-btn" aria-label="Save">
                <BookmarkOutline />
                <BookmarkFilled />
              </button>
            </div>

            <div className="feed-card-body">
              <p className="feed-card-caption">
                <span className="caption-username">stormij</span>
                {post.body}
              </p>
              {post.comments.length > 0 && (
                <>
                  <Link href={`/post?id=${post.id}#comments`} className="feed-card-view-comments">
                    View all {post.comments.length} comments
                  </Link>
                  <div className="feed-card-comments-list">
                    {post.comments.slice(0, 2).map((c, i) => (
                      <div key={i} className="feed-card-comment">
                        <span className="comment-username">{c.username}</span>
                        {c.text}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <Link href={`/post?id=${post.id}`} className="feed-card-link">
                View post
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
