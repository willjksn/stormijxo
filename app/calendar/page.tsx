"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./calendar.module.css";

type ScheduleStatus = "scheduled" | "published" | "draft";
type ScheduleType = "content" | "fanMeeting";
type ReminderType = "post" | "shoot";

type ScheduleItem = {
  id: string;
  title: string;
  notes: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: ScheduleStatus;
  type: ScheduleType;
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

export function SchedulePlanner() {
  const [month, setMonth] = useState(() => new Date(2026, 1, 1));
  const [items, setItems] = useState<ScheduleItem[]>([
    {
      id: "seed-1",
      title: "Post carousel",
      notes: "Travel BTS set",
      date: "2026-02-09",
      time: "10:00",
      status: "scheduled",
      type: "content",
    },
    {
      id: "seed-2",
      title: "Reel already posted",
      notes: "Poolside clip",
      date: "2026-02-12",
      time: "13:30",
      status: "published",
      type: "content",
    },
    {
      id: "seed-3",
      title: "Draft script",
      notes: "Q&A concept",
      date: "2026-02-15",
      time: "15:00",
      status: "draft",
      type: "content",
    },
    {
      id: "seed-4",
      title: "1:1 fan meeting",
      notes: "Private chat session",
      date: "2026-02-21",
      time: "18:00",
      status: "scheduled",
      type: "fanMeeting",
    },
  ]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);

  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);

  const [scheduleForm, setScheduleForm] = useState({
    title: "",
    notes: "",
    date: "",
    time: "",
    status: "scheduled" as ScheduleStatus,
    type: "content" as ScheduleType,
  });

  const [reminderForm, setReminderForm] = useState({
    reminderType: "post" as ReminderType,
    title: "",
    description: "",
    date: "",
    time: "",
  });

  const monthDays = useMemo(() => buildMonthGrid(month), [month]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      const arr = map.get(item.date) || [];
      arr.push(item);
      map.set(item.date, arr);
    }
    return map;
  }, [items]);

  function goToPrevMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  function openDateModal(date: Date) {
    const iso = toISODate(date);
    setActiveDate(iso);
    setScheduleForm((prev) => ({ ...prev, date: iso }));
  }

  function closeDateModal() {
    setActiveDate(null);
    setScheduleForm({
      title: "",
      notes: "",
      date: "",
      time: "",
      status: "scheduled",
      type: "content",
    });
  }

  function saveScheduleItem() {
    if (!scheduleForm.title || !scheduleForm.date) return;
    const newItem: ScheduleItem = {
      id: crypto.randomUUID(),
      title: scheduleForm.title.trim(),
      notes: scheduleForm.notes.trim(),
      date: scheduleForm.date,
      time: scheduleForm.time,
      status: scheduleForm.status,
      type: scheduleForm.type,
    };
    setItems((prev) => [...prev, newItem]);
    closeDateModal();
  }

  function openReminderModal() {
    setShowReminderModal(true);
  }

  function closeReminderModal() {
    setShowReminderModal(false);
    setReminderForm({
      reminderType: "post",
      title: "",
      description: "",
      date: "",
      time: "",
    });
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

  function badgeClass(item: ScheduleItem): string {
    if (item.type === "fanMeeting" && item.status === "scheduled") return styles.badgePink;
    if (item.status === "published") return styles.badgeGreen;
    if (item.status === "draft") return styles.badgeGray;
    return styles.badgeBlue;
  }

  const activeDateItems = activeDate ? itemsByDate.get(activeDate) || [] : [];

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

        <div className={styles.grid}>
          {WEEKDAYS.map((day) => (
            <div key={day} className={styles.weekday}>
              {day}
            </div>
          ))}

          {monthDays.map((day) => {
            const iso = toISODate(day);
            const dayItems = itemsByDate.get(iso) || [];
            const inMonth = day.getMonth() === month.getMonth();

            return (
              <button
                key={iso}
                type="button"
                className={`${styles.cell} ${inMonth ? "" : styles.cellMuted}`}
                onClick={() => openDateModal(day)}
              >
                <span className={styles.dateNum}>{day.getDate()}</span>
                <div className={styles.badges}>
                  {dayItems.slice(0, 2).map((item) => (
                    <span key={item.id} className={`${styles.badge} ${badgeClass(item)}`}>
                      {item.title}
                    </span>
                  ))}
                  {dayItems.length > 2 && (
                    <span className={styles.moreBadge}>+{dayItems.length - 2} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {reminders.length > 0 && (
          <section className={styles.reminderList}>
            <h3>Upcoming reminders</h3>
            {reminders.slice(-4).map((r) => (
              <p key={r.id}>
                <strong>{r.reminderType === "post" ? "Post reminder" : "Shoot reminder"}:</strong>{" "}
                {r.title} - {r.date} {r.time || ""}
              </p>
            ))}
          </section>
        )}
      </section>

      {activeDate && (
        <div className={styles.overlay} onClick={closeDateModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Schedule Item</h3>
              <button type="button" onClick={closeDateModal}>
                ×
              </button>
            </div>

            <div className={styles.formRow}>
              <label>Type</label>
              <div className={styles.typeRow}>
                <button
                  type="button"
                  className={scheduleForm.type === "content" ? styles.typeActive : styles.typeBtn}
                  onClick={() => setScheduleForm((p) => ({ ...p, type: "content" }))}
                >
                  Content
                </button>
                <button
                  type="button"
                  className={scheduleForm.type === "fanMeeting" ? styles.typeActive : styles.typeBtn}
                  onClick={() => setScheduleForm((p) => ({ ...p, type: "fanMeeting" }))}
                >
                  1:1 Fan Meeting
                </button>
              </div>
            </div>

            <div className={styles.formRow}>
              <label>Title</label>
              <input
                value={scheduleForm.title}
                onChange={(e) => setScheduleForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. New feed post or fan session"
              />
            </div>

            <div className={styles.formRow}>
              <label>Description / Content</label>
              <textarea
                value={scheduleForm.notes}
                onChange={(e) => setScheduleForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Additional notes..."
              />
            </div>

            <div className={styles.formRowGrid}>
              <div className={styles.formRow}>
                <label>Date</label>
                <input
                  type="date"
                  value={scheduleForm.date}
                  onChange={(e) => setScheduleForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className={styles.formRow}>
                <label>Time</label>
                <input
                  type="time"
                  value={scheduleForm.time}
                  onChange={(e) => setScheduleForm((p) => ({ ...p, time: e.target.value }))}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <label>Status</label>
              <select
                value={scheduleForm.status}
                onChange={(e) =>
                  setScheduleForm((p) => ({ ...p, status: e.target.value as ScheduleStatus }))
                }
              >
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            {activeDateItems.length > 0 && (
              <div className={styles.currentItems}>
                <h4>Items on {activeDate}</h4>
                {activeDateItems.map((item) => (
                  <p key={item.id}>
                    <span className={`${styles.badge} ${badgeClass(item)}`}>{item.status}</span>{" "}
                    {item.title}
                  </p>
                ))}
              </div>
            )}

            <div className={styles.modalActions}>
              <button type="button" onClick={closeDateModal} className={styles.cancelBtn}>
                Cancel
              </button>
              <button type="button" onClick={saveScheduleItem} className={styles.saveBtn}>
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {showReminderModal && (
        <div className={styles.overlay} onClick={closeReminderModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Create Reminder</h3>
              <button type="button" onClick={closeReminderModal}>
                ×
              </button>
            </div>

            <div className={styles.formRow}>
              <label>Reminder Type *</label>
              <div className={styles.typeRow}>
                <button
                  type="button"
                  className={reminderForm.reminderType === "post" ? styles.typeActive : styles.typeBtn}
                  onClick={() => setReminderForm((p) => ({ ...p, reminderType: "post" }))}
                >
                  Post Reminder
                </button>
                <button
                  type="button"
                  className={reminderForm.reminderType === "shoot" ? styles.typeActive : styles.typeBtn}
                  onClick={() => setReminderForm((p) => ({ ...p, reminderType: "shoot" }))}
                >
                  Shoot Reminder
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
              <label>Description / Content</label>
              <textarea
                value={reminderForm.description}
                onChange={(e) => setReminderForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Additional notes or content details..."
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
              <label>Reminder Time</label>
              <input
                type="time"
                value={reminderForm.time}
                onChange={(e) => setReminderForm((p) => ({ ...p, time: e.target.value }))}
              />
              <small>When you want to be reminded (e.g., 8:00 PM).</small>
            </div>

            <div className={styles.modalActions}>
              <button type="button" onClick={closeReminderModal} className={styles.cancelBtn}>
                Cancel
              </button>
              <button type="button" onClick={saveReminder} className={styles.saveBtn}>
                Save Reminder
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
            <Link href="/admin/schedule" style={{ color: "#8fc1ff" }}>
              /admin/schedule
            </Link>
            .
          </p>
          <p>
            Return to{" "}
            <Link href="/home" style={{ color: "#8fc1ff" }}>
              Home
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
