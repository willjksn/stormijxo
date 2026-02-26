"use client";

import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "../../../lib/firebase";
import { TREATS_COLLECTION, DEFAULT_TREATS, type TreatDoc } from "../../../lib/treats";

export default function TreatsPage() {
  const [treats, setTreats] = useState<TreatDoc[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const db = getFirebaseDb();

  useEffect(() => {
    if (!db) {
      setTreats(DEFAULT_TREATS);
      setListLoading(false);
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
        setTreats(list.length > 0 ? list : DEFAULT_TREATS);
      })
      .catch(() => setTreats(DEFAULT_TREATS))
      .finally(() => setListLoading(false));
  }, [db]);

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

      <div className="treats-grid">
        {treats.length === 0 ? (
          <p style={{ color: "var(--text-muted)", gridColumn: "1 / -1" }}>No treats available right now.</p>
        ) : (
          treats.map((treat) => (
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
