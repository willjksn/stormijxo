"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "../../../lib/firebase";
import { DEMO_POSTS } from "../home/demo-posts";

type PostData = {
  title: string;
  body: string;
  mediaUrls: string[];
  dateStr: string;
  comments: { username?: string; author?: string; text: string }[];
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
}

export default function PostPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const imgIndex = Math.max(0, parseInt(searchParams.get("img") ?? "0", 10));

  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [post, setPost] = useState<PostData | null>(null);
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
        if (d?.published !== true) {
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
          dateStr,
          comments: (d.comments as PostData["comments"]) || [],
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
  const startIdx = imgIndex >= 0 && imgIndex < urls.length ? imgIndex : 0;

  return (
    <main className="member-main member-post-main">
      <article className="post-article">
        <nav className="post-back">
          <Link href="/home">&larr; Back to Home</Link>
        </nav>
        <h1 className="post-title">{post.title}</h1>
        <p className="post-date">{post.dateStr}</p>
        <div className="post-media">
          {urls.map((url, i) => {
            const idx = (startIdx + i) % urls.length;
            return (
              <img
                key={idx}
                src={urls[idx]}
                alt=""
                className="post-media-img"
                loading={i === 0 ? "eager" : "lazy"}
              />
            );
          })}
        </div>
        <div
          className="post-body"
          dangerouslySetInnerHTML={{ __html: escapeHtml(post.body) }}
        />
        {post.comments && post.comments.length > 0 && (
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
