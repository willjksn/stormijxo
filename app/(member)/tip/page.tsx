"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "../../../lib/firebase";
import { SITE_CONFIG_CONTENT_ID } from "../../../lib/site-config";
import { useSearchParams } from "next/navigation";

const PRESET_AMOUNTS = [5, 10, 25, 50, 100, 250];

export default function TipPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroTitle, setHeroTitle] = useState<string>("Show Your Love");
  const [heroSubtext, setHeroSubtext] = useState<string>("No minimum — send what you like.");
  const [heroTitleColor, setHeroTitleColor] = useState<string>("#d25288");
  const [heroSubtextColor, setHeroSubtextColor] = useState<string>("#fef0f7");
  const [heroTitleFontSize, setHeroTitleFontSize] = useState<number | undefined>(undefined);
  const [heroSubtextFontSize, setHeroSubtextFontSize] = useState<number | undefined>(undefined);
  const db = getFirebaseDb();
  const postId = (searchParams.get("postId") || "").trim();

  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, "site_config", SITE_CONFIG_CONTENT_ID))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data() as {
            tipPageHeroImageUrl?: string;
            tipPageHeroTitle?: string;
            tipPageHeroSubtext?: string;
            tipPageHeroTitleColor?: string;
            tipPageHeroSubtextColor?: string;
            tipPageHeroTitleFontSize?: number;
            tipPageHeroSubtextFontSize?: number;
          };
          const url = d.tipPageHeroImageUrl?.trim();
          if (url) setHeroImageUrl(url);
          if (d.tipPageHeroTitle?.trim()) setHeroTitle(d.tipPageHeroTitle.trim());
          if (d.tipPageHeroSubtext?.trim()) setHeroSubtext(d.tipPageHeroSubtext.trim());
          if (d.tipPageHeroTitleColor?.trim()) setHeroTitleColor(d.tipPageHeroTitleColor.trim());
          if (d.tipPageHeroSubtextColor?.trim()) setHeroSubtextColor(d.tipPageHeroSubtextColor.trim());
          if (typeof d.tipPageHeroTitleFontSize === "number") setHeroTitleFontSize(d.tipPageHeroTitleFontSize);
          if (typeof d.tipPageHeroSubtextFontSize === "number") setHeroSubtextFontSize(d.tipPageHeroSubtextFontSize);
        }
      })
      .catch(() => {});
  }, [db]);

  const amountCents =
    selectedPreset != null
      ? selectedPreset * 100
      : customAmount.trim()
        ? Math.round(parseFloat(customAmount) * 100)
        : 0;

  const startTipCheckout = async (cents: number) => {
    if (cents < 100) return;
    setLoading(true);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch("/api/tip-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: cents,
          postId: postId || undefined,
          base_url: base,
          success_url: `${base}/success?tip=1`,
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

  const handleTip = async () => {
    await startTipCheckout(amountCents);
  };

  return (
    <main className="member-main tip-page">
      <section className="tip-hero">
        <div className="tip-hero-bg" />
        {heroImageUrl && (
          <img
            src={heroImageUrl}
            alt=""
            className="tip-hero-image"
            aria-hidden
            fetchPriority="high"
            decoding="async"
          />
        )}
        <div className="tip-hero-content">
          <h1
            className="tip-title"
            style={{
              ...(heroTitleColor ? { color: heroTitleColor } : {}),
              ...(heroTitleFontSize != null ? { fontSize: `${heroTitleFontSize}px` } : {}),
            }}
          >
            {heroTitle}
          </h1>
          <p
            className="tip-subhead"
            style={{
              ...(heroSubtextColor ? { color: heroSubtextColor } : {}),
              ...(heroSubtextFontSize != null ? { fontSize: `${heroSubtextFontSize}px` } : {}),
            }}
          >
            {heroSubtext}
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
              onClick={async () => {
                setSelectedPreset(dollars);
                setCustomAmount("");
                await startTipCheckout(dollars * 100);
              }}
              disabled={loading}
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
