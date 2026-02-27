"use client";

import { useEffect, useState } from "react";

const PRESET_AMOUNTS = [300, 500, 1000, 2000];

export function LandingTipCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  useEffect(() => {
    const resetTipUi = () => {
      setLoading(false);
      setError("");
    };
    window.addEventListener("pageshow", resetTipUi);
    return () => window.removeEventListener("pageshow", resetTipUi);
  }, []);

  const startTip = async (amountCents: number) => {
    if (!amountCents || amountCents < 100 || amountCents > 100000 || loading) return;
    setError("");
    setLoading(true);
    try {
      const base = window.location.origin;
      const res = await fetch("/api/landing-tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          base_url: base,
          success_url: `${base}/success?tip=1`,
          cancel_url: `${base}/#pricing`,
          instagram_handle: instagramHandle.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Could not start checkout.");
    } catch {
      setError("Could not start checkout. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const onCustomTip = () => {
    const val = Number.parseFloat(customAmount || "");
    if (!Number.isFinite(val) || val < 1 || val > 1000) {
      setError("Enter an amount between $1 and $1000.");
      return;
    }
    startTip(Math.round(val * 100));
  };

  return (
    <div className="tip-section reveal visible">
      <p className="tip-heading">Want to show love?</p>
      <p className="tip-sub">One-time tip - no subscription.</p>
      <div className="tip-meta">
        <input
          type="text"
          id="tip-instagram-handle"
          className="tip-custom-input tip-handle-input"
          maxLength={64}
          placeholder="(optional) Who's showing love?"
          aria-label="Instagram handle (optional)"
          value={instagramHandle}
          onChange={(e) => setInstagramHandle(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="tip-buttons">
        {PRESET_AMOUNTS.map((amountCents) => (
          <button
            key={amountCents}
            type="button"
            className="btn btn-tip"
            onClick={() => startTip(amountCents)}
            disabled={loading}
          >
            ${amountCents / 100}
          </button>
        ))}
      </div>
      <div className="tip-custom">
        <label htmlFor="tip-custom-amount" className="tip-custom-label">Or enter an amount (USD)</label>
        <div className="tip-custom-row">
          <div className="tip-input-wrap">
            <span className="tip-custom-prefix-static" aria-hidden>$</span>
            <input
              type="number"
              id="tip-custom-amount"
              className="tip-custom-input"
              min={1}
              max={1000}
              step={1}
              placeholder="e.g. 25"
              inputMode="decimal"
              aria-label="Tip amount in dollars"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCustomTip();
                }
              }}
              disabled={loading}
            />
          </div>
          <button type="button" className="btn btn-tip btn-tip-custom" id="tip-custom-btn" onClick={onCustomTip} disabled={loading}>
            {loading ? "…" : "Tip"}
          </button>
        </div>
      </div>
      <p id="tip-error" className="tip-error" role="alert" style={{ display: error ? "block" : "none" }}>
        {error}
      </p>
    </div>
  );
}
