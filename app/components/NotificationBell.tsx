"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where, orderBy, limit, doc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
import { NOTIFICATIONS_COLLECTION, notificationFromDoc, type NotificationDoc } from "../../lib/notifications";
import { PURCHASES_COLLECTION } from "../../lib/purchases";

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
  const [pendingPurchasesCount, setPendingPurchasesCount] = useState(0);
  const [unreadDmsCount, setUnreadDmsCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const db = getFirebaseDb();

  const load = useCallback(() => {
    if (!db) return null;
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
      return null;
    }
    return onSnapshot(
      q,
      (snap) => {
        const items: NotificationDoc[] = [];
        snap.forEach((d) => {
          items.push(notificationFromDoc(d.id, d.data() as Record<string, unknown>));
        });
        setList(items);
        setLoading(false);
      },
      () => {
        setList([]);
        setLoading(false);
      }
    );
  }, [db, variant, userEmail]);

  useEffect(() => {
    const unsub = load();
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [load]);

  useEffect(() => {
    if (!db || variant !== "admin") {
      setPendingPurchasesCount(0);
      return;
    }
    return onSnapshot(
      collection(db, PURCHASES_COLLECTION),
      (snap) => {
        let count = 0;
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          if (data.treatId == null) return;
          if (data.scheduleStatus === "scheduled") return;
          count += 1;
        });
        setPendingPurchasesCount(count);
      },
      () => setPendingPurchasesCount(0)
    );
  }, [db, variant]);

  useEffect(() => {
    if (!db || variant !== "admin") {
      setUnreadDmsCount(0);
      return;
    }
    return onSnapshot(
      query(
        collection(db, NOTIFICATIONS_COLLECTION),
        where("forAdmin", "==", true),
        where("type", "==", "dm"),
        where("read", "==", false)
      ),
      (snap) => setUnreadDmsCount(snap.size),
      () => setUnreadDmsCount(0)
    );
  }, [db, variant]);

  useEffect(() => {
    if (!db || variant !== "member" || !userEmail?.trim()) {
      if (variant === "member") setUnreadDmsCount(0);
      return;
    }
    const email = userEmail.trim().toLowerCase();
    return onSnapshot(
      query(
        collection(db, NOTIFICATIONS_COLLECTION),
        where("forMemberEmail", "==", email),
        where("type", "==", "dm"),
        where("read", "==", false)
      ),
      (snap) => setUnreadDmsCount(snap.size),
      () => setUnreadDmsCount(0)
    );
  }, [db, variant, userEmail]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, []);

  const otherUnreadCount = list.filter((n) => !n.read && n.type !== "dm").length;
  const unreadCount =
    variant === "admin"
      ? unreadDmsCount + pendingPurchasesCount + otherUnreadCount
      : unreadDmsCount + otherUnreadCount;

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
          {loading && list.length === 0 && unreadDmsCount === 0 && (variant !== "admin" || pendingPurchasesCount === 0) ? (
            <p className="notification-bell-empty">Loading…</p>
          ) : list.length === 0 && unreadDmsCount === 0 && !(variant === "admin" && pendingPurchasesCount > 0) ? (
            <p className="notification-bell-empty">No notifications</p>
          ) : (
            <ul className="notification-bell-list">
              {variant === "admin" && unreadDmsCount > 0 && (
                <li>
                  <Link
                    href="/admin/dms"
                    className="notification-bell-item unread"
                    onClick={() => setOpen(false)}
                  >
                    <span className="notification-bell-item-title">New messages</span>
                    <span className="notification-bell-item-body">
                      {unreadDmsCount} new message{unreadDmsCount === 1 ? "" : "s"}.
                    </span>
                  </Link>
                </li>
              )}
              {variant === "member" && unreadDmsCount > 0 && (
                <li>
                  <Link
                    href="/dms"
                    className="notification-bell-item unread"
                    onClick={() => setOpen(false)}
                  >
                    <span className="notification-bell-item-title">New messages</span>
                    <span className="notification-bell-item-body">
                      {unreadDmsCount} new message{unreadDmsCount === 1 ? "" : "s"}.
                    </span>
                  </Link>
                </li>
              )}
              {variant === "admin" && pendingPurchasesCount > 0 && (
                <li>
                  <Link
                    href="/admin/purchases"
                    className="notification-bell-item unread"
                    onClick={() => setOpen(false)}
                  >
                    <span className="notification-bell-item-title">New purchases</span>
                    <span className="notification-bell-item-body">
                      {pendingPurchasesCount} purchase{pendingPurchasesCount === 1 ? "" : "s"} need scheduling.
                    </span>
                  </Link>
                </li>
              )}
              {list.filter((n) => n.type !== "dm").map((n) => (
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
