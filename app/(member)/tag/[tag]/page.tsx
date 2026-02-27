"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function TagPage() {
  const routeParams = useParams<{ tag?: string }>();
  const tag = typeof routeParams?.tag === "string" ? routeParams.tag : "";

  return (
    <main className="member-main member-post-main">
      <nav className="post-back">
        <Link href="/home">&larr; Back to Home</Link>
      </nav>
      <h1 className="post-title">#{tag || "tag"}</h1>
      <p className="post-date">Posts tagged with #{tag}</p>
      <p style={{ color: "var(--text-muted)" }}>
        Tag pages can show all posts containing this hashtag. Coming soon.
      </p>
    </main>
  );
}
