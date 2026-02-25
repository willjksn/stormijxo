"use client";

import { RequireAdmin } from "../components/RequireAdmin";
import { AdminHeader } from "../components/AdminHeader";
import { AdminToolsNav } from "../components/AdminToolsNav";

export default function AdminAuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-page">
      <RequireAdmin header={<AdminHeader />}>
        <AdminHeader />
        <AdminToolsNav />
        {children}
      </RequireAdmin>
    </div>
  );
}
