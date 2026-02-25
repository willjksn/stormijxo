"use client";

import { useState } from "react";

const PRESET_AMOUNTS = [5, 10, 25, 50, 100, 250];

export default function TipPage() {
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [logoError, setLogoError] = useState(false);

  const amountCents =
    selectedPreset != null
      ? selectedPreset * 100
      : customAmount.trim()
        ? Math.round(parseFloat(customAmount) * 100)
        : 0;

  const handleTip = async () => {
    if (amountCents < 100) return;
    setLoading(true);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch("/api/tip-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          base_url: base,
          success_url: `${base}/success`,
          cancel_url: `${base}/tip`,
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
      setLoading(false);
    }
  };

  return (
    <main className="member-main tip-page">
      <section className="tip-hero">
        <div className="tip-hero-bg" />
        <div className="tip-hero-content">
          <h1 className="tip-title">Show Your Love</h1>
          <p className="tip-subhead">
            No minimum — send what you like.
          </p>
        </div>
      </section>

      <section className="tip-amounts">
        <h2 className="tip-amounts-heading">Choose an amount</h2>
        <div className="tip-presets">
          {PRESET_AMOUNTS.map((dollars) => (
            <button
              key={dollars}
              type="button"
              className={`tip-preset-btn${selectedPreset === dollars ? " active" : ""}`}
              onClick={() => {
                setSelectedPreset(dollars);
                setCustomAmount("");
              }}
            >
              ${dollars}
            </button>
          ))}
        </div>
        <div className="tip-custom">
          <label className="tip-custom-label">Or enter custom amount ($)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value);
              setSelectedPreset(null);
            }}
            placeholder="e.g. 15"
            className="tip-custom-input"
          />
        </div>
        <button
          type="button"
          className="tip-cta"
          onClick={handleTip}
          disabled={amountCents < 100 || loading}
        >
          {loading ? "Taking you to checkout…" : `Tip $${(amountCents / 100).toFixed(2)}`}
        </button>
      </section>

      <div className="tip-footer">
        <p className="tip-thanks">Thank You!</p>
        {logoError ? (
          <span className="tip-logo-fallback" aria-hidden>SJ xo</span>
        ) : (
          <img
            src="/assets/sj-heart-icon.png"
            alt="SJ xo"
            className="tip-logo"
            onError={() => setLogoError(true)}
          />
        )}
      </div>
    </main>
  );
}
