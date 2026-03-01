"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { collection, doc, getDocs, query, where, updateDoc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "../../../lib/firebase";
import { TREATS_COLLECTION, DEFAULT_TREATS, type TreatDoc } from "../../../lib/treats";
import { PURCHASES_COLLECTION, purchaseFromDoc, type PurchaseDoc } from "../../../lib/purchases";
import { CHAT_SESSIONS_COLLECTION, chatSessionFromDoc, type ChatSessionDoc } from "../../../lib/chat-sessions";

const STORE_ENABLED =
  typeof process.env.NEXT_PUBLIC_TREATS_STORE !== "undefined"
    ? process.env.NEXT_PUBLIC_TREATS_STORE === "true"
    : true;

function formatScheduledDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatScheduledTime(timeStr: string): string {
  if (!timeStr || !timeStr.trim()) return "";
  const [h, min] = timeStr.split(":").map(Number);
  const hour = h ?? 0;
  const minute = min ?? 0;
  if (hour === 0 && minute === 0) return "12:00 AM";
  if (hour < 12) return `${hour}:${String(minute).padStart(2, "0")} AM`;
  if (hour === 12) return `12:${String(minute).padStart(2, "0")} PM`;
  return `${hour - 12}:${String(minute).padStart(2, "0")} PM`;
}

export default function TreatsPage() {
  const [treats, setTreats] = useState<TreatDoc[]>([]);
  const [scheduled, setScheduled] = useState<PurchaseDoc[]>([]);
  const [upcomingChatSessions, setUpcomingChatSessions] = useState<ChatSessionDoc[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();

  const loadScheduled = useCallback(() => {
    if (!db || !auth?.currentUser?.email) {
      setScheduled([]);
      return;
    }
    const email = auth.currentUser.email.trim().toLowerCase();
    const q = query(
      collection(db, PURCHASES_COLLECTION),
      where("email", "==", email),
      where("scheduleStatus", "==", "scheduled")
    );
    getDocs(q)
      .then((snap) => {
        const list: PurchaseDoc[] = [];
        snap.forEach((d) => {
          list.push(purchaseFromDoc(d.id, d.data() as Record<string, unknown>));
        });
        list.sort((a, b) => {
          const ta = a.scheduledAt?.getTime() ?? 0;
          const tb = b.scheduledAt?.getTime() ?? 0;
          return ta - tb;
        });
        setScheduled(list);
      })
      .catch(() => setScheduled([]));
  }, [db, auth?.currentUser?.email]);

  useEffect(() => {
    loadScheduled();
  }, [loadScheduled]);

  useEffect(() => {
    if (!db || !auth?.currentUser?.email) {
      setUpcomingChatSessions([]);
      return;
    }
    const emailNorm = auth.currentUser.email.trim().toLowerCase();
    const q = query(
      collection(db, CHAT_SESSIONS_COLLECTION),
      where("memberEmail", "==", emailNorm)
    );
    return onSnapshot(
      q,
      (snap) => {
        const now = Date.now();
        const list: ChatSessionDoc[] = [];
        snap.forEach((d) => {
          const parsed = chatSessionFromDoc(d.id, d.data() as Record<string, unknown>);
          if (!parsed || parsed.status === "ended") return;
          const start = parsed.scheduledStart?.getTime() ?? 0;
          if (start > now) list.push(parsed);
        });
        list.sort((a, b) => {
          const ta = a.scheduledStart?.getTime() ?? 0;
          const tb = b.scheduledStart?.getTime() ?? 0;
          return ta - tb;
        });
        setUpcomingChatSessions(list);
      },
      () => setUpcomingChatSessions([])
    );
  }, [db, auth?.currentUser?.email]);

  useEffect(() => {
    if (!db || !auth?.currentUser?.email) return;
    const unreadTreatNotificationsQ = query(
      collection(db, "notifications"),
      where("forMemberEmail", "==", auth.currentUser.email.trim().toLowerCase()),
      where("type", "==", "treat_scheduled"),
      where("read", "==", false)
    );
    getDocs(unreadTreatNotificationsQ)
      .then((snap) => Promise.all(snap.docs.map((d) => updateDoc(doc(db, "notifications", d.id), { read: true }))))
      .catch(() => {});
  }, [db, auth?.currentUser?.email]);

  useEffect(() => {
    if (!db) {
      setTreats(DEFAULT_TREATS);
      setListLoading(false);
      return;
    }
    getDocs(collection(db, TREATS_COLLECTION))
      .then((snap) => {
        const byId = new Map<string, TreatDoc>();
        snap.forEach((d) => {
          const data = d.data();
          byId.set(d.id, {
            id: d.id,
            name: (data.name ?? "").toString(),
            price: typeof data.price === "number" ? data.price : 0,
            description: (data.description ?? "").toString(),
            quantityLeft: typeof data.quantityLeft === "number" ? data.quantityLeft : 0,
            order: typeof data.order === "number" ? data.order : 0,
            hidden: data.hidden === true,
          });
        });
        // Always show default treats; Firestore overrides by id so DB is source of truth when present
        const merged: TreatDoc[] = DEFAULT_TREATS.map((def) => byId.get(def.id) ?? def);
        // Add any treats in Firestore that aren't in defaults (custom treats)
        byId.forEach((t, id) => {
          if (!DEFAULT_TREATS.some((d) => d.id === id)) merged.push(t);
        });
        merged.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
        setTreats(merged);
      })
      .catch(() => setTreats(DEFAULT_TREATS))
      .finally(() => setListLoading(false));
  }, [db]);

  if (!STORE_ENABLED) {
    return (
      <main className="member-main treats-main">
        <section className="treats-store-header">
          <h1 className="treats-title">Treats</h1>
          <p className="treats-subhead">Store is temporarily unavailable while updates are in progress.</p>
        </section>
        <p style={{ color: "var(--text-muted)", padding: "1.5rem 2rem" }}>
          Coming soon. Purchases are currently disabled.
        </p>
      </main>
    );
  }

  const handlePurchase = async (treatId: string) => {
    const treat = treats.find((t) => t.id === treatId);
    if (!treat || treat.quantityLeft <= 0) return;
    setLoading(treatId);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch("/api/treat-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treatId,
          base_url: base,
          success_url: `${base}/success`,
          cancel_url: `${base}/treats`,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      alert(data.error || "Checkout failed.");
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  if (listLoading) {
    return (
      <main className="member-main treats-main">
        <section className="treats-store-header">
          <h1 className="treats-title">Treats</h1>
          <p className="treats-subhead">Personal messages, voice notes, and more — just for you.</p>
        </section>
        <p style={{ color: "var(--text-muted)", padding: "2rem" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main className="member-main treats-main">
      <section className="treats-store-header">
        <h1 className="treats-title">Treats</h1>
        <p className="treats-subhead">Personal messages, voice notes, and more — just for you.</p>
      </section>

      {upcomingChatSessions.length > 0 && (
        <section className="treats-scheduled-section" style={{ marginBottom: "2rem" }}>
          <h2 className="treats-section-title" style={{ fontSize: "1.15rem", margin: "0 0 0.75rem", fontWeight: 600 }}>
            Upcoming chat sessions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {upcomingChatSessions.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: "1rem 1.25rem",
                  borderRadius: 12,
                  border: "1px solid rgba(212, 85, 139, 0.35)",
                  background: "rgba(212, 85, 139, 0.08)",
                }}
              >
                <p style={{ margin: "0 0 0.25rem", fontWeight: 600 }}>
                  Live chat ({s.durationMinutes} min)
                </p>
                <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-muted)" }}>
                  {s.scheduledStart
                    ? s.scheduledStart.toLocaleString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : "—"}
                </p>
                <Link
                  href="/chat-session"
                  className="btn btn-secondary"
                  style={{ marginTop: "0.75rem", display: "inline-block" }}
                >
                  Open chat session
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {scheduled.length > 0 && (
        <section className="treats-scheduled-section" style={{ marginBottom: "2rem" }}>
          <h2 className="treats-section-title" style={{ fontSize: "1.15rem", margin: "0 0 0.75rem", fontWeight: 600 }}>
            Scheduled for you
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {scheduled.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: "1rem 1.25rem",
                  borderRadius: 12,
                  border: "1px solid rgba(34, 197, 94, 0.35)",
                  background: "rgba(34, 197, 94, 0.08)",
                }}
              >
                <p style={{ margin: "0 0 0.25rem", fontWeight: 600 }}>{p.productName || "Treat"}</p>
                <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-muted)" }}>
                  {p.scheduledDate && formatScheduledDate(p.scheduledDate)}
                  {p.scheduledTime && ` at ${formatScheduledTime(p.scheduledTime)}`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="treats-grid">
        {treats.filter((t) => !t.hidden).length === 0 ? (
          <p style={{ color: "var(--text-muted)", gridColumn: "1 / -1" }}>No treats available right now.</p>
        ) : (
          treats.filter((t) => !t.hidden).map((treat) => (
            <button
              key={treat.id}
              type="button"
              className="treat-card"
              onClick={() => handlePurchase(treat.id)}
              disabled={treat.quantityLeft <= 0 || loading !== null}
            >
              <div className="treat-card-inner">
                <div className="treat-card-header">
                  <h2 className="treat-card-title">{treat.name}</h2>
                  <span className="treat-card-price">${treat.price}</span>
                </div>
                <p className="treat-card-desc">{treat.description}</p>
                <div className="treat-card-footer">
                  <span
                    className={`treat-card-qty ${treat.quantityLeft <= 0 ? "treat-card-qty-sold" : ""}`}
                  >
                    {treat.quantityLeft <= 0 ? "Sold out" : `${treat.quantityLeft} left`}
                  </span>
                  {treat.quantityLeft > 0 && (
                    <span className="treat-card-cta">
                      {loading === treat.id ? "…" : "Purchase"}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </main>
  );
}
