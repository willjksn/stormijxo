"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const PRESET_AMOUNTS = [5, 10, 25, 50, 100, 250];

type TipModalProps = {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  /** Path to redirect to when user cancels checkout (e.g. "/home" or "/post/abc123") */
  cancelPath: string;
  customerEmail?: string | null;
  uid?: string | null;
};

export function TipModal({ isOpen, onClose, postId, cancelPath, customerEmail, uid }: TipModalProps) {
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  const parsedCustomAmount = customAmount.trim()
    ? Number.parseFloat(customAmount)
    : NaN;
  const customAmountCents = Number.isFinite(parsedCustomAmount)
    ? Math.round(parsedCustomAmount * 100)
    : 0;
  const amountCents =
    selectedPreset != null ? selectedPreset * 100 : customAmountCents;
  const isValid = amountCents >= 100 && amountCents <= 100000;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedPreset(null);
    setCustomAmount("");
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const startTipCheckout = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const path = cancelPath.startsWith("/") ? cancelPath : `/${cancelPath}`;
      const res = await fetch("/api/tip-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          postId,
          customer_email: customerEmail || undefined,
          uid: uid || undefined,
          base_url: base,
          success_url: `${base}/success?tip=1`,
          cancel_url: `${base}${path}`,
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

  if (!isOpen) return null;

  const modal = (
    <div
      className="tip-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tip-modal-title"
    >
      <div className="tip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tip-modal-header">
          <h2 id="tip-modal-title" className="tip-modal-title">
            Send a tip
          </h2>
          <button
            type="button"
            className="tip-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="tip-modal-body">
          <div className="tip-modal-presets">
            {PRESET_AMOUNTS.map((dollars) => (
              <button
                key={dollars}
                type="button"
                className={`tip-modal-preset-btn${selectedPreset === dollars ? " active" : ""}`}
                onClick={() => {
                  setSelectedPreset(dollars);
                  setCustomAmount("");
                }}
              >
                ${dollars}
              </button>
            ))}
          </div>
          <div className="tip-modal-custom">
            <label className="tip-modal-custom-label">
              Or enter custom amount ($)
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              step="0.01"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedPreset(null);
              }}
              placeholder="e.g. 15"
              className="tip-modal-custom-input"
            />
          </div>
          <button
            type="button"
            className="tip-modal-cta"
            onClick={startTipCheckout}
            disabled={!isValid || loading}
          >
            {loading
              ? "Taking you to checkout…"
              : amountCents >= 100
                ? `Tip $${(amountCents / 100).toFixed(2)}`
                : "Select an amount"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
