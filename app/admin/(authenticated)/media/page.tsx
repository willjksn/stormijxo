"use client";

import Link from "next/link";

export default function AdminMediaPage() {
  return (
    <main className="admin-main" style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1>Landing media</h1>
      <p className="intro">Upload an image or video for each slot. The landing page will use these instead of the default assets.</p>
      <div style={{ display: "grid", gap: "1.5rem" }}>
        <div className="content-block">
          <h2>Hero (main banner)</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Upload and revert can be wired to storage when ready.</p>
        </div>
        <div className="content-block">
          <h2>Preview 1 (“What you’ll see”)</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Media slots match the previous admin design.</p>
        </div>
      </div>
      <Link href="/admin/dashboard" style={{ color: "var(--accent)", fontSize: "0.9rem", marginTop: "1rem", display: "inline-block" }}>← Back to dashboard</Link>
    </main>
  );
}
