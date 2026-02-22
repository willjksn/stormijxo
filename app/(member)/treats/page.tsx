"use client";

import { useState } from "react";
import { TREATS } from "./treats-data";

export default function TreatsPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handlePurchase = async (treatId: string) => {
    const treat = TREATS.find((t) => t.id === treatId);
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

  return (
    <main className="member-main treats-main">
      <section className="treats-store-header">
        <h1 className="treats-title">Treats</h1>
        <p className="treats-subhead">Personal messages, voice notes, and more — just for you.</p>
      </section>

      <div className="treats-grid">
        {TREATS.map((treat) => (
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
        ))}
      </div>
    </main>
  );
}
