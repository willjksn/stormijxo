"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { RequireAdmin } from "../components/RequireAdmin";
import { AdminHeader } from "../components/AdminHeader";
import { AdminTabs } from "../components/AdminTabs";
import { AdminToolsNav } from "../components/AdminToolsNav";

export default function AdminAuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  const isToolsSection =
    (pathname === "/admin/dashboard" && panel === "tools") ||
    pathname === "/admin/posts" ||
    pathname === "/admin/media" ||
    pathname === "/admin/content";

  return (
    <div className="admin-page">
      <RequireAdmin header={<AdminHeader />}>
        <AdminHeader />
        <AdminTabs />
        {isToolsSection && <AdminToolsNav />}
        {children}
      </RequireAdmin>
    </div>
  );
}
