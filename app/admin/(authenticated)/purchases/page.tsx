"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
  where,
  limit,
} from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "../../../../lib/firebase";
import {
  purchaseFromDoc,
  PURCHASES_COLLECTION,
  type PurchaseDoc,
} from "../../../../lib/purchases";
import {
  CHAT_SESSIONS_COLLECTION,
  isChatSessionTreatId,
  parseChatSessionDurationMinutes,
} from "../../../../lib/chat-sessions";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr || !timeStr.trim()) return "";
  const [h, min] = timeStr.split(":").map(Number);
  const hour = h ?? 0;
  const minute = min ?? 0;
  if (hour === 0 && minute === 0) return "12:00 AM";
  if (hour < 12) return `${hour}:${String(minute).padStart(2, "0")} AM`;
  if (hour === 12) return `12:${String(minute).padStart(2, "0")} PM`;
  return `${hour - 12}:${String(minute).padStart(2, "0")} PM`;
}

export default function AdminPurchasesPage() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [purchases, setPurchases] = useState<PurchaseDoc[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("12:00");
  const db = getFirebaseDb();

  const loadPurchases = useCallback(() => {
    if (!db) {
      setPurchases([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, PURCHASES_COLLECTION),
      orderBy("createdAt", "desc")
    );
    getDocs(q)
      .then((snap) => {
        const list: PurchaseDoc[] = [];
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          if (!data.treatId) return;
          list.push(purchaseFromDoc(d.id, { ...data, id: d.id }));
        });
        list.sort((a, b) => {
          const ta = a.createdAt?.getTime() ?? 0;
          const tb = b.createdAt?.getTime() ?? 0;
          return tb - ta;
        });
        setPurchases(list);
      })
      .catch(() => setPurchases([]))
      .finally(() => setLoading(false));
  }, [db]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  useEffect(() => {
    if (!db) return;
    const unreadAdminPurchasesQ = query(
      collection(db, "notifications"),
      where("forAdmin", "==", true),
      where("type", "==", "treat_scheduled"),
      where("read", "==", false)
    );
    getDocs(unreadAdminPurchasesQ)
      .then((snap) => Promise.all(snap.docs.map((d) => updateDoc(doc(db, "notifications", d.id), { read: true }))))
      .catch(() => {});
  }, [db]);

  const showMsg = (type: "ok" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), type === "error" ? 6000 : 3000);
  };

  const handleSchedule = async (p: PurchaseDoc) => {
    if (!db || !scheduleDate.trim()) {
      showMsg("error", "Please pick a date.");
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      showMsg("error", "Please sign in again.");
      return;
    }
    setSavingId(p.id);
    setMessage(null);
    const [h, min] = scheduleTime.split(":").map(Number);
    const scheduledAt = new Date(scheduleDate);
    scheduledAt.setHours(h ?? 0, min ?? 0, 0, 0);
    try {
      await updateDoc(doc(db, PURCHASES_COLLECTION, p.id), {
        scheduleStatus: "scheduled",
        scheduledDate: scheduleDate.trim(),
        scheduledTime: `${String(h ?? 0).padStart(2, "0")}:${String(min ?? 0).padStart(2, "0")}`,
        scheduledAt: Timestamp.fromDate(scheduledAt),
        updatedAt: serverTimestamp(),
      });
      if (isChatSessionTreatId(p.treatId)) {
        await createChatSessionForPurchase(db, p, scheduledAt);
      }
      await createNotificationForMember(db, p, scheduleDate.trim(), scheduleTime);
      setEditingId(null);
      setScheduleDate("");
      setScheduleTime("12:00");
      loadPurchases();
      showMsg("ok", "Scheduled. It’s on your calendar and the member was notified.");
    } catch (err) {
      const e = err as { message?: string };
      showMsg("error", e?.message ?? "Failed to schedule.");
    } finally {
      setSavingId(null);
    }
  };

  const startEdit = (p: PurchaseDoc) => {
    setEditingId(p.id);
    setScheduleDate(p.scheduledDate ?? "");
    setScheduleTime(p.scheduledTime ?? "12:00");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setScheduleDate("");
    setScheduleTime("12:00");
  };

  if (loading) {
    return (
      <main className="admin-main admin-content-main" style={{ maxWidth: 800, margin: "0 auto" }}>
        <p className="intro" style={{ color: "var(--text-muted)" }}>Loading purchases…</p>
      </main>
    );
  }

  return (
    <main className="admin-main admin-content-main" style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1>Purchases</h1>
      <p className="intro" style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Treat purchases appear here. Set a date and time and click <strong>Schedule</strong> to add it to your calendar
        and notify the member. You can <strong>Edit</strong> to reschedule.{" "}
        <Link href="/admin/schedule" style={{ color: "var(--accent)" }}>Open Calendar</Link> to see scheduled treats or
        add one manually.
      </p>

      {message && (
        <p
          className={message.type === "ok" ? "admin-content-msg ok" : "admin-content-msg error"}
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            marginBottom: "1rem",
            background: message.type === "ok" ? "rgba(34, 197, 94, 0.15)" : "rgba(197, 48, 48, 0.15)",
            color: message.type === "ok" ? "#15803d" : "#c53030",
          }}
        >
          {message.text}
        </p>
      )}

      {purchases.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          No treat purchases yet. When someone buys from the Treats store, a card will appear here.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {purchases.map((p) => {
          const isPending = p.scheduleStatus !== "scheduled";
          const isEditing = editingId === p.id;
          return (
            <div
              key={p.id}
              className="content-block"
              style={{
                border: `1px solid ${isPending ? "rgba(217, 119, 6, 0.4)" : "var(--border)"}`,
                borderRadius: 12,
                padding: "1rem 1.25rem",
                background: isPending ? "rgba(254, 243, 199, 0.4)" : "var(--bg-card)",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                <div>
                  <p style={{ margin: "0 0 0.25rem", fontWeight: 600 }}>{p.productName || "Treat purchase"}</p>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                    {p.email ?? "—"}
                    {p.amountCents != null && (
                      <span style={{ marginLeft: "0.5rem" }}> · ${(p.amountCents / 100).toFixed(2)}</span>
                    )}
                  </p>
                  {isPending && (
                    <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>
                      Needs to be scheduled
                    </p>
                  )}
                  {!isPending && p.scheduledDate && (
                    <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
                      Scheduled: {formatDate(p.scheduledDate)} at {formatTime(p.scheduledTime)}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                  {!isPending && !isEditing && (
                    <button type="button" className="btn btn-secondary" onClick={() => startEdit(p)}>
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {(isPending || isEditing) && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Date</span>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)" }}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Time</span>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)" }}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={savingId === p.id || !scheduleDate.trim()}
                      onClick={() => handleSchedule(p)}
                    >
                      {savingId === p.id ? "Saving…" : isPending ? "Schedule" : "Save changes"}
                    </button>
                    {isEditing && (
                      <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

async function createNotificationForMember(
  db: ReturnType<typeof getFirebaseDb>,
  p: PurchaseDoc,
  scheduledDate: string,
  scheduledTime: string
) {
  if (!db || !p.email) return;
  const dateStr = formatDate(scheduledDate);
  const timeStr = formatTime(scheduledTime);
  const isChatSession = isChatSessionTreatId(p.treatId);
  await addDoc(collection(db, "notifications"), {
    forMemberEmail: p.email.trim().toLowerCase(),
    type: "treat_scheduled",
    title: isChatSession ? "Live chat scheduled" : "Treat scheduled",
    body: isChatSession
      ? `Your live chat is scheduled for ${dateStr} at ${timeStr}. When it's time, open the app and go to Chat session to join.`
      : `${p.productName || "Your treat"} is scheduled for ${dateStr} at ${timeStr}.`,
    link: isChatSession ? "/chat-session" : "/treats",
    read: false,
    purchaseId: p.id,
    scheduledDate,
    scheduledTime,
    productName: p.productName,
    createdAt: serverTimestamp(),
  });
  await addDoc(collection(db, "notifications"), {
    forAdmin: true,
    type: "treat_scheduled",
    title: "Treat scheduled",
    body: `${p.productName || "Treat"} for ${p.email} — ${dateStr} at ${timeStr}.`,
    link: "/admin/purchases",
    read: false,
    purchaseId: p.id,
    createdAt: serverTimestamp(),
  });
}

async function createChatSessionForPurchase(
  db: ReturnType<typeof getFirebaseDb>,
  p: PurchaseDoc,
  scheduledAt: Date
) {
  if (!db || !p.email) return;
  const emailNorm = p.email.trim().toLowerCase();
  const memberSnap = await getDocs(
    query(collection(db, "members"), where("email", "==", emailNorm), limit(1))
  );
  const memberDoc = memberSnap.docs[0];
  const conversationId = memberDoc
    ? (memberDoc.data().uid || memberDoc.data().userId || `member-${memberDoc.id}`)
    : "";
  const memberName = memberDoc?.data().displayName ?? memberDoc?.data().note ?? null;
  await addDoc(collection(db, CHAT_SESSIONS_COLLECTION), {
    purchaseId: p.id,
    conversationId,
    memberEmail: emailNorm,
    memberName: memberName != null ? String(memberName) : null,
    scheduledStart: Timestamp.fromDate(scheduledAt),
    durationMinutes: parseChatSessionDurationMinutes(p.treatId ?? "chat-session-15"),
    status: "scheduled",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
