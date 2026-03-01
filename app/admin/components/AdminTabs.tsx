"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function AdminTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  const isDashboard = pathname === "/admin/dashboard";
  const isTools = isDashboard && panel === "tools";
  const isUsers = pathname === "/admin/users";

  return (
    <nav className="admin-tabs-bar" aria-label="Dashboard sections">
      <Link
        href="/admin/dashboard"
        className={`tab${isDashboard && !isTools ? " active" : ""}`}
      >
        Overview
      </Link>
      <Link
        href="/admin/users"
        className={`tab${isUsers ? " active" : ""}`}
      >
        Users
      </Link>
      <Link
        href="/admin/profiles"
        className={`tab${pathname === "/admin/profiles" ? " active" : ""}`}
      >
        Profiles
      </Link>
      <Link
        href="/admin/dashboard?panel=tools"
        className={`tab${isTools ? " active" : ""}`}
      >
        Tools
      </Link>
    </nav>
  );
}
