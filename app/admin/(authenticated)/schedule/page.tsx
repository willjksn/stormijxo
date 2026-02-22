"use client";

import { SchedulePlanner } from "../../../calendar/page";
import { AdminTabs } from "../../components/AdminTabs";

export default function AdminSchedulePage() {
  return (
    <>
      <AdminTabs />
      <main className="admin-main">
        <SchedulePlanner />
      </main>
    </>
  );
}
