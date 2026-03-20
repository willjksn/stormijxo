"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "../../../lib/firebase";
import { SITE_CONFIG_CONTENT_ID, type SiteConfigContent } from "../../../lib/site-config";
import { feedHeroMediaIndex, type LockedContentForPreview } from "../../../lib/locked-post-media";

type GridPost = {
  id: string;
  mediaUrls: string[];
  mediaTypes?: ("image" | "video")[];
  lockedContent?: LockedContentForPreview;
};

export default function GridPage() {
  const [loading, setLoading] = useState(true);
  const [firestorePosts, setFirestorePosts] = useState<GridPost[]>([]);
  const [creatorPinnedPostIds, setCreatorPinnedPostIds] = useState<string[]>([]);
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

  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, "site_config", SITE_CONFIG_CONTENT_ID))
      .then((snap) => {
        const d = snap.exists() ? (snap.data() as SiteConfigContent) : {};
        const pinned = Array.isArray(d.pinnedPostIds) ? d.pinnedPostIds.map((v) => String(v)) : [];
        setCreatorPinnedPostIds(pinned);
      })
      .catch(() => setCreatorPinnedPostIds([]));
  }, [db]);

  const posts: GridPost[] = useMemo(() => {
    if (creatorPinnedPostIds.length === 0) return firestorePosts;
    const pinnedSet = new Set(creatorPinnedPostIds);
    const pinned: GridPost[] = [];
    const rest: GridPost[] = [];
    for (const p of firestorePosts) {
      if (pinnedSet.has(p.id)) pinned.push(p);
      else rest.push(p);
    }
    pinned.sort((a, b) => creatorPinnedPostIds.indexOf(a.id) - creatorPinnedPostIds.indexOf(b.id));
    return [...pinned, ...rest];
  }, [firestorePosts, creatorPinnedPostIds]);

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
        {!loading && posts.length === 0 && (
          <p className="feed-empty" style={{ gridColumn: "1 / -1" }}>No posts yet.</p>
        )}
        {!loading && posts.map((post) => {
          const locked =
            !!post.lockedContent?.enabled && (post.lockedContent?.priceCents ?? 0) >= 100;
          const thumbIdx = feedHeroMediaIndex(
            post.mediaUrls,
            post.mediaTypes,
            post.lockedContent,
            locked
          );
          const firstUrl = post.mediaUrls[thumbIdx];
          const isVideo =
            post.mediaTypes?.[thumbIdx] === "video" ||
            (firstUrl && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(firstUrl));
          return (
            <Link key={post.id} href={`/post/${post.id}`} className="feed-grid-item">
              {isVideo ? (
                <video src={firstUrl} muted playsInline className="feed-grid-media" aria-hidden />
              ) : (
                <img src={firstUrl} alt="" loading="lazy" decoding="async" className="feed-grid-media" />
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
