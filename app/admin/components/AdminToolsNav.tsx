"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TOOLS_LINKS = [
  { id: "calendar", label: "Calendar", href: "/admin/dashboard?panel=tools&tool=calendar" },
  { id: "posts", label: "Post", href: "/admin/posts" },
  { id: "media", label: "Media", href: "/admin/media" },
  { id: "content", label: "Content", href: "/admin/content" },
] as const;

export function AdminToolsNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  const toolParam = searchParams.get("tool");

  const activeId = (() => {
    if (pathname === "/admin/posts") return "posts";
    if (pathname === "/admin/media") return "media";
    if (pathname === "/admin/content") return "content";
    if (pathname === "/admin/dashboard" && panel === "tools" && toolParam) {
      return TOOLS_LINKS.some((t) => t.id === toolParam) ? toolParam : "calendar";
    }
    if (pathname === "/admin/dashboard") return "calendar";
    return null;
  })();

  return (
    <nav className="admin-tools-nav" aria-label="Tools">
      <div className="admin-tools-nav-inner">
        {TOOLS_LINKS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`admin-tools-nav-tab${activeId === item.id ? " active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
