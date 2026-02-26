"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  doc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "../../../../lib/firebase";
import { ALLOWED_ADMIN_EMAILS } from "../../../../lib/auth-redirect";

type SpendEntry = { monthlyCents: number; storeItems: string[] };
type TipperEntry = {
  email: string;
  name: string;
  tipCount: number;
  totalCents: number;
  lastTippedAt: Date | null;
};

type UserRow = {
  id: string;
  type: "admin" | "member";
  email: string;
  name: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  signupDate: Date | null;
  status: string;
  accessEndsAt: Date | null;
  monthlySpendCents: number;
  storeItems: string[];
  authOnly?: boolean;
};

type TipperRow = {
  id: string;
  type: "tipper";
  email: string;
  name: string;
  signupDate: Date | null;
  monthlySpendCents: number;
  storeItems: string[];
};

function norm(email: string): string {
  return (email || "").toString().trim().toLowerCase();
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
}

function formatMonthYear(): string {
  return new Date().toLocaleString(undefined, { month: "long", year: "numeric" });
}

function remainingAccessText(accessEndsAt: Date | null, status: string): string {
  if (status !== "cancelled" || !accessEndsAt) return "—";
  const now = new Date();
  const end = accessEndsAt instanceof Date ? accessEndsAt : new Date(accessEndsAt);
  if (end <= now) return "Expired";
  const days = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 1) return "1 day left";
  if (days < 30) return `${days} days left`;
  return "Until " + end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminUsersPage() {
  const db = getFirebaseDb();
  const [loading, setLoading] = useState(true);
  const [adminUsers, setAdminUsers] = useState<UserRow[]>([]);
  const [members, setMembers] = useState<UserRow[]>([]);
  const [spendByEmail, setSpendByEmail] = useState<Record<string, SpendEntry>>({});
  const [tipperByEmail, setTipperByEmail] = useState<Record<string, TipperEntry>>({});
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEmail, setModalEmail] = useState("");
  const [modalDisplayName, setModalDisplayName] = useState("");
  const [modalStatus, setModalStatus] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    // Ensure will_jackson and stormijxo exist in admin_users (match original admin)
    const ensureDefaultAdmins = async () => {
      const snap = await getDocs(collection(db, "admin_users"));
      const existing = new Set<string>();
      snap.forEach((d) => {
        const email = (d.data().email ?? "").toString().trim().toLowerCase();
        if (email) existing.add(email);
      });
      const toAdd = ALLOWED_ADMIN_EMAILS.filter((e) => !existing.has(e.trim().toLowerCase()));
      if (toAdd.length === 0) return;
      const batch = writeBatch(db);
      toAdd.forEach((email) => {
        const ref = doc(collection(db, "admin_users"));
        batch.set(ref, {
          email,
          role: "admin",
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
    };
    ensureDefaultAdmins().catch((err) => console.warn("Ensure default admins:", err));

    const unsubAdmin = onSnapshot(collection(db, "admin_users"), (adminSnap) => {
      const list: UserRow[] = [];
      adminSnap.forEach((doc) => {
        const d = doc.data();
        const email = (d.email ?? "").toString().trim();
        if (!email) return;
        const created = (d.createdAt as { toDate?: () => Date })?.toDate?.();
        list.push({
          id: doc.id,
          type: "admin",
          email,
          name: (d.email ?? "").toString().split("@")[0] ?? "—",
          avatarUrl: null,
          isAdmin: true,
          signupDate: created ?? null,
          status: "active",
          accessEndsAt: null,
          monthlySpendCents: 0,
          storeItems: [],
        });
      });
      ALLOWED_ADMIN_EMAILS.forEach((email) => {
        const n = email.trim().toLowerCase();
        if (list.some((u) => u.email.toLowerCase() === n)) return;
        list.push({
          id: "allowlist-" + n.replace(/[@.]/g, "-"),
          type: "admin",
          email,
          name: email.split("@")[0] ?? "—",
          avatarUrl: null,
          isAdmin: true,
          signupDate: null,
          status: "active",
          accessEndsAt: null,
          monthlySpendCents: 0,
          storeItems: [],
          authOnly: true,
        });
      });
      setAdminUsers(list);
    });
    const unsubMembers = onSnapshot(
      query(collection(db, "members"), orderBy("joinedAt", "desc")),
      (memberSnap) => {
        const list: UserRow[] = [];
        memberSnap.forEach((doc) => {
          const d = doc.data();
          const email = (d.email ?? "").toString().trim();
          const name = (
            d.displayName ||
            d.instagram_handle ||
            d.note ||
            email.split("@")[0] ||
            "—"
          )
            .toString()
            .trim();
          const joined = (d.joinedAt as { toDate?: () => Date })?.toDate?.();
          const accessEndsAt = (d.access_ends_at as { toDate?: () => Date })?.toDate?.() ?? null;
          list.push({
            id: doc.id,
            type: "member",
            email,
            name,
            avatarUrl: (d.avatarUrl || d.photoURL) ?? null,
            isAdmin: false,
            signupDate: joined ?? null,
            status: (d.status as string) || "active",
            accessEndsAt,
            monthlySpendCents: 0,
            storeItems: [],
          });
        });
        setMembers(list);
      }
    );
    return () => {
      unsubAdmin();
      unsubMembers();
    };
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    Promise.all([
      getDocs(collection(db, "tips")).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, "purchases")).catch(() => ({ forEach: () => {} })),
    ]).then(([tipsSnap, purchasesSnap]) => {
      const spend: Record<string, SpendEntry> = {};
      const tippers: Record<string, TipperEntry> = {};
      (tipsSnap as { forEach: (fn: (d: { data: () => unknown; id: string }) => void) => void }).forEach(
        (doc: { data: () => unknown; id: string }) => {
          const d = doc.data() as Record<string, unknown>;
          const email = norm((d.email as string) ?? "");
          if (!email) return;
          if (!spend[email]) spend[email] = { monthlyCents: 0, storeItems: [] };
          const cents = (typeof d.amountCents === "number" ? d.amountCents : 0) as number;
          const tippedAt = (d.tippedAt as { toDate?: () => Date })?.toDate?.() ?? null;
          if (tippedAt && tippedAt >= monthStart) spend[email].monthlyCents += cents;
          if (!tippers[email]) {
            tippers[email] = {
              email: (d.email as string) || email,
              name: ((d.instagram_handle as string) || d.email || email).toString().trim(),
              tipCount: 0,
              totalCents: 0,
              lastTippedAt: null,
            };
          }
          tippers[email].tipCount += 1;
          tippers[email].totalCents += cents > 0 ? cents : 0;
          if (d.instagram_handle) tippers[email].name = String(d.instagram_handle).trim();
          if (tippedAt && (!tippers[email].lastTippedAt || tippedAt > tippers[email].lastTippedAt!))
            tippers[email].lastTippedAt = tippedAt;
        }
      );
      (purchasesSnap as { forEach: (fn: (d: { data: () => unknown }) => void) => void }).forEach(
        (doc: { data: () => unknown }) => {
          const d = doc.data() as Record<string, unknown>;
          const email = norm(
            ((d.email as string) || (d.memberEmail as string) || (d.userEmail as string)) ?? ""
          );
          if (!email) return;
          if (!spend[email]) spend[email] = { monthlyCents: 0, storeItems: [] };
          const cents =
            (typeof d.amountCents === "number"
              ? d.amountCents
              : typeof d.amount === "number"
                ? Math.round((d.amount as number) * 100)
                : 0) as number;
          const createdAt =
            (d.createdAt as { toDate?: () => Date })?.toDate?.() ??
            (d.purchasedAt as { toDate?: () => Date })?.toDate?.() ??
            null;
          if (createdAt && createdAt >= monthStart) spend[email].monthlyCents += cents;
          const name = ((d.productName || d.productId || d.sku) ?? "Item").toString();
          if (name && !spend[email].storeItems.includes(name)) spend[email].storeItems.push(name);
        }
      );
      setSpendByEmail(spend);
      setTipperByEmail(tippers);
      setLoading(false);
    });
  }, [db]);

  const merged = useMemo(() => {
    const byEmail = new Map<string, UserRow>();
    const adminEmails = new Set(adminUsers.map((a) => norm(a.email)));
    members.forEach((m) => {
      const email = norm(m.email);
      const spend = spendByEmail[email] ?? { monthlyCents: 0, storeItems: [] };
      byEmail.set(email, {
        ...m,
        isAdmin: adminEmails.has(email),
        monthlySpendCents: spend.monthlyCents,
        storeItems: spend.storeItems,
      });
    });
    adminUsers.forEach((a) => {
      const email = norm(a.email);
      if (byEmail.has(email)) return;
      const spend = spendByEmail[email] ?? { monthlyCents: 0, storeItems: [] };
      byEmail.set(email, {
        ...a,
        monthlySpendCents: spend.monthlyCents,
        storeItems: spend.storeItems,
      });
    });
    // Always ensure allowlist admins appear (will_jackson, stormijxo)
    ALLOWED_ADMIN_EMAILS.forEach((emailStr) => {
      const email = norm(emailStr);
      if (!email || byEmail.has(email)) return;
      byEmail.set(email, {
        id: "allowlist-" + email.replace(/[@.]/g, "-"),
        type: "admin",
        email: emailStr,
        name: emailStr.split("@")[0] ?? "—",
        avatarUrl: null,
        isAdmin: true,
        signupDate: null,
        status: "active",
        accessEndsAt: null,
        monthlySpendCents: spendByEmail[email]?.monthlyCents ?? 0,
        storeItems: spendByEmail[email]?.storeItems ?? [],
        authOnly: true,
      });
    });
    return Array.from(byEmail.values()).sort((a, b) =>
      a.isAdmin !== b.isAdmin ? (a.isAdmin ? -1 : 1) : 0
    );
  }, [adminUsers, members, spendByEmail]);

  const tippers = useMemo(() => {
    const existing = new Set(merged.map((u) => norm(u.email)));
    const list: TipperRow[] = [];
    Object.keys(tipperByEmail).forEach((email) => {
      if (!email || existing.has(email)) return;
      const t = tipperByEmail[email]!;
      const spend = spendByEmail[email] ?? { monthlyCents: 0, storeItems: [] };
      const tipSummary = `Tips: ${t.tipCount} ($${(t.totalCents / 100).toFixed(2)})`;
      list.push({
        id: "tipper-" + email.replace(/[^a-z0-9]/gi, "-"),
        type: "tipper",
        email: t.email || email,
        name: (t.name || email.split("@")[0] || "—").toString().trim(),
        signupDate: t.lastTippedAt,
        monthlySpendCents: spend.monthlyCents,
        storeItems: [tipSummary],
      });
    });
    list.sort((a, b) => {
      if (!a.signupDate && !b.signupDate) return 0;
      if (!a.signupDate) return 1;
      if (!b.signupDate) return -1;
      return b.signupDate.getTime() - a.signupDate.getTime();
    });
    return list;
  }, [merged, tipperByEmail, spendByEmail]);

  const totalMonthlyCents = useMemo(
    () => merged.reduce((sum, u) => sum + (u.monthlySpendCents || 0), 0),
    [merged]
  );

  const searchQ = search.trim().toLowerCase();
  const filteredMerged = searchQ
    ? merged.filter(
        (u) =>
          u.email.toLowerCase().includes(searchQ) || u.name.toLowerCase().includes(searchQ)
      )
    : merged;
  const filteredTippers = searchQ
    ? tippers.filter(
        (t) =>
          t.email.toLowerCase().includes(searchQ) || t.name.toLowerCase().includes(searchQ)
      )
    : tippers;

  const admins = filteredMerged.filter((u) => u.isAdmin);
  const membersList = filteredMerged.filter((u) => !u.isAdmin);
  const showTable = merged.length > 0 || tippers.length > 0;
  const showEmpty =
    !loading && filteredMerged.length === 0 && filteredTippers.length === 0 && (merged.length > 0 || tippers.length > 0);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = modalEmail.trim();
    if (!email) {
      setModalStatus("Email is required.");
      return;
    }
    if (!db) return;
    setModalSubmitting(true);
    setModalStatus("Creating…");
    try {
      await addDoc(collection(db, "members"), {
        email,
        displayName: modalDisplayName.trim() || null,
        note: modalDisplayName.trim() || null,
        instagram_handle: null,
        status: "active",
        joinedAt: serverTimestamp(),
      });
      setModalStatus("User created successfully.");
      setModalEmail("");
      setModalDisplayName("");
      setTimeout(() => {
        setModalOpen(false);
        setModalStatus("");
      }, 1500);
    } catch (err) {
      setModalStatus("Could not create user: " + (err as Error).message);
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleDelete = (id: string, type: string) => {
    if (id.startsWith("allowlist-") || id.startsWith("auth-")) {
      alert("This admin is managed in Firebase Authentication. Remove them there if needed.");
      return;
    }
    if (!confirm("Remove this user? This cannot be undone.")) return;
    if (!db) return;
    if (type === "admin")
      deleteDoc(doc(db, "admin_users", id)).catch((err: Error) => alert("Could not remove: " + (err?.message ?? "unknown")));
    else
      deleteDoc(doc(db, "members", id)).catch((err: Error) => alert("Could not remove: " + (err?.message ?? "unknown")));
  };

  return (
    <>
      <main className="admin-main">
        <div className="admin-content">
          <div className="um-card">
            <div className="um-header">
              <h1>User Management</h1>
              <div className="um-toolbar">
                <button type="button" className="um-btn-add" onClick={() => setModalOpen(true)}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  Add User
                </button>
                <div className="um-search-wrap">
                  <span className="um-search-icon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  </span>
                  <input
                    type="search"
                    className="um-search"
                    placeholder="Search by name or email…"
                    aria-label="Search users"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
            {loading && <div id="users-loading" className="loading">Loading…</div>}
            {!loading && !showTable && (
              <div className="um-section-empty">No users yet. Use Add User to add an admin or member.</div>
            )}
            {showEmpty && (
              <div className="um-section-empty">
                {search ? "No users or tippers match your search." : "No users yet. Use Add User to add an admin or member."}
              </div>
            )}
            {!loading && showTable && !showEmpty && (
              <div className="um-table-wrap">
                <table className="um-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Plan</th>
                      <th>Signup Date</th>
                      <th>Remaining access</th>
                      <th>Monthly Spend</th>
                      <th>Store purchases</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Monthly Totals row */}
                    <tr className="um-totals-row">
                      <td>
                        <div className="um-user-cell">
                          <div className="um-totals-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                          </div>
                          <span>Monthly Totals</span>
                        </div>
                      </td>
                      <td>—</td>
                      <td>{formatMonthYear()}</td>
                      <td>—</td>
                      <td>
                        <span className="um-spend">
                          {totalMonthlyCents > 0 ? "$" + (totalMonthlyCents / 100).toFixed(2) : "—"}
                        </span>
                      </td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                    {/* Admin rows */}
                    {admins.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="um-user-cell">
                            <div className="um-avatar">
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} alt="" />
                              ) : (
                                (u.name?.charAt(0) ?? u.email?.charAt(0) ?? "?").toUpperCase()
                              )}
                            </div>
                            <div className="um-user-info">
                              <span className="um-user-name-line">
                                <span className="um-user-name">{u.name}</span>
                                <span className="um-badge um-badge-admin">ADMIN</span>
                              </span>
                              <span className="um-user-email">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>—</td>
                        <td>{formatDate(u.signupDate)}</td>
                        <td><span className="um-remaining">{remainingAccessText(u.accessEndsAt ?? null, u.status)}</span></td>
                        <td><span className="um-spend">{u.monthlySpendCents > 0 ? "$" + (u.monthlySpendCents / 100).toFixed(2) : "—"}</span></td>
                        <td>{u.storeItems?.length ? u.storeItems.join(", ") : "—"}</td>
                        <td>
                          <div className="um-actions">
                            <button type="button" className="link manage" onClick={() => alert("Manage user (placeholder)")}>Manage</button>
                            <button type="button" className="link reward" onClick={() => alert("Grant Reward (placeholder)")}>Grant Reward</button>
                            {!u.authOnly && (
                              <button type="button" className="link danger" onClick={() => handleDelete(u.id, u.type)}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {/* Members section header */}
                    {(admins.length > 0 || membersList.length > 0) && membersList.length > 0 && (
                      <tr className="um-sep-row">
                        <td colSpan={7}>Members</td>
                      </tr>
                    )}
                    {membersList.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="um-user-cell">
                            <div className="um-avatar">
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} alt="" />
                              ) : (
                                (u.name?.replace(/^@/, "").charAt(0) ?? u.email?.charAt(0) ?? "?").toUpperCase()
                              )}
                            </div>
                            <div className="um-user-info">
                              <span className="um-user-name-line">
                                <span className="um-user-name">{u.name}</span>
                              </span>
                              <span className="um-user-email">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {u.status === "cancelled" ? (
                            <span className="um-plan-cancelled">Cancelled</span>
                          ) : (
                            <span className="um-plan-active">Active</span>
                          )}
                        </td>
                        <td>{formatDate(u.signupDate)}</td>
                        <td><span className="um-remaining">{remainingAccessText(u.accessEndsAt ?? null, u.status)}</span></td>
                        <td><span className="um-spend">{u.monthlySpendCents > 0 ? "$" + (u.monthlySpendCents / 100).toFixed(2) : "—"}</span></td>
                        <td>{u.storeItems?.length ? u.storeItems.join(", ") : "—"}</td>
                        <td>
                          <div className="um-actions">
                            <button type="button" className="link manage" onClick={() => alert("Manage user (placeholder)")}>Manage</button>
                            <button type="button" className="link reward" onClick={() => alert("Grant Reward (placeholder)")}>Grant Reward</button>
                            <button type="button" className="link danger" onClick={() => handleDelete(u.id, u.type)}>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {/* Tippers section header */}
                    <tr className="um-sep-row">
                      <td colSpan={7}>Tippers</td>
                    </tr>
                    {filteredTippers.length > 0 ? (
                      filteredTippers.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <div className="um-user-cell">
                              <div className="um-avatar">
                                {(t.name?.replace(/^@/, "").charAt(0) ?? t.email?.charAt(0) ?? "?").toUpperCase()}
                              </div>
                              <div className="um-user-info">
                                <span className="um-user-name-line">
                                  <span className="um-user-name">{t.name}</span>
                                </span>
                                <span className="um-user-email">{t.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>—</td>
                          <td>{formatDate(t.signupDate)}</td>
                          <td>—</td>
                          <td><span className="um-spend">{t.monthlySpendCents > 0 ? "$" + (t.monthlySpendCents / 100).toFixed(2) : "—"}</span></td>
                          <td>{t.storeItems?.length ? t.storeItems.join(", ") : "—"}</td>
                          <td>—</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="um-empty-cell">No tippers yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className={`um-modal-overlay${modalOpen ? " open" : ""}`} role="dialog" aria-modal="true" onClick={() => !modalSubmitting && setModalOpen(false)}>
        <div className="um-modal" onClick={(e) => e.stopPropagation()}>
          <div className="um-modal-header">
            <h2>Add New User</h2>
            <p>Add a new member. Welcome email can include login instructions if you use invite links.</p>
          </div>
          <form onSubmit={handleAddUser}>
            <div className="um-modal-body">
              <div className="um-field">
                <label htmlFor="um-new-user-email">Email *</label>
                <input
                  id="um-new-user-email"
                  type="email"
                  value={modalEmail}
                  onChange={(e) => setModalEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="um-field">
                <label htmlFor="um-new-user-display-name">Display Name (optional)</label>
                <input
                  id="um-new-user-display-name"
                  type="text"
                  value={modalDisplayName}
                  onChange={(e) => setModalDisplayName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <p className={`um-modal-status${modalStatus.includes("success") ? " success" : modalStatus.includes("Could not") ? " error" : ""}`}>{modalStatus}</p>
            </div>
            <div className="um-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={modalSubmitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={modalSubmitting}>{modalSubmitting ? "Creating…" : "Create User"}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
