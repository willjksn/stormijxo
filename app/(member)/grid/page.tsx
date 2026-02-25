"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { getFirebaseDb } from "../../../lib/firebase";
import { DEMO_POSTS } from "../home/demo-posts";

type GridPost = { id: string; mediaUrls: string[]; mediaTypes?: ("image" | "video")[] };

export default function GridPage() {
  const [loading, setLoading] = useState(true);
  const [firestorePosts, setFirestorePosts] = useState<GridPost[]>([]);
  const db = getFirebaseDb();

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    getDocs(q)
      .then((snap) => {
        const list: GridPost[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const status = (d.status as string) ?? "published";
          if (status !== "published") return;
          const mediaUrls = (d.mediaUrls as string[]) ?? [];
          if (mediaUrls.length === 0) return;
          list.push({
            id: docSnap.id,
            mediaUrls,
            mediaTypes: (d.mediaTypes as ("image" | "video")[]) ?? [],
          });
        });
        setFirestorePosts(list);
      })
      .catch(() => setFirestorePosts([]))
      .finally(() => setLoading(false));
  }, [db]);

  const posts: GridPost[] = useMemo(() => {
    if (firestorePosts.length > 0) return firestorePosts;
    return DEMO_POSTS.map((p) => ({
      id: p.id,
      mediaUrls: p.mediaUrls,
      mediaTypes: undefined as ("image" | "video")[] | undefined,
    }));
  }, [firestorePosts]);

  return (
    <main className="member-main member-feed-main">
      <div className="feed-header">
        <Link href="/home" className="feed-view-toggle" title="Switch to list view" aria-label="Switch to list view">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </Link>
      </div>

      {loading && <p className="feed-loading">Loading…</p>}
      <div className="feed-grid">
        {!loading && posts.map((post) => {
          const firstUrl = post.mediaUrls[0];
          const isVideo = post.mediaTypes?.[0] === "video" || (firstUrl && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(firstUrl));
          return (
            <Link key={post.id} href={`/post/${post.id}`} className="feed-grid-item">
              {isVideo ? (
                <video src={firstUrl} muted playsInline className="feed-grid-media" aria-hidden />
              ) : (
                <img src={firstUrl} alt="" loading="lazy" className="feed-grid-media" />
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
