"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { collection, getDocs, query, where, doc, deleteDoc } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
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

const SEED_SCHEDULE_ITEMS: ScheduleItem[] = [
  { id: "seed-1", title: "Post carousel", notes: "Travel BTS set", date: "2026-02-09", time: "10:00", status: "scheduled", type: "content" },
  { id: "seed-2", title: "Reel already posted", notes: "Poolside clip", date: "2026-02-12", time: "13:30", status: "published", type: "content" },
  { id: "seed-3", title: "Draft script", notes: "Q&A concept", date: "2026-02-15", time: "15:00", status: "draft", type: "content" },
  { id: "seed-4", title: "1:1 fan meeting", notes: "Private chat session", date: "2026-02-21", time: "18:00", status: "scheduled", type: "fanMeeting" },
];

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

function CalendarPostCard({
  post,
  onDelete,
  onRefresh,
}: {
  post: CalendarPost;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const firstUrl = post.mediaUrls?.[0];
  const isVideo = post.mediaTypes?.[0] === "video" || (firstUrl && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(firstUrl));
  const captionSnippet = (post.body || "").trim().slice(0, 50) + ((post.body || "").length > 50 ? "…" : "");

  return (
    <div className={`${styles.calendarPostCard} ${statusCardClass(post.status)}`}>
      <div className={styles.calendarPostCardHeader}>
        <span className={styles.calendarPostTime}>{post.calendarTime || "—"}</span>
        <span className={styles.calendarPostStatusDot} aria-hidden />
      </div>
      <div className={styles.calendarPostPreview}>
        {firstUrl &&
          (isVideo ? (
            <video src={firstUrl} muted playsInline className={styles.calendarPostMedia} />
          ) : (
            <img src={firstUrl} alt="" className={styles.calendarPostMedia} />
          ))}
      </div>
      <p className={styles.calendarPostCaption}>{captionSnippet || "No caption"}</p>
      <div className={styles.calendarPostBrand}>
        <img src="/assets/sj-heart-avatar.png" alt="SJ" className={styles.calendarPostSJIcon} />
        <span className={styles.calendarPostLabel}>POST</span>
      </div>
      <div className={styles.calendarPostActions}>
        <Link href={`/admin/posts?edit=${post.id}`} className={styles.calendarPostBtn} aria-label="Edit post">
          Edit
        </Link>
        <button
          type="button"
          className={styles.calendarPostBtnDanger}
          onClick={() => {
            if (confirm("Delete this post?")) onDelete(post.id);
          }}
          aria-label="Delete post"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function SchedulePlanner() {
  const [month, setMonth] = useState(() => new Date());
  const [posts, setPosts] = useState<CalendarPost[]>([]);
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
          list.push({
            id: docSnap.id,
            body: (d.body as string) ?? "",
            mediaUrls: (d.mediaUrls as string[]) ?? [],
            mediaTypes: (d.mediaTypes as ("image" | "video")[]) ?? [],
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
        <div className={styles.grid}>
          {WEEKDAYS.map((day) => (
            <div key={day} className={styles.weekday}>
              {day}
            </div>
          ))}

          {monthDays.map((day) => {
            const iso = toISODate(day);
            const dayPosts = postsByDate.get(iso) || [];
            const daySchedule = scheduleByDate.get(iso) || [];
            const dayReminders = remindersByDate.get(iso) || [];
            const inMonth = day.getMonth() === month.getMonth();

            return (
              <div
                key={iso}
                className={`${styles.cell} ${inMonth ? "" : styles.cellMuted}`}
              >
                <span className={styles.dateNum}>{day.getDate()}</span>
                <div className={styles.badges}>
                  {daySchedule.map((item) => (
                    <span key={item.id} className={`${styles.badge} ${scheduleBadgeClass(item)}`}>
                      {item.title}
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
                      onDelete={deletePost}
                      onRefresh={fetchPosts}
                    />
                  ))}
                </div>
              </div>
            );
          })}
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
