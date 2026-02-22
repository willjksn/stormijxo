"use client";

import Link from "next/link";

export default function AdminPostsPage() {
  return (
    <main className="admin-main" style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1>Posts</h1>
      <p className="intro">Create and manage member feed posts. Only published posts appear in the member feed.</p>
      <div className="content-block">
        <h2>Create post</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Post creation is available in the admin. Use the form to add title, body, and media URLs.</p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.5rem" }}>This page matches the previous admin design. Full CRUD can be wired to Firestore when ready.</p>
      </div>
      <Link href="/admin/dashboard" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>← Back to dashboard</Link>
    </main>
  );
}
