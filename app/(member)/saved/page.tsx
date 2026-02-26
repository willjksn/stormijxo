"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { getFirebaseDb } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";

type SavedPost = {
  id: string;
  body: string;
  mediaUrls: string[];
  mediaTypes?: ("image" | "video")[];
};

export default function SavedPostsPage() {
  const db = getFirebaseDb();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [unsavingId, setUnsavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !user?.uid) {
      setLoading(false);
      setPosts([]);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const d = userSnap.exists() ? userSnap.data() : {};
        const savedIds = Array.isArray(d.savedPostIds) ? (d.savedPostIds as unknown[]).map((v) => String(v)) : [];
        if (savedIds.length === 0) {
          setPosts([]);
          return;
        }
        const chunks: string[][] = [];
        for (let i = 0; i < savedIds.length; i += 10) chunks.push(savedIds.slice(i, i + 10));
        const results: SavedPost[] = [];
        for (const ids of chunks) {
          const snap = await getDocs(query(collection(db, "posts"), where("__name__", "in", ids)));
          snap.forEach((docSnap) => {
            const p = docSnap.data();
            const status = (p.status as string) ?? "published";
            if (status !== "published") return;
            results.push({
              id: docSnap.id,
              body: (p.body as string) ?? "",
              mediaUrls: (p.mediaUrls as string[]) ?? [],
              mediaTypes: (p.mediaTypes as ("image" | "video")[]) ?? [],
            });
          });
        }
        const byId = new Map(results.map((p) => [p.id, p]));
        const ordered = savedIds.map((id) => byId.get(id)).filter((p): p is SavedPost => !!p);
        setPosts(ordered);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [db, user?.uid]);

  const savedPosts = useMemo(() => posts, [posts]);

  const unsavePost = async (postId: string) => {
    if (!db || !user?.uid || !postId) return;
    setUnsavingId(postId);
    try {
      const userRef = doc(db, "users", user.uid);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists()) return;
        const d = snap.data() as Record<string, unknown>;
        const existing = Array.isArray(d.savedPostIds) ? (d.savedPostIds as unknown[]).map((v) => String(v)) : [];
        const next = existing.filter((id) => id !== postId);
        tx.set(
          userRef,
          {
            savedPostIds: next,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } finally {
      setUnsavingId(null);
    }
  };

  return (
    <main className="member-main member-feed-main">
      <div className="feed-header">
        <Link href="/home" className="feed-view-toggle" title="Back to home feed" aria-label="Back to home feed">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </Link>
        <h1 className="feed-title">Saved posts</h1>
      </div>

      {loading && <p className="feed-loading">Loading…</p>}
      {!loading && savedPosts.length === 0 && <p className="feed-empty">No saved posts yet.</p>}

      <div className="feed-grid saved-feed-grid">
        {!loading &&
          savedPosts.map((post) => {
            const firstUrl = post.mediaUrls[0];
            const isVideo = post.mediaTypes?.[0] === "video" || (firstUrl && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(firstUrl));
            return (
              <Link key={post.id} href={`/post/${post.id}`} className="feed-grid-item saved-feed-grid-item">
                {isVideo ? (
                  <video src={firstUrl} muted playsInline className="feed-grid-media" aria-hidden />
                ) : (
                  <img src={firstUrl} alt="" loading="lazy" decoding="async" className="feed-grid-media" />
                )}
                <span className="saved-feed-grid-caption">{post.body || "View post"}</span>
                <button
                  type="button"
                  className="saved-feed-grid-unsave"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void unsavePost(post.id);
                  }}
                  disabled={unsavingId === post.id}
                  aria-label="Unsave post"
                >
                  {unsavingId === post.id ? "..." : "Unsave"}
                </button>
              </Link>
            );
          })}
      </div>
    </main>
  );
}
