"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "../../../../lib/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { PURCHASES_COLLECTION } from "../../../../lib/purchases";
import { MEDIA_UNLOCKS_COLLECTION } from "../../../../lib/dms";
import { getChatSessionSummary } from "../../../../lib/chat-session-summaries";

type MemberProfileRow = {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  username: string | null;
  likes: string;
  whatYouWantToSee: string;
  notes: string;
  purchases: { productName: string | null; amountCents: number | null }[];
  tipsTotalCents: number;
  tipsCount: number;
  unlocksTotalCents: number;
  lastSessionSummaries: { endedAt: string; summary: string }[];
};

function norm(s: string): string {
  return (s || "").toString().trim().toLowerCase();
}

export default function AdminProfilesPage() {
  const db = getFirebaseDb();
  const { user } = useAuth();
  const adminUid = user?.uid ?? null;
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberProfileRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editLikes, setEditLikes] = useState("");
  const [editWhatYouWantToSee, setEditWhatYouWantToSee] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    getDocs(query(collection(db, "members"), limit(500)))
      .then(async (snap) => {
        const list: MemberProfileRow[] = [];
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>;
          const uid = (data.uid ?? data.userId ?? "member-" + d.id) as string;
          const email = (data.email ?? "").toString().trim().toLowerCase();
          const displayName = (
            data.displayName ??
            data.instagram_handle ??
            data.note ??
            email.split("@")[0] ??
            "—"
          ).toString();
          let bio: string | null = null;
          let avatarUrl: string | null = null;
          let username: string | null = null;
          if (uid && !uid.startsWith("member-")) {
            try {
              const userSnap = await getDoc(doc(db, "users", uid));
              if (userSnap.exists()) {
                const u = userSnap.data() as Record<string, unknown>;
                bio = (u.bio ?? "").toString().trim() || null;
                avatarUrl = (u.avatarUrl ?? u.photoURL ?? "").toString().trim() || null;
                username = (u.username ?? "").toString().trim() || null;
              }
            } catch {
              // skip
            }
          }
          const likes = (data.likes ?? "").toString().trim();
          const whatYouWantToSee = (data.whatYouWantToSee ?? "").toString().trim();
          const notes = (data.notes ?? "").toString().trim();

          let purchases: { productName: string | null; amountCents: number | null }[] = [];
          let tipsTotalCents = 0;
          let tipsCount = 0;
          let unlocksTotalCents = 0;
          if (email) {
            const [purchasesSnap, tipsSnap, mediaUnlocksSnap, postUnlocksSnap] = await Promise.all([
              getDocs(query(collection(db, PURCHASES_COLLECTION), where("email", "==", email))),
              getDocs(query(collection(db, "tips"), where("email", "==", email))),
              getDocs(query(collection(db, MEDIA_UNLOCKS_COLLECTION), where("email", "==", email))),
              getDocs(query(collection(db, "postUnlocks"), where("email", "==", email))),
            ]);
            purchasesSnap.forEach((p) => {
              const x = p.data() as Record<string, unknown>;
              purchases.push({
                productName: x.productName != null ? String(x.productName) : null,
                amountCents: typeof x.amountCents === "number" ? x.amountCents : null,
              });
            });
            tipsSnap.forEach((t) => {
              const x = t.data() as Record<string, unknown>;
              const c = typeof x.amountCents === "number" ? x.amountCents : 0;
              tipsTotalCents += c;
              if (c > 0) tipsCount++;
            });
            [mediaUnlocksSnap, postUnlocksSnap].forEach((s) =>
              s.forEach((u) => {
                const x = u.data() as Record<string, unknown>;
                unlocksTotalCents += typeof x.amountCents === "number" ? x.amountCents : 0;
              })
            );
          }

          let lastSessionSummaries: { endedAt: string; summary: string }[] = [];
          if (adminUid && uid) {
            try {
              const summaryDoc = await getChatSessionSummary(db, adminUid, uid);
              if (summaryDoc?.lastSessionSummaries?.length) {
                lastSessionSummaries = summaryDoc.lastSessionSummaries;
              }
            } catch {
              // skip
            }
          }

          list.push({
            id: d.id,
            uid,
            email,
            displayName,
            bio,
            avatarUrl,
            username,
            likes,
            whatYouWantToSee,
            notes,
            purchases,
            tipsTotalCents,
            tipsCount,
            unlocksTotalCents,
            lastSessionSummaries,
          });
        }
        list.sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
        setMembers(list);
      })
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [db, adminUid]);

  const filtered = useMemo(() => {
    const q = norm(search);
    if (!q) return members;
    return members.filter(
      (m) =>
        norm(m.displayName).includes(q) ||
        norm(m.email).includes(q) ||
        norm(m.username || "").includes(q) ||
        norm(m.bio || "").includes(q) ||
        norm(m.likes).includes(q) ||
        norm(m.notes).includes(q) ||
        norm(m.whatYouWantToSee).includes(q)
    );
  }, [members, search]);

  const selected = selectedId ? members.find((m) => m.id === selectedId) : null;

  useEffect(() => {
    if (selected) {
      setEditLikes(selected.likes);
      setEditWhatYouWantToSee(selected.whatYouWantToSee);
      setEditNotes(selected.notes);
    }
  }, [selected?.id]);

  const handleSaveProfile = () => {
    if (!db || !selectedId) return;
    setSaving(true);
    updateDoc(doc(db, "members", selectedId), {
      likes: editLikes.trim(),
      whatYouWantToSee: editWhatYouWantToSee.trim(),
      notes: editNotes.trim(),
      updatedAt: serverTimestamp(),
    })
      .then(() => {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === selectedId
              ? {
                  ...m,
                  likes: editLikes.trim(),
                  whatYouWantToSee: editWhatYouWantToSee.trim(),
                  notes: editNotes.trim(),
                }
              : m
          )
        );
      })
      .finally(() => setSaving(false));
  };

  if (!db) {
    return (
      <div className="admin-content" style={{ padding: "1.5rem" }}>
        <p className="admin-posts-message">Firebase not available.</p>
      </div>
    );
  }

  return (
    <div className="admin-content" style={{ padding: "1.5rem" }}>
      <h1 className="admin-page-title">Profiles</h1>
      <p className="admin-posts-hint" style={{ marginBottom: "1rem" }}>
        Member profiles from account signup and bio. Search by name or email. View purchases, tips, unlocks, and last 3 chat session summaries.
      </p>
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <input
          ref={searchInputRef}
          type="text"
          className="chat-session-input"
          placeholder="Search by name, email, @username, bio, notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchInputRef.current?.blur()}
          style={{ maxWidth: 320 }}
          aria-label="Search members"
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => searchInputRef.current?.focus()}
          aria-label="Search"
        >
          Search
        </button>
      </div>
      {loading ? (
        <p className="admin-posts-message" style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {filtered.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={selectedId === m.id ? "active" : ""}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "0.75rem 1rem",
                      marginBottom: "0.5rem",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: selectedId === m.id ? "var(--accent-soft)" : "var(--bg-card)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                    }}
                  >
                    {m.avatarUrl ? (
                      <img
                        src={m.avatarUrl}
                        alt=""
                        style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: "var(--accent-soft)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 600,
                          color: "var(--accent)",
                        }}
                      >
                        {(m.displayName || m.email || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{m.displayName || "—"}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{m.email || "—"}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {filtered.length === 0 && (
              <p className="admin-posts-message" style={{ color: "var(--text-muted)" }}>
                {members.length === 0
                  ? "No profiles loaded. Members will appear here once they sign up."
                  : search.trim()
                    ? `No match for "${search.trim()}". Try name, email, @username, or words from their bio/notes.`
                    : "No members match."}
              </p>
            )}
          </div>
          {selected && (
            <div
              style={{
                flex: "1 1 400px",
                minWidth: 0,
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "1.25rem",
                background: "var(--bg-card)",
              }}
            >
              <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>{selected.displayName || selected.email}</h2>
              {selected.avatarUrl && (
                <p style={{ marginBottom: "0.75rem" }}>
                  <img src={selected.avatarUrl} alt="" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover" }} />
                </p>
              )}
              {selected.bio && (
                <>
                  <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Bio</p>
                  <p style={{ margin: "0 0 1rem", whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>{selected.bio}</p>
                </>
              )}
              <div style={{ marginBottom: "1rem" }}>
                <label className="chat-session-label">Likes</label>
                <textarea
                  value={editLikes}
                  onChange={(e) => setEditLikes(e.target.value)}
                  className="chat-session-input"
                  rows={2}
                  style={{ width: "100%", resize: "vertical" }}
                  placeholder="What they like..."
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label className="chat-session-label">What you want to see</label>
                <textarea
                  value={editWhatYouWantToSee}
                  onChange={(e) => setEditWhatYouWantToSee(e.target.value)}
                  className="chat-session-input"
                  rows={2}
                  style={{ width: "100%", resize: "vertical" }}
                  placeholder="What they want to see..."
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label className="chat-session-label">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="chat-session-input"
                  rows={2}
                  style={{ width: "100%", resize: "vertical" }}
                  placeholder="Other notes..."
                />
              </div>
              <button type="button" className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving…" : "Save profile"}
              </button>
              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.25rem 0" }} />
              <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Purchases</p>
              {selected.purchases.length === 0 ? (
                <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>None</p>
              ) : (
                <ul style={{ margin: "0 0 0.75rem", paddingLeft: "1.2rem", fontSize: "0.9rem" }}>
                  {selected.purchases.map((p, i) => (
                    <li key={i}>{p.productName ?? "Item"} {p.amountCents != null && `$${(p.amountCents / 100).toFixed(2)}`}</li>
                  ))}
                </ul>
              )}
              <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Tips</p>
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
                {selected.tipsCount === 0 ? "None" : `$${(selected.tipsTotalCents / 100).toFixed(2)} (${selected.tipsCount} tip${selected.tipsCount !== 1 ? "s" : ""})`}
              </p>
              <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Unlocks (paid)</p>
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
                {selected.unlocksTotalCents === 0 ? "None" : `$${(selected.unlocksTotalCents / 100).toFixed(2)}`}
              </p>
              <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Chat session summaries (last 3)</p>
              {selected.lastSessionSummaries.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>None yet.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.9rem" }}>
                  {selected.lastSessionSummaries.map((s, i) => (
                    <li key={i} style={{ marginBottom: "0.5rem" }}>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{s.endedAt ? new Date(s.endedAt).toLocaleDateString() : ""}</span> — {s.summary || "—"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
