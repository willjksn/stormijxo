"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { collection, getDocs, query, where, doc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
import { PURCHASES_COLLECTION, purchaseFromDoc } from "../../lib/purchases";
import styles from "./calendar.module.css";

type PostStatus = "scheduled" | "published" | "draft";
type ScheduleItemType = "content" | "fanMeeting";
type ReminderType = "post" | "shoot";

type CalendarPost = {
  id: string;
  body: string;
  mediaUrls: string[];
  mediaTypes?: ("image" | "video")[];
  status: PostStatus;
  calendarDate: string;
  calendarTime?: string;
};

type ScheduleItem = {
  id: string;
  title: string;
  notes: string;
  date: string;
  time: string;
  status: PostStatus;
  type: ScheduleItemType;
};

type ReminderItem = {
  id: string;
  reminderType: ReminderType;
  title: string;
  description: string;
  date: string;
  time: string;
};

type ScheduledTreat = {
  id: string;
  productName: string;
  email: string;
  scheduledDate: string;
  scheduledTime: string;
};

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function buildMonthGrid(monthDate: Date): Date[] {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const grid: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    grid.push(day);
  }
  return grid;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SEED_SCHEDULE_ITEMS: ScheduleItem[] = [];

function scheduleBadgeClass(item: ScheduleItem): string {
  if (item.type === "fanMeeting" && item.status === "scheduled") return styles.badgePink;
  if (item.status === "published") return styles.badgeGreen;
  if (item.status === "draft") return styles.badgeGray;
  return styles.badgeBlue;
}

function statusCardClass(status: PostStatus): string {
  if (status === "published") return styles.cardGreen;
  if (status === "scheduled") return styles.cardPink;
  return styles.cardGray;
}

function formatScheduledAt(calendarDate: string, calendarTime?: string): string {
  if (!calendarDate) return "";
  const [y, m, d] = calendarDate.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  let timeStr = "";
  if (calendarTime) {
    const [h, min] = calendarTime.split(":").map(Number);
    date.setHours(h ?? 0, min ?? 0, 0, 0);
    timeStr = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  const dateStr = date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return timeStr ? `${dateStr} at ${timeStr}` : dateStr;
}

function calendarDateToInputValue(calendarDate: string): string {
  return calendarDate || "";
}

function calendarTimeToInputValue(calendarTime?: string): string {
  if (!calendarTime) return "12:00";
  const [h, m] = calendarTime.split(":").map(Number);
  return `${String(h ?? 0).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
}

/** Format "14:00" as "2:00 PM" for card display */
function formatTime12h(calendarTime?: string): string {
  if (!calendarTime || !calendarTime.trim()) return "—";
  const [h, min] = calendarTime.split(":").map(Number);
  const hour = h ?? 0;
  const minute = min ?? 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hour === 0) return `12:${pad(minute)} AM`;
  if (hour < 12) return `${hour}:${pad(minute)} AM`;
  if (hour === 12) return `12:${pad(minute)} PM`;
  return `${hour - 12}:${pad(minute)} PM`;
}

function CalendarPostCard({
  post,
  onOpenPreview,
}: {
  post: CalendarPost;
  onOpenPreview: (post: CalendarPost) => void;
}) {
  const firstUrl = post.mediaUrls?.[0];
  const isVideo = post.mediaTypes?.[0] === "video" || (firstUrl && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(firstUrl));
  const captionSnippet = (post.body || "").trim().slice(0, 50) + ((post.body || "").length > 50 ? "…" : "");

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-calendar-card-action]")) return;
    onOpenPreview(post);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`${styles.calendarPostCard} ${statusCardClass(post.status)} ${styles.calendarPostCardClickable}`}
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenPreview(post); } }}
      data-calendar-post-card
    >
      <div className={styles.calendarPostCardHeader}>
        <span className={styles.calendarPostTime}>{formatTime12h(post.calendarTime)}</span>
        <span className={styles.calendarPostStatusDot} aria-hidden />
      </div>
      <div className={styles.calendarPostPreview}>
        {firstUrl
          ? (isVideo ? (
            <video src={firstUrl} muted playsInline className={styles.calendarPostMedia} aria-hidden />
          ) : (
            <img src={firstUrl} alt="" className={styles.calendarPostMedia} loading="lazy" decoding="async" />
          ))
          : <div className={styles.calendarPostMediaPlaceholder}>No media</div>}
      </div>
      <p className={styles.calendarPostCaption}>{captionSnippet || "No caption"}</p>
      <div className={styles.calendarPostBrand}>
        <img src="/assets/sj-heart-avatar.png" alt="" className={styles.calendarPostSJIcon} aria-hidden />
        <span className={styles.calendarPostLabel}>POST</span>
      </div>
    </div>
  );
}

export function SchedulePlanner() {
  const [month, setMonth] = useState(() => new Date());
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [scheduledTreats, setScheduledTreats] = useState<ScheduledTreat[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(SEED_SCHEDULE_ITEMS);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    reminderType: "post" as ReminderType,
    title: "",
    description: "",
    date: "",
    time: "",
  });
  const [loading, setLoading] = useState(true);
  const [previewPost, setPreviewPost] = useState<CalendarPost | null>(null);
  const [showRescheduleInPreview, setShowRescheduleInPreview] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("12:00");
  const [previewActionLoading, setPreviewActionLoading] = useState(false);
  const db = getFirebaseDb();

  const monthStart = useMemo(() => toISODate(new Date(month.getFullYear(), month.getMonth(), 1)), [month]);
  const monthEnd = useMemo(() => {
    const d = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    return toISODate(d);
  }, [month]);

  const fetchPosts = useCallback(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, "posts"),
      where("calendarDate", ">=", monthStart),
      where("calendarDate", "<=", monthEnd)
    );
    getDocs(q)
      .then((snap) => {
        const list: CalendarPost[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const calendarDate = (d.calendarDate as string) || "";
          if (!calendarDate) return;
          let mediaUrls = (d.mediaUrls as string[]) ?? [];
          let mediaTypes = (d.mediaTypes as ("image" | "video")[]) ?? [];
          if (mediaUrls.length === 0 && Array.isArray(d.media)) {
            mediaUrls = (d.media as { url?: string; isVideo?: boolean }[])
              .map((m) => m?.url)
              .filter(Boolean) as string[];
            mediaTypes = (d.media as { url?: string; isVideo?: boolean }[]).map((m) =>
              m?.isVideo ? "video" : "image"
            );
          }
          list.push({
            id: docSnap.id,
            body: (d.body as string) ?? "",
            mediaUrls,
            mediaTypes,
            status: (d.status as PostStatus) ?? "draft",
            calendarDate,
            calendarTime: (d.calendarTime as string) ?? "",
          });
        });
        setPosts(list);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [db, monthStart, monthEnd]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const fetchScheduledTreats = useCallback(() => {
    if (!db) return;
    getDocs(collection(db, PURCHASES_COLLECTION))
      .then((snap) => {
        const list: ScheduledTreat[] = [];
        snap.forEach((docSnap) => {
          const data = purchaseFromDoc(docSnap.id, docSnap.data() as Record<string, unknown>);
          if (data.scheduleStatus !== "scheduled" || !data.scheduledDate) return;
          if (data.scheduledDate < monthStart || data.scheduledDate > monthEnd) return;
          list.push({
            id: data.id,
            productName: data.productName ?? "Treat",
            email: data.email ?? "",
            scheduledDate: data.scheduledDate,
            scheduledTime: data.scheduledTime ?? "",
          });
        });
        setScheduledTreats(list);
      })
      .catch(() => setScheduledTreats([]));
  }, [db, monthStart, monthEnd]);

  useEffect(() => {
    fetchScheduledTreats();
  }, [fetchScheduledTreats]);

  const deletePost = useCallback(
    async (id: string) => {
      if (!db) return;
      try {
        await deleteDoc(doc(db, "posts", id));
        fetchPosts();
      } catch {
        // ignore
      }
    },
    [db, fetchPosts]
  );

  const monthDays = useMemo(() => buildMonthGrid(month), [month]);

  const postsByDate = useMemo(() => {
    const map = new Map<string, CalendarPost[]>();
    for (const post of posts) {
      const arr = map.get(post.calendarDate) || [];
      arr.push(post);
      map.set(post.calendarDate, arr);
    }
    return map;
  }, [posts]);

  const scheduleByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of scheduleItems) {
      const arr = map.get(item.date) || [];
      arr.push(item);
      map.set(item.date, arr);
    }
    return map;
  }, [scheduleItems]);

  const remindersByDate = useMemo(() => {
    const map = new Map<string, ReminderItem[]>();
    for (const r of reminders) {
      const arr = map.get(r.date) || [];
      arr.push(r);
      map.set(r.date, arr);
    }
    return map;
  }, [reminders]);

  const treatsByDate = useMemo(() => {
    const map = new Map<string, ScheduledTreat[]>();
    for (const t of scheduledTreats) {
      const arr = map.get(t.scheduledDate) || [];
      arr.push(t);
      map.set(t.scheduledDate, arr);
    }
    return map;
  }, [scheduledTreats]);

  function openReminderModal() {
    setShowReminderModal(true);
  }

  function closeReminderModal() {
    setShowReminderModal(false);
    setReminderForm({ reminderType: "post", title: "", description: "", date: "", time: "" });
  }

  function saveReminder() {
    if (!reminderForm.title || !reminderForm.date) return;
    const newReminder: ReminderItem = {
      id: crypto.randomUUID(),
      reminderType: reminderForm.reminderType,
      title: reminderForm.title.trim(),
      description: reminderForm.description.trim(),
      date: reminderForm.date,
      time: reminderForm.time,
    };
    setReminders((prev) => [...prev, newReminder]);
    closeReminderModal();
  }

  function goToPrevMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  function openPreview(post: CalendarPost) {
    setPreviewPost(post);
    setShowRescheduleInPreview(false);
    setRescheduleDate(calendarDateToInputValue(post.calendarDate));
    setRescheduleTime(calendarTimeToInputValue(post.calendarTime));
  }

  function closePreview() {
    setPreviewPost(null);
    setShowRescheduleInPreview(false);
  }

  async function saveReschedule() {
    if (!db || !previewPost || !rescheduleDate) return;
    setPreviewActionLoading(true);
    try {
      const [h, min] = rescheduleTime.split(":").map(Number);
      const sched = new Date(rescheduleDate);
      sched.setHours(h ?? 0, min ?? 0, 0, 0);
      await updateDoc(doc(db, "posts", previewPost.id), {
        calendarDate: rescheduleDate,
        calendarTime: `${String(h ?? 0).padStart(2, "0")}:${String(min ?? 0).padStart(2, "0")}`,
        scheduledAt: Timestamp.fromDate(sched),
        status: "scheduled",
        updatedAt: serverTimestamp(),
      });
      setShowRescheduleInPreview(false);
      setPreviewPost((p) => p ? { ...p, calendarDate: rescheduleDate, calendarTime: `${String(h ?? 0).padStart(2, "0")}:${String(min ?? 0).padStart(2, "0")}` } : null);
      fetchPosts();
    } catch (err) {
      console.error("Reschedule failed:", err);
    } finally {
      setPreviewActionLoading(false);
    }
  }

  async function publishPostFromPreview() {
    if (!db || !previewPost) return;
    setPreviewActionLoading(true);
    try {
      const now = new Date();
      const calendarDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const calendarTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      await updateDoc(doc(db, "posts", previewPost.id), {
        status: "published",
        calendarDate,
        calendarTime,
        publishedAt: Timestamp.fromDate(now),
        published: true,
        updatedAt: serverTimestamp(),
      });
      closePreview();
      fetchPosts();
    } catch (err) {
      console.error("Publish failed:", err);
    } finally {
      setPreviewActionLoading(false);
    }
  }

  async function deleteFromPreview() {
    if (!db || !previewPost) return;
    if (!confirm("Delete this post?")) return;
    setPreviewActionLoading(true);
    try {
      await deleteDoc(doc(db, "posts", previewPost.id));
      closePreview();
      fetchPosts();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setPreviewActionLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>My Schedule</h1>
            <p className={styles.subtitle}>
              Plan posts, fan meetings, and reminders from one calendar.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/admin/purchases" className={styles.reminderBtn}>
              Schedule treat
            </Link>
            <button type="button" className={styles.reminderBtn} onClick={openReminderModal}>
              + Add Reminder
            </button>
            <Link href="/admin/posts" className={styles.reminderBtn}>
              + New post
            </Link>
          </div>
        </header>

        <div className={styles.legend}>
          <span><i className={`${styles.dot} ${styles.dotBlue}`} />Scheduled content</span>
          <span><i className={`${styles.dot} ${styles.dotGreen}`} />Published content</span>
          <span><i className={`${styles.dot} ${styles.dotGray}`} />Draft</span>
          <span><i className={`${styles.dot} ${styles.dotPink}`} />Scheduled fan meeting</span>
          <span><i className={`${styles.dot} ${styles.dotTreat}`} />Scheduled treat</span>
        </div>

        <div className={styles.monthBar}>
          <button type="button" onClick={goToPrevMonth} className={styles.monthNav}>
            ‹
          </button>
          <h2>{monthLabel(month)}</h2>
          <button type="button" onClick={goToNextMonth} className={styles.monthNav}>
            ›
          </button>
        </div>

        {loading && <p className={styles.loading}>Loading calendar…</p>}
        {!loading && posts.length === 0 && (
          <p className={styles.loading}>No scheduled posts this month. Create a post from Post and schedule it to see it here.</p>
        )}
        <div className={styles.gridScroll}>
          <div className={styles.grid}>
            {WEEKDAYS.map((day) => (
              <div key={day} className={styles.weekday}>
                {day}
              </div>
            ))}

            {monthDays.map((day) => {
              const iso = toISODate(day);
              const todayIso = toISODate(new Date());
              const isToday = iso === todayIso;
              const dayPosts = postsByDate.get(iso) || [];
              const daySchedule = scheduleByDate.get(iso) || [];
              const dayReminders = remindersByDate.get(iso) || [];
              const inMonth = day.getMonth() === month.getMonth();

              return (
                <div
                  key={iso}
                  className={`${styles.cell} ${inMonth ? "" : styles.cellMuted} ${isToday ? styles.cellToday : ""}`}
                >
                  <span className={styles.dateNum}>{day.getDate()}</span>
                  <div className={styles.badges}>
                    {daySchedule.map((item) => (
                      <span key={item.id} className={`${styles.badge} ${scheduleBadgeClass(item)}`}>
                        {item.title}
                      </span>
                    ))}
                    {(treatsByDate.get(iso) || []).map((t) => (
                      <span key={t.id} className={`${styles.badge} ${styles.badgeTreat}`} title={`${t.productName} — ${t.email}`}>
                        Treat: {t.productName}
                      </span>
                    ))}
                    {dayReminders.map((r) => (
                      <span key={r.id} className={`${styles.badge} ${styles.badgeGray}`}>
                        {r.reminderType === "post" ? "Post" : "Shoot"}: {r.title}
                      </span>
                    ))}
                  </div>
                  <div className={styles.cellPosts}>
                    {dayPosts.map((post) => (
                      <CalendarPostCard
                        key={post.id}
                        post={post}
                        onOpenPreview={openPreview}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {reminders.length > 0 && (
          <section className={styles.reminderList}>
            <h3>Upcoming reminders</h3>
            {reminders.slice(-4).map((r) => (
              <p key={r.id}>
                <strong>{r.reminderType === "post" ? "Post reminder" : "Shoot reminder"}:</strong>{" "}
                {r.title} — {r.date} {r.time || ""}
              </p>
            ))}
          </section>
        )}
      </section>

      {showReminderModal && (
        <div className={styles.overlay} onClick={closeReminderModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Create Reminder</h3>
              <button type="button" onClick={closeReminderModal}>×</button>
            </div>
            <div className={styles.formRow}>
              <label>Reminder type</label>
              <div className={styles.typeRow}>
                <button
                  type="button"
                  className={reminderForm.reminderType === "post" ? styles.typeActive : styles.typeBtn}
                  onClick={() => setReminderForm((p) => ({ ...p, reminderType: "post" }))}
                >
                  Post reminder
                </button>
                <button
                  type="button"
                  className={reminderForm.reminderType === "shoot" ? styles.typeActive : styles.typeBtn}
                  onClick={() => setReminderForm((p) => ({ ...p, reminderType: "shoot" }))}
                >
                  Shoot reminder
                </button>
              </div>
            </div>
            <div className={styles.formRow}>
              <label>Title *</label>
              <input
                value={reminderForm.title}
                onChange={(e) => setReminderForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Post Instagram content, film TikTok video"
              />
            </div>
            <div className={styles.formRow}>
              <label>Description</label>
              <textarea
                value={reminderForm.description}
                onChange={(e) => setReminderForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Additional notes..."
              />
            </div>
            <div className={styles.formRow}>
              <label>Date *</label>
              <input
                type="date"
                value={reminderForm.date}
                onChange={(e) => setReminderForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className={styles.formRow}>
              <label>Time</label>
              <input
                type="time"
                value={reminderForm.time}
                onChange={(e) => setReminderForm((p) => ({ ...p, time: e.target.value }))}
              />
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={closeReminderModal} className={styles.cancelBtn}>Cancel</button>
              <button type="button" onClick={saveReminder} className={styles.saveBtn} disabled={!reminderForm.title || !reminderForm.date}>
                Save reminder
              </button>
            </div>
          </div>
        </div>
      )}

      {previewPost && (
        <div className={styles.overlay} onClick={closePreview}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.previewHeader}>
              <div>
                <h2 className={styles.previewTitle}>Post Preview</h2>
              </div>
              <div className={styles.previewHeaderActions}>
                <button type="button" className={styles.previewActionBtn} onClick={() => setShowRescheduleInPreview((v) => !v)}>
                  Edit
                </button>
                {previewPost.status !== "published" && (
                  <>
                    <button type="button" className={styles.previewActionBtnPrimary} onClick={publishPostFromPreview} disabled={previewActionLoading}>
                      {previewActionLoading ? "…" : "Publish Now"}
                    </button>
                    <button type="button" className={styles.previewActionBtnPrimary} onClick={publishPostFromPreview} disabled={previewActionLoading}>
                      {previewActionLoading ? "…" : "Mark as Posted"}
                    </button>
                  </>
                )}
                <button type="button" className={styles.previewCloseBtn} onClick={closePreview} aria-label="Close">×</button>
              </div>
            </div>

            {(previewPost.status === "scheduled" && (previewPost.calendarDate || previewPost.calendarTime)) && (
              <div className={styles.previewScheduledBanner}>
                Scheduled for: {formatScheduledAt(previewPost.calendarDate, previewPost.calendarTime)}
              </div>
            )}

            {showRescheduleInPreview && (
              <div className={styles.previewRescheduleBox}>
                <h3 className={styles.previewRescheduleTitle}>Scheduled Date & Time:</h3>
                <div className={styles.previewRescheduleRow}>
                  <div className={styles.formRow}>
                    <label>Date</label>
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className={styles.previewRescheduleInput}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label>Time</label>
                    <input
                      type="time"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className={styles.previewRescheduleInput}
                    />
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.previewDeleteBtn}
                    onClick={deleteFromPreview}
                    disabled={previewActionLoading}
                  >
                    {previewActionLoading ? "Deleting…" : "Delete"}
                  </button>
                  <button type="button" className={styles.cancelBtn} onClick={() => setShowRescheduleInPreview(false)}>Cancel</button>
                  <button type="button" className={styles.saveBtn} onClick={saveReschedule} disabled={previewActionLoading || !rescheduleDate}>
                    {previewActionLoading ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            )}

            <div className={styles.previewImageCard}>
              {previewPost.mediaUrls?.[0] ? (
                previewPost.mediaTypes?.[0] === "video" || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(previewPost.mediaUrls[0]) ? (
                  <video src={previewPost.mediaUrls[0]} controls className={styles.previewMedia} aria-hidden />
                ) : (
                  <img src={previewPost.mediaUrls[0]} alt="" className={styles.previewMedia} loading="lazy" decoding="async" />
                )
              ) : (
                <div className={styles.previewMediaPlaceholder}>No image</div>
              )}
            </div>
            <div className={styles.previewCaptionSection}>
              <p className={styles.previewCaptionLabel}>Caption:</p>
              <p className={styles.previewCaptionText}>{previewPost.body?.trim() || "No caption."}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function CalendarPage() {
  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Admin Schedule Only</h1>
            <p className={styles.subtitle}>
              Calendar planning is now reserved for admin use.
            </p>
          </div>
        </header>
        <div className={styles.reminderList}>
          <p>
            Open your admin scheduler at{" "}
            <Link href="/admin/schedule" style={{ color: "var(--accent)" }}>
              /admin/schedule
            </Link>
            .
          </p>
          <p>
            Return to{" "}
            <Link href="/home" style={{ color: "var(--accent)" }}>
              Home
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
