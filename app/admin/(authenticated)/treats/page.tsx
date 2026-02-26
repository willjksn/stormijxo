"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, doc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "../../../../lib/firebase";
import {
  TREATS_COLLECTION,
  slugForTreatName,
  type TreatDoc,
} from "../../../../lib/treats";

export default function AdminTreatsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [treats, setTreats] = useState<TreatDoc[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TreatDoc | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTreat, setNewTreat] = useState<Omit<TreatDoc, "id">>({
    name: "",
    price: 0,
    description: "",
    quantityLeft: 0,
    order: 0,
  });
  const db = getFirebaseDb();

  const loadTreats = useCallback(() => {
    if (!db) {
      setTreats([]);
      setMessage({
        type: "error",
        text: "Firebase not connected. Check Vercel public env vars and redeploy.",
      });
      setLoading(false);
      return;
    }
    getDocs(collection(db, TREATS_COLLECTION))
      .then((snap) => {
        const list: TreatDoc[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            name: (data.name ?? "").toString(),
            price: typeof data.price === "number" ? data.price : 0,
            description: (data.description ?? "").toString(),
            quantityLeft: typeof data.quantityLeft === "number" ? data.quantityLeft : 0,
            order: typeof data.order === "number" ? data.order : 0,
          });
        });
        list.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
        setTreats(list);
      })
      .catch((err) => {
        setTreats([]);
        const e = err as { message?: string; code?: string };
        const msg = e?.message ?? "Could not load treats.";
        const hint =
          msg.includes("permission") || e?.code === "permission-denied"
            ? " You are signed in but Firestore denied access. Sign out/in and recheck rules in this Firebase project."
            : "";
        setMessage({ type: "error", text: msg + hint });
      })
      .finally(() => setLoading(false));
  }, [db]);

  useEffect(() => {
    loadTreats();
  }, [loadTreats]);

  const showMsg = (type: "ok" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), type === "error" ? 8000 : 3000);
  };

  const handleStartEdit = (t: TreatDoc) => {
    setEditingId(t.id);
    setEditForm({ ...t });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;
    if (!db) {
      showMsg(
        "error",
        "Firebase not connected. In Vercel set NEXT_PUBLIC_FIREBASE_WEB_API, NEXT_PUBLIC_FIREBASE_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, and NEXT_PUBLIC_FIREBASE_APP_ID, then redeploy."
      );
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      showMsg("error", "Session expired or not signed in. Please sign in again and retry.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await auth.currentUser.getIdToken(true);
      await setDoc(doc(db, TREATS_COLLECTION, editForm.id), {
        name: editForm.name,
        price: editForm.price,
        description: editForm.description,
        quantityLeft: Math.max(0, editForm.quantityLeft),
        order: editForm.order,
      });
      setEditingId(null);
      setEditForm(null);
      await loadTreats();
      showMsg("ok", "Treat updated.");
    } catch (err) {
      const e = err as { message?: string; code?: string };
      const msg = e?.message ?? "Failed to save.";
      const hint =
        msg.includes("permission") || e?.code === "permission-denied"
          ? " Sign out, sign in again, and retry. If it persists, ensure Firestore rules are deployed for this project."
          : "";
      showMsg("error", msg + hint);
      if (typeof console !== "undefined" && console.error) console.error("Treats save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !confirm("Remove this treat? Members will no longer see it.")) return;
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      showMsg("error", "Session expired or not signed in. Please sign in again and retry.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await auth.currentUser.getIdToken(true);
      await deleteDoc(doc(db, TREATS_COLLECTION, id));
      setTreats((prev) => prev.filter((t) => t.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setEditForm(null);
      }
      showMsg("ok", "Treat removed.");
    } catch (err) {
      const e = err as { message?: string; code?: string };
      const msg = e?.message ?? "Failed to delete.";
      const hint =
        msg.includes("permission") || e?.code === "permission-denied"
          ? " You are signed in but Firestore denied access. Sign out/in and recheck rules in this Firebase project."
          : "";
      showMsg("error", msg + hint);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNew = async () => {
    if (!db || !newTreat.name.trim()) {
      showMsg("error", "Name is required.");
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      showMsg("error", "Session expired or not signed in. Please sign in again and retry.");
      return;
    }
    const id = slugForTreatName(newTreat.name.trim());
    const existing = treats.some((t) => t.id === id);
    if (existing) {
      showMsg("error", "A treat with this name already exists. Use a different name.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await auth.currentUser.getIdToken(true);
      const treat: TreatDoc = {
        id,
        name: newTreat.name.trim(),
        price: Number(newTreat.price) || 0,
        description: (newTreat.description ?? "").toString().trim(),
        quantityLeft: Math.max(0, Number(newTreat.quantityLeft) || 0),
        order: treats.length,
      };
      await setDoc(doc(db, TREATS_COLLECTION, id), treat);
      setTreats((prev) => [...prev, treat].sort((a, b) => a.order - b.order));
      setNewTreat({ name: "", price: 0, description: "", quantityLeft: 0, order: treats.length + 1 });
      setShowAddForm(false);
      showMsg("ok", "Treat added.");
    } catch (err) {
      const e = err as { message?: string; code?: string };
      const msg = e?.message ?? "Failed to add.";
      const hint =
        msg.includes("permission") || e?.code === "permission-denied"
          ? " You are signed in but Firestore denied access. Sign out/in and recheck rules in this Firebase project."
          : "";
      showMsg("error", msg + hint);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="admin-main" style={{ maxWidth: 720, margin: "0 auto" }}>
        <p className="intro" style={{ color: "var(--text-muted)" }}>
          Loading…
        </p>
      </main>
    );
  }

  return (
    <main className="admin-main admin-content-main" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1>Treats</h1>
      <p className="intro" style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Manage treat cards for the member Treats page. Set &quot;quantity left&quot; per treat; it goes down by one
        when a member buys. Sales show in the dashboard under Top purchases.
      </p>

      {message && (
        <p
          className={message.type === "ok" ? "admin-content-msg ok" : "admin-content-msg error"}
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            marginBottom: "1rem",
            background:
              message.type === "ok" ? "rgba(34, 197, 94, 0.15)" : "rgba(197, 48, 48, 0.15)",
            color: message.type === "ok" ? "#15803d" : "#c53030",
          }}
        >
          {message.text}
        </p>
      )}

      {!showAddForm && (
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginBottom: "1.5rem" }}
          onClick={() => setShowAddForm(true)}
        >
          + Add treat
        </button>
      )}

      {showAddForm && (
        <div
          className="content-block"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "1.25rem",
            marginBottom: "1.5rem",
            background: "var(--bg-card)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "1rem" }}>New treat</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label>
              <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>Name</span>
              <input
                type="text"
                value={newTreat.name}
                onChange={(e) => setNewTreat((n) => ({ ...n, name: e.target.value }))}
                placeholder="e.g. 30-Second Voice Note"
                className="admin-content-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)" }}
              />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>Price ($)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={newTreat.price || ""}
                onChange={(e) => setNewTreat((n) => ({ ...n, price: e.target.value === "" ? 0 : Number(e.target.value) }))}
                className="admin-content-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)" }}
              />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>Description</span>
              <textarea
                value={newTreat.description}
                onChange={(e) => setNewTreat((n) => ({ ...n, description: e.target.value }))}
                placeholder="Short description for the card"
                rows={2}
                className="admin-content-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)", resize: "vertical" }}
              />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>Quantity left</span>
              <input
                type="number"
                min={0}
                value={newTreat.quantityLeft ?? ""}
                onChange={(e) =>
                  setNewTreat((n) => ({ ...n, quantityLeft: e.target.value === "" ? 0 : Number(e.target.value) }))
                }
                className="admin-content-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)" }}
              />
            </label>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button type="button" className="btn btn-primary" onClick={handleAddNew} disabled={saving}>
                {saving ? "Adding…" : "Add treat"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowAddForm(false);
                  setNewTreat({ name: "", price: 0, description: "", quantityLeft: 0, order: 0 });
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="content-section" aria-labelledby="treats-list-heading">
        <h2 id="treats-list-heading" className="content-section-title">
          Treat cards
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {treats.map((t) => (
            <div
              key={t.id}
              className="content-block"
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "1rem 1.25rem",
                background: "var(--bg-card)",
              }}
            >
              {editingId === t.id && editForm ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
                    <label>
                      <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>Name</span>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => (f ? { ...f, name: e.target.value } : f))}
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                        }}
                      />
                    </label>
                    <label>
                      <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>Price ($)</span>
                      <input
                        type="number"
                        min={0}
                        value={editForm.price === 0 ? "" : editForm.price}
                        onChange={(e) =>
                          setEditForm((f) => (f ? { ...f, price: e.target.value === "" ? 0 : Number(e.target.value) } : f))
                        }
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                        }}
                      />
                    </label>
                    <label>
                      <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>Description</span>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => (f ? { ...f, description: e.target.value } : f))}
                        rows={2}
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          resize: "vertical",
                        }}
                      />
                    </label>
                    <label>
                      <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>
                        Quantity left (decremented on each purchase)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={editForm.quantityLeft === 0 ? "" : editForm.quantityLeft}
                        onChange={(e) =>
                          setEditForm((f) =>
                            f ? { ...f, quantityLeft: e.target.value === "" ? 0 : Number(e.target.value) } : f
                          )
                        }
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                        }}
                      />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem" }}>{t.name}</h3>
                      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
                        ${t.price} · <strong>{t.quantityLeft}</strong> left
                      </p>
                      <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>{t.description}</p>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                      <button type="button" className="btn btn-secondary" onClick={() => handleStartEdit(t)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ color: "var(--error, #c53030)" }}
                        onClick={() => handleDelete(t.id)}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
