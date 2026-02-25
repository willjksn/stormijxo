"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * /post with no path: redirect /post?id=xxx to /post/xxx (pretty URL), else redirect to /home.
 */
export default function PostIndexPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const img = searchParams.get("img");

  useEffect(() => {
    if (id) {
      const path = img != null ? `/post/${id}?img=${img}` : `/post/${id}`;
      router.replace(path);
    } else {
      router.replace("/home");
    }
  }, [id, img, router]);

  return (
    <main className="member-main member-post-main">
      <div className="post-loading">Loading…</div>
    </main>
  );
}
