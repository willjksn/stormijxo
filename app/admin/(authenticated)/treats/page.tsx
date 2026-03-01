"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, doc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "../../../../lib/firebase";
import {
  TREATS_COLLECTION,
  DEFAULT_TREATS,
  slugForTreatName,
  type TreatDoc,
} from "../../../../lib/treats";
import { EmojiField } from "../../../components/EmojiField";

export default function AdminTreatsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [treats, setTreats] = useState<TreatDoc[]>([]);
  const [firestoreIds, setFirestoreIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TreatDoc | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTreat, setNewTreat] = useState<Omit<TreatDoc, "id">>({
    name: "",
    price: 0,
    description: "",
    quantityLeft: 0,
    order: 0,
    hidden: false,
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
        setFirestoreIds(new Set(byId.keys()));
        // Show default treats; Firestore overrides by id. Save in admin to create/update the doc for checkout.
        const merged: TreatDoc[] = DEFAULT_TREATS.map((def) => byId.get(def.id) ?? def);
        byId.forEach((t, id) => {
          if (!DEFAULT_TREATS.some((d) => d.id === id)) merged.push(t);
        });
        merged.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
        setTreats(merged);
      })
      .catch((err) => {
        setTreats(DEFAULT_TREATS);
        setFirestoreIds(new Set());
        const e = err as { message?: string; code?: string };
        const msg = e?.message ?? "Could not load treats.";
        const hint =
          msg.includes("permission") || e?.code === "permission-denied"
            ? " You are signed in but Firestore denied access. Showing default treats. Sign out/in and recheck rules in this Firebase project."
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
      await setDoc(doc(db, TREATS_COLLECTION, editForm.id), {
        name: editForm.name,
        price: editForm.price,
        description: editForm.description,
        quantityLeft: Math.max(0, editForm.quantityLeft),
        order: editForm.order,
        hidden: editForm.hidden === true,
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

  const handleToggleHidden = async (t: TreatDoc) => {
    if (!db || !firestoreIds.has(t.id)) {
      if (!firestoreIds.has(t.id)) showMsg("error", "Save this treat first to add it to the store, then you can hide it.");
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      showMsg("error", "Session expired or not signed in. Please sign in again and retry.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const nextHidden = !t.hidden;
    try {
      await setDoc(doc(db, TREATS_COLLECTION, t.id), { ...t, hidden: nextHidden }, { merge: true });
      setTreats((prev) => prev.map((x) => (x.id === t.id ? { ...x, hidden: nextHidden } : x)));
      showMsg("ok", nextHidden ? "Treat hidden from store." : "Treat visible in store.");
    } catch (err) {
      const e = err as { message?: string };
      showMsg("error", e?.message ?? "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (!firestoreIds.has(id)) {
      showMsg("error", "This treat isn’t in the store yet. Save it once to add it, then you can delete it from here.");
      return;
    }
    if (!confirm("Remove this treat? Members will no longer see it.")) return;
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      showMsg("error", "Session expired or not signed in. Please sign in again and retry.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await deleteDoc(doc(db, TREATS_COLLECTION, id));
      setFirestoreIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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
      const treat: TreatDoc = {
        id,
        name: newTreat.name.trim(),
        price: Number(newTreat.price) || 0,
        description: (newTreat.description ?? "").toString().trim(),
        quantityLeft: Math.max(0, Number(newTreat.quantityLeft) || 0),
        order: treats.length,
        hidden: newTreat.hidden === true,
      };
      await setDoc(doc(db, TREATS_COLLECTION, id), treat);
      setTreats((prev) => [...prev, treat].sort((a, b) => a.order - b.order));
      setNewTreat({ name: "", price: 0, description: "", quantityLeft: 0, order: treats.length + 1, hidden: false });
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
        Manage treat cards for the member Treats page. All six default treats appear below; <strong>save each one</strong> to add it to the store so members can purchase it. Price and quantity you set here are used by Stripe checkout. When a member completes a purchase, <strong>quantity left</strong> is decremented automatically by the Stripe webhook. Sales show in the dashboard under Top purchases.
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
              <EmojiField
                type="input"
                value={newTreat.name}
                onChange={(name) => setNewTreat((n) => ({ ...n, name }))}
                placeholder="e.g. 30-Second Voice Note"
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
              <EmojiField
                type="textarea"
                value={newTreat.description}
                onChange={(description) => setNewTreat((n) => ({ ...n, description }))}
                placeholder="Short description for the card"
                rows={2}
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
                  setNewTreat({ name: "", price: 0, description: "", quantityLeft: 0, order: 0, hidden: false });
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
                      <EmojiField
                        type="input"
                        value={editForm.name}
                        onChange={(name) => setEditForm((f) => (f ? { ...f, name } : f))}
                        style={{
                          width: "100%",
                          padding: "0.5rem 2rem 0.5rem 0.75rem",
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
                      <EmojiField
                        type="textarea"
                        value={editForm.description}
                        onChange={(description) => setEditForm((f) => (f ? { ...f, description } : f))}
                        rows={2}
                        style={{
                          width: "100%",
                          padding: "0.5rem 2rem 0.5rem 0.75rem",
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem", fontWeight: 600 }}>{t.name}</h3>
                      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
                        ${t.price} · <strong>{t.quantityLeft}</strong> left
                        {t.hidden && (
                          <span style={{ marginLeft: "0.5rem", color: "var(--accent)", fontWeight: 600 }}>(Hidden)</span>
                        )}
                        {!firestoreIds.has(t.id) && (
                          <span style={{ marginLeft: "0.5rem", fontStyle: "italic" }}>— Not in store yet (save to activate)</span>
                        )}
                      </p>
                      <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", lineHeight: 1.4 }}>{t.description || "—"}</p>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, alignItems: "flex-start" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleToggleHidden(t)}
                        disabled={saving || !firestoreIds.has(t.id)}
                        title={!firestoreIds.has(t.id) ? "Save this treat first to add it to the store." : t.hidden ? "Show in store" : "Hide from store"}
                      >
                        {t.hidden ? "Show" : "Hide"}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => handleStartEdit(t)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ color: "var(--error, #c53030)" }}
                        onClick={() => handleDelete(t.id)}
                        disabled={saving}
                        title={!firestoreIds.has(t.id) ? "Save this treat first to add it to the store, then you can delete it." : undefined}
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
