"use client";

import { RequireAdmin } from "../components/RequireAdmin";
import { AdminHeader } from "../components/AdminHeader";

export default function AdminAuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-page">
      <RequireAdmin header={<AdminHeader />}>
        <AdminHeader />
        {children}
      </RequireAdmin>
    </div>
  );
}
