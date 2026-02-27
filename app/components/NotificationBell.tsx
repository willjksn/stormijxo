"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { collection, getDocs, query, where, orderBy, limit, doc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
import { NOTIFICATIONS_COLLECTION, notificationFromDoc, type NotificationDoc } from "../../lib/notifications";

type NotificationBellProps = {
  variant: "admin" | "member";
  userEmail: string | null;
};

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function NotificationBell({ variant, userEmail }: NotificationBellProps) {
  const [list, setList] = useState<NotificationDoc[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const db = getFirebaseDb();

  const load = useCallback(() => {
    if (!db) return;
    setLoading(true);
    const q =
      variant === "admin"
        ? query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where("forAdmin", "==", true),
            orderBy("createdAt", "desc"),
            limit(30)
          )
        : userEmail
          ? query(
              collection(db, NOTIFICATIONS_COLLECTION),
              where("forMemberEmail", "==", userEmail.trim().toLowerCase()),
              orderBy("createdAt", "desc"),
              limit(30)
            )
          : null;
    if (!q) {
      setLoading(false);
      setList([]);
      return;
    }
    getDocs(q)
      .then((snap) => {
        const items: NotificationDoc[] = [];
        snap.forEach((d) => {
          items.push(notificationFromDoc(d.id, d.data() as Record<string, unknown>));
        });
        setList(items);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [db, variant, userEmail]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, []);

  const unreadCount = list.filter((n) => !n.read).length;

  const markRead = useCallback(
    async (id: string) => {
      if (!db) return;
      try {
        await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), { read: true });
        setList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      } catch {
        // ignore
      }
    },
    [db]
  );

  const handleItemClick = (n: NotificationDoc) => {
    if (!n.read) markRead(n.id);
    setOpen(false);
  };

  return (
    <div className="notification-bell-wrap" ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `${unreadCount} notifications` : "Notifications"}
        title="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="notification-bell-badge" aria-hidden>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="notification-bell-dropdown">
          <div className="notification-bell-dropdown-header">
            <span>Notifications</span>
          </div>
          {loading && list.length === 0 ? (
            <p className="notification-bell-empty">Loading…</p>
          ) : list.length === 0 ? (
            <p className="notification-bell-empty">No notifications</p>
          ) : (
            <ul className="notification-bell-list">
              {list.map((n) => (
                <li key={n.id}>
                  {n.link ? (
                    <Link
                      href={n.link}
                      className={`notification-bell-item ${n.read ? "" : "unread"}`}
                      onClick={() => handleItemClick(n)}
                    >
                      <span className="notification-bell-item-title">{n.title}</span>
                      <span className="notification-bell-item-body">{n.body}</span>
                    </Link>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      className={`notification-bell-item ${n.read ? "" : "unread"}`}
                      onClick={() => handleItemClick(n)}
                      onKeyDown={(e) => e.key === "Enter" && handleItemClick(n)}
                    >
                      <span className="notification-bell-item-title">{n.title}</span>
                      <span className="notification-bell-item-body">{n.body}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
