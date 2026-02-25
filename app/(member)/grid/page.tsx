import Link from "next/link";
import { DEMO_POSTS } from "../home/demo-posts";

export default function GridPage() {
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

      <div className="feed-grid">
        {DEMO_POSTS.map((post) => (
          <Link key={post.id} href={`/post/${post.id}`} className="feed-grid-item">
            <img src={post.mediaUrls[0]} alt="" loading="lazy" />
          </Link>
        ))}
      </div>
    </main>
  );
}
