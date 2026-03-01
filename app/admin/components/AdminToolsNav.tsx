"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "../../../lib/firebase";
import { PURCHASES_COLLECTION } from "../../../lib/purchases";

const TOOLS_LINKS = [
  { id: "calendar", label: "Calendar", href: "/admin/dashboard?panel=tools&tool=calendar" },
  { id: "posts", label: "Post", href: "/admin/posts" },
  { id: "media", label: "Media", href: "/admin/media" },
  { id: "content", label: "Content", href: "/admin/content" },
  { id: "treats", label: "Treats", href: "/admin/treats" },
  { id: "purchases", label: "Purchases", href: "/admin/purchases" },
  { id: "dms", label: "Messages", href: "/admin/dms" },
  { id: "chat-session", label: "Chat session", href: "/admin/chat-session" },
  { id: "interactive-prompts", label: "Interactive prompts", href: "/admin/interactive-prompts" },
  { id: "rating-prompts", label: "Rating prompts", href: "/admin/rating-prompts" },
  { id: "ai-training", label: "AI Training", href: "/admin/ai-training" },
] as const;

export function AdminToolsNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  const toolParam = searchParams.get("tool");
  const [unscheduledPurchasesCount, setUnscheduledPurchasesCount] = useState(0);
  const [requestsCount, setRequestsCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const db = getFirebaseDb();
    if (!db) return;
    const unsubPurchases = onSnapshot(
      collection(db, PURCHASES_COLLECTION),
      (snap) => {
        if (!mountedRef.current) return;
        let count = 0;
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          if (data.treatId == null) return;
          if (data.scheduleStatus === "scheduled") return;
          count += 1;
        });
        setUnscheduledPurchasesCount(count);
      },
      () => {}
    );
    const unsubRequests = onSnapshot(
      query(collection(db, "notifications"), where("forAdmin", "==", true), where("type", "==", "dm"), where("read", "==", false)),
      (snap) => {
        if (mountedRef.current) setRequestsCount(snap.size);
      },
      () => {}
    );

    return () => {
      mountedRef.current = false;
      unsubPurchases();
      unsubRequests();
    };
  }, []);

  const activeId = (() => {
    if (pathname === "/admin/posts") return "posts";
    if (pathname === "/admin/media") return "media";
    if (pathname === "/admin/content") return "content";
    if (pathname === "/admin/treats") return "treats";
    if (pathname === "/admin/purchases") return "purchases";
    if (pathname === "/admin/dms") return "dms";
    if (pathname === "/admin/chat-session") return "chat-session";
    if (pathname === "/admin/interactive-prompts") return "interactive-prompts";
    if (pathname === "/admin/rating-prompts") return "rating-prompts";
    if (pathname === "/admin/ai-training") return "ai-training";
    if (pathname === "/admin/dashboard" && panel === "tools" && toolParam) {
      return TOOLS_LINKS.some((t) => t.id === toolParam) ? toolParam : "calendar";
    }
    if (pathname === "/admin/dashboard") return "calendar";
    return null;
  })();

  const getBadgeCount = (itemId: string): number => {
    if (itemId === "purchases") return unscheduledPurchasesCount;
    if (itemId === "dms") return requestsCount;
    return 0;
  };

  return (
    <nav className="admin-tools-nav" aria-label="Tools">
      <div className="admin-tools-nav-inner">
        {TOOLS_LINKS.map((item) => {
          const badgeCount = getBadgeCount(item.id);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`admin-tools-nav-tab${activeId === item.id ? " active" : ""}`}
            >
              {item.label}
              {badgeCount > 0 && (
                <span className="admin-tools-nav-badge" aria-label={`${badgeCount} pending`}>
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
