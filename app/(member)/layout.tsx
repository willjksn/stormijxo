"use client";

import { usePathname } from "next/navigation";
import { MemberHeader } from "../components/MemberHeader";
import { RequireAuth } from "../components/RequireAuth";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === "/treats" ? "treats" : "home";

  return (
    <RequireAuth>
      <MemberHeader active={active} />
      {children}
    </RequireAuth>
  );
}
