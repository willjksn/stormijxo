"use client";

import Link from "next/link";

export default function AdminContentPage() {
  return (
    <main className="admin-main" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1>Landing content</h1>
      <p className="intro" style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Edit the testimonial and control whether the member count is shown on the landing page.
      </p>
      <div className="content-block">
        <h2>Testimonial</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Quote and attribution can be edited here once wired to Firestore.</p>
      </div>
      <div className="content-block">
        <h2>Member count</h2>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", color: "var(--text-muted)" }}>
          Display &quot;Join <strong>0</strong> in the circle&quot; in the CTA. Count comes from members collection.
        </p>
      </div>
      <Link href="/admin/dashboard" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>← Back to dashboard</Link>
    </main>
  );
}
