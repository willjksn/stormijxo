"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RequireAdmin } from "../components/RequireAdmin";
import { AdminHeader } from "../components/AdminHeader";
import { AdminTabs } from "../components/AdminTabs";
import { AdminToolsNav } from "../components/AdminToolsNav";

function AdminAuthenticatedLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  const isToolsPage =
    pathname === "/admin/posts" ||
    pathname === "/admin/media" ||
    pathname === "/admin/content" ||
    pathname === "/admin/treats" ||
    pathname === "/admin/purchases" ||
    pathname === "/admin/dms" ||
    pathname === "/admin/chat-session" ||
    pathname === "/admin/interactive-prompts" ||
    pathname === "/admin/rating-prompts" ||
    pathname === "/admin/ai-training";
  const isDashboardToolsPanel = pathname === "/admin/dashboard" && panel === "tools";
  const showToolsNav = isToolsPage || isDashboardToolsPanel;

  return (
    <div className="admin-page">
      <RequireAdmin header={<AdminHeader />}>
        <AdminHeader />
        <AdminTabs />
        {showToolsNav && <AdminToolsNav />}
        {children}
      </RequireAdmin>
    </div>
  );
}

export default function AdminAuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="admin-page" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>Loading…</div>}>
      <AdminAuthenticatedLayoutInner>{children}</AdminAuthenticatedLayoutInner>
    </Suspense>
  );
}
