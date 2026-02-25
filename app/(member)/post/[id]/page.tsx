"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "../../../../lib/firebase";
import { DEMO_POSTS } from "../../home/demo-posts";

type PostData = {
  title: string;
  body: string;
  mediaUrls: string[];
  mediaTypes?: ("image" | "video")[];
  altTexts?: string[];
  dateStr: string;
  comments: { username?: string; author?: string; text: string }[];
  captionStyle?: "static" | "scroll-up" | "scroll-across" | "dissolve";
  overlayTextSize?: "small" | "medium" | "large";
  hideComments?: boolean;
  hideLikes?: boolean;
  tipGoal?: { description: string; targetCents: number; raisedCents: number };
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
}

/** Escape body and turn #hashtag into links to /tag/hashtag */
function postBodyWithHashtags(body: string): string {
  const escaped = escapeHtml(body);
  return escaped.replace(
    /#([a-zA-Z0-9_]+)/g,
    (_, tag) => `<a href="/tag/${encodeURIComponent(tag)}" class="post-hashtag">#${tag}</a>`
  );
}

export default function PostByIdPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = (params?.id as string) ?? "";
  const imgIndex = Math.max(0, parseInt(searchParams.get("img") ?? "0", 10));

  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [post, setPost] = useState<PostData | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const db = getFirebaseDb();

  const demoPost = useMemo(() => {
    if (!id || !id.startsWith("demo-")) return null;
    return DEMO_POSTS.find((p) => p.id === id) ?? null;
  }, [id]);

  useEffect(() => {
    if (post) {
      document.title = `${post.title} — Inner Circle`;
    }
  }, [post]);

  useEffect(() => {
    if (!id) {
      setStatus("error");
      return;
    }
    if (demoPost) {
      setPost({
        title: demoPost.title,
        body: demoPost.body,
        mediaUrls: demoPost.mediaUrls,
        dateStr: demoPost.dateStr,
        comments: demoPost.comments,
        captionStyle: "static",
        overlayTextSize: "medium",
        hideComments: false,
        hideLikes: false,
        tipGoal: demoPost.tipGoal,
      });
      setStatus("ok");
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
          overlayTextSize: (d.overlayTextSize as PostData["overlayTextSize"]) ?? "medium",
          hideComments: !!d.hideComments,
          hideLikes: !!d.hideLikes,
          tipGoal: d.tipGoal as PostData["tipGoal"] | undefined,
        });
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [id, demoPost, db]);

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
                  <video src={visibleUrl} controls playsInline className="post-media-img" key={visibleIndex} />
                ) : (
                  <img
                    src={visibleUrl}
                    alt={altTexts[visibleIndex]?.trim() || ""}
                    className="post-media-img"
                    loading="eager"
                    key={visibleIndex}
                  />
                )}
                {showCaptionOnMedia && (
                  <div className={`post-caption-overlay post-caption-overlay-${captionStyle}`}>
                    <span className={`post-caption-overlay-text${post.overlayTextSize === "small" ? " post-caption-overlay-text-small" : post.overlayTextSize === "large" ? " post-caption-overlay-text-large" : ""}`}>{post.body}</span>
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
        <div
          className="post-body"
          dangerouslySetInnerHTML={{ __html: postBodyWithHashtags(post.body) }}
        />
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
        {!post.hideComments && post.comments && post.comments.length > 0 && (
          <div className="post-comments" id="comments">
            <h3>Comments</h3>
            {post.comments.map((c, i) => (
              <div key={i} className="post-comment">
                <span className="post-comment-username">
                  {escapeHtml((c.username ?? c.author ?? "user").slice(0, 100))}
                </span>{" "}
                <span dangerouslySetInnerHTML={{ __html: escapeHtml((c.text ?? "").slice(0, 2000)) }} />
              </div>
            ))}
          </div>
        )}
      </article>
    </main>
  );
}
