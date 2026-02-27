"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseStorage } from "../../../../lib/firebase";
import { listMediaLibraryAll, type MediaItem } from "../../../../lib/media-library";
import type { SiteConfigContent } from "../../../../lib/site-config";
import { SITE_CONFIG_CONTENT_ID } from "../../../../lib/site-config";
import { DEFAULT_PRIVACY_HTML, DEFAULT_TERMS_HTML } from "../../../../lib/legal-defaults";
import { prepareLegalHtml } from "../../../../lib/legal-display";
import { LazyMediaImage } from "../../../components/LazyMediaImage";

const CONTENT_DOC_PATH = "site_config";

/** Remove undefined values so Firestore receives only defined fields (merge-safe). */
function stripUndefined<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: T[K] } {
  const out = {} as { [K in keyof T]: T[K] };
  for (const k of Object.keys(obj) as (keyof T)[]) {
    if (obj[k] !== undefined) (out as Record<string, unknown>)[k as string] = obj[k];
  }
  return out;
}

function todayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminContentPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSection, setSavingSection] = useState<null | "landing" | "tip" | "about">(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [content, setContent] = useState<SiteConfigContent>({
    testimonialQuote: "",
    testimonialAttribution: "",
    tipPageHeroImageUrl: "",
    tipPageHeroTitle: "",
    tipPageHeroSubtext: "",
    tipPageHeroTitleColor: "",
    tipPageHeroSubtextColor: "",
    tipPageHeroTitleFontSize: undefined,
    tipPageHeroSubtextFontSize: undefined,
    privacyPolicyLastUpdated: "",
    termsLastUpdated: "",
    privacyPolicyHtml: "",
    termsHtml: "",
    showSocialInstagram: true,
    showSocialFacebook: true,
    showSocialX: true,
    showSocialTiktok: true,
    showSocialYoutube: true,
    aboutStormiJImageUrl: "",
    aboutStormiJVideoUrl: "",
    aboutStormiJText: "",
  });
  const [legalModal, setLegalModal] = useState<null | "privacy" | "terms">(null);
  const [legalDraft, setLegalDraft] = useState("");
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerFor, setMediaPickerFor] = useState<null | "tip" | "about">(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();
  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    getDoc(doc(db, CONTENT_DOC_PATH, SITE_CONFIG_CONTENT_ID))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data() as SiteConfigContent;
          setContent({
            testimonialQuote: d.testimonialQuote ?? "",
            testimonialAttribution: d.testimonialAttribution ?? "",
            tipPageHeroImageUrl: d.tipPageHeroImageUrl ?? "",
            tipPageHeroTitle: d.tipPageHeroTitle ?? "",
            tipPageHeroSubtext: d.tipPageHeroSubtext ?? "",
            tipPageHeroTitleColor: d.tipPageHeroTitleColor ?? "",
            tipPageHeroSubtextColor: d.tipPageHeroSubtextColor ?? "",
            tipPageHeroTitleFontSize: typeof d.tipPageHeroTitleFontSize === "number" ? d.tipPageHeroTitleFontSize : undefined,
            tipPageHeroSubtextFontSize: typeof d.tipPageHeroSubtextFontSize === "number" ? d.tipPageHeroSubtextFontSize : undefined,
            privacyPolicyLastUpdated: d.privacyPolicyLastUpdated ?? "",
            termsLastUpdated: d.termsLastUpdated ?? "",
            privacyPolicyHtml: d.privacyPolicyHtml ?? "",
            termsHtml: d.termsHtml ?? "",
            showSocialInstagram: d.showSocialInstagram !== false,
            showSocialFacebook: d.showSocialFacebook !== false,
            showSocialX: d.showSocialX !== false,
            showSocialTiktok: d.showSocialTiktok !== false,
            showSocialYoutube: d.showSocialYoutube !== false,
            aboutStormiJImageUrl: d.aboutStormiJImageUrl ?? "",
            aboutStormiJVideoUrl: d.aboutStormiJVideoUrl ?? "",
            aboutStormiJText: d.aboutStormiJText ?? "",
          });
        }
      })
      .catch(() => setMessage({ type: "error", text: "Could not load content." }))
      .finally(() => setLoading(false));
  }, [db]);

  const showMessage = (type: "ok" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), type === "error" ? 8000 : 3000);
  };

  const saveSection = async (
    section: "landing" | "tip" | "about",
    payload: Partial<SiteConfigContent>
  ) => {
    const dbNow = getFirebaseDb();
    if (!dbNow) {
      showMessage(
        "error",
        "Firebase not connected. In Vercel set NEXT_PUBLIC_FIREBASE_WEB_API, NEXT_PUBLIC_FIREBASE_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, and NEXT_PUBLIC_FIREBASE_APP_ID (and STORAGE_BUCKET, MESSAGING_SENDER_ID if needed), then redeploy."
      );
      return;
    }
    setSavingSection(section);
    setSaving(true);
    setMessage(null);
    try {
      const latest = contentRef.current;
      const toWrite = stripUndefined({ ...latest, ...payload } as Record<string, unknown>);
      await setDoc(
        doc(dbNow, CONTENT_DOC_PATH, SITE_CONFIG_CONTENT_ID),
        toWrite,
        { merge: true }
      );
      setContent((c) => ({ ...c, ...payload }));
      const snap = await getDoc(doc(dbNow, CONTENT_DOC_PATH, SITE_CONFIG_CONTENT_ID));
      if (snap.exists()) {
        const d = snap.data() as SiteConfigContent;
        setContent({
          testimonialQuote: d.testimonialQuote ?? "",
          testimonialAttribution: d.testimonialAttribution ?? "",
          tipPageHeroImageUrl: d.tipPageHeroImageUrl ?? "",
          tipPageHeroTitle: d.tipPageHeroTitle ?? "",
          tipPageHeroSubtext: d.tipPageHeroSubtext ?? "",
          tipPageHeroTitleColor: d.tipPageHeroTitleColor ?? "",
          tipPageHeroSubtextColor: d.tipPageHeroSubtextColor ?? "",
          tipPageHeroTitleFontSize: typeof d.tipPageHeroTitleFontSize === "number" ? d.tipPageHeroTitleFontSize : undefined,
          tipPageHeroSubtextFontSize: typeof d.tipPageHeroSubtextFontSize === "number" ? d.tipPageHeroSubtextFontSize : undefined,
          privacyPolicyLastUpdated: d.privacyPolicyLastUpdated ?? "",
          termsLastUpdated: d.termsLastUpdated ?? "",
          privacyPolicyHtml: d.privacyPolicyHtml ?? "",
          termsHtml: d.termsHtml ?? "",
          showSocialInstagram: d.showSocialInstagram !== false,
          showSocialFacebook: d.showSocialFacebook !== false,
          showSocialX: d.showSocialX !== false,
          showSocialTiktok: d.showSocialTiktok !== false,
          showSocialYoutube: d.showSocialYoutube !== false,
          aboutStormiJImageUrl: d.aboutStormiJImageUrl ?? "",
          aboutStormiJVideoUrl: d.aboutStormiJVideoUrl ?? "",
          aboutStormiJText: d.aboutStormiJText ?? "",
        });
      }
      showMessage("ok", section === "landing" ? "Landing content saved." : section === "tip" ? "Tip page saved." : "About Stormi J saved.");
    } catch (err) {
      const e = err as { message?: string; code?: string };
      const msg = e?.message ?? "Failed to save.";
      const hint =
        msg.includes("permission") || e?.code === "permission-denied"
          ? " Sign in again and retry."
          : "";
      showMessage("error", msg + hint);
      if (typeof console !== "undefined" && console.error) console.error("Content save error:", err);
    } finally {
      setSaving(false);
      setSavingSection(null);
    }
  };

  const handleSaveLanding = () => {
    const c = contentRef.current;
    saveSection("landing", {
      showSocialInstagram: c.showSocialInstagram,
      showSocialFacebook: c.showSocialFacebook,
      showSocialX: c.showSocialX,
      showSocialTiktok: c.showSocialTiktok,
      showSocialYoutube: c.showSocialYoutube,
    });
  };

  const handleSaveTipPage = () => {
    const c = contentRef.current;
    saveSection("tip", {
      tipPageHeroImageUrl: c.tipPageHeroImageUrl?.trim() ?? "",
      tipPageHeroTitle: c.tipPageHeroTitle?.trim() ?? "",
      tipPageHeroSubtext: c.tipPageHeroSubtext?.trim() ?? "",
      tipPageHeroTitleColor: c.tipPageHeroTitleColor?.trim() ?? "",
      tipPageHeroSubtextColor: c.tipPageHeroSubtextColor?.trim() ?? "",
      tipPageHeroTitleFontSize: c.tipPageHeroTitleFontSize,
      tipPageHeroSubtextFontSize: c.tipPageHeroSubtextFontSize,
    });
  };

  const handleSaveAboutStormiJ = () => {
    const c = contentRef.current;
    saveSection("about", {
      aboutStormiJImageUrl: c.aboutStormiJImageUrl?.trim() ?? "",
      aboutStormiJVideoUrl: c.aboutStormiJVideoUrl?.trim() ?? "",
      aboutStormiJText: c.aboutStormiJText?.trim() ?? "",
    });
  };

  const openLegalModal = (which: "privacy" | "terms") => {
    const html = which === "privacy"
      ? (content.privacyPolicyHtml || DEFAULT_PRIVACY_HTML)
      : (content.termsHtml || DEFAULT_TERMS_HTML);
    setLegalDraft(html);
    setLegalModal(which);
  };

  const saveLegalModal = async () => {
    if (!legalModal) return;
    const dbNow = getFirebaseDb();
    if (!dbNow) {
      showMessage("error", "Not connected. Please refresh the page.");
      return;
    }
    const today = todayYMD();
    const payload =
      legalModal === "privacy"
        ? { privacyPolicyHtml: legalDraft.trim(), privacyPolicyLastUpdated: today }
        : { termsHtml: legalDraft.trim(), termsLastUpdated: today };
    setSaving(true);
    setMessage(null);
    try {
      const latest = contentRef.current;
      await setDoc(
        doc(dbNow, CONTENT_DOC_PATH, SITE_CONFIG_CONTENT_ID),
        {
          ...latest,
          ...payload,
        },
        { merge: true }
      );
      setContent((c) => ({ ...c, ...payload }));
      setLegalModal(null);
      setLegalDraft("");
      showMessage("ok", legalModal === "privacy" ? "Privacy policy saved. Date set to today." : "Terms saved. Date set to today.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save.";
      showMessage("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const loadMedia = useCallback(async () => {
    if (!storage || !db) return;
    setMediaLoading(true);
    try {
      const configSnap = await getDoc(doc(db, "mediaLibrary", "config"));
      const folders = (configSnap.data()?.folders as { id: string; name: string }[] | undefined) || [];
      const folderIds = folders.map((f) => f.id).filter((id) => id !== "general");
      const items = await listMediaLibraryAll(storage, folderIds);
      setMediaItems(items.filter((i) => !i.isVideo));
    } catch {
      setMediaItems([]);
    } finally {
      setMediaLoading(false);
    }
  }, [storage, db]);

  useEffect(() => {
    if (showMediaPicker) loadMedia();
  }, [showMediaPicker, loadMedia]);

  if (loading) {
    return (
      <main className="admin-main" style={{ maxWidth: 640, margin: "0 auto" }}>
        <p className="intro" style={{ color: "var(--text-muted)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main className="admin-main admin-content-main" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1>Content</h1>
      <p className="intro" style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Site-wide content: landing page (testimonial, social icons), tip page hero, and legal “last updated” dates.
      </p>

      {message && (
        <p
          className={message.type === "ok" ? "admin-content-msg ok" : "admin-content-msg error"}
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            marginBottom: "1rem",
            background: message.type === "ok" ? "rgba(34, 197, 94, 0.15)" : "rgba(197, 48, 48, 0.15)",
            color: message.type === "ok" ? "#15803d" : "#c53030",
          }}
        >
          {message.text}
        </p>
      )}

      {!loading && !db && (
        <p
          className="admin-content-msg error"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: 8,
            marginBottom: "1rem",
            background: "rgba(197, 48, 48, 0.15)",
            color: "#c53030",
            fontWeight: 500,
          }}
        >
          Firebase is not connected. In Vercel set NEXT_PUBLIC_FIREBASE_WEB_API, NEXT_PUBLIC_FIREBASE_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, and NEXT_PUBLIC_FIREBASE_APP_ID, then redeploy.
        </p>
      )}

      <section className="content-section" aria-labelledby="content-landing-heading">
        <h2 id="content-landing-heading" className="content-section-title">Landing page</h2>

      <div className="content-block">
        <h2>Social icons (hero &amp; footer)</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
          Show or hide each social icon on the landing page hero and footer.
        </p>
        <div className="admin-social-toggles">
          {(
            [
              { key: "showSocialInstagram" as const, label: "Instagram" },
              { key: "showSocialFacebook" as const, label: "Facebook" },
              { key: "showSocialX" as const, label: "X" },
              { key: "showSocialTiktok" as const, label: "TikTok" },
              { key: "showSocialYoutube" as const, label: "YouTube" },
            ] as const
          ).map(({ key, label }) => {
            const on = content[key] !== false;
            return (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={on}
                title={on ? "Hide" : "Show"}
                className={`admin-social-toggle ${on ? "on" : "off"}`}
                onClick={() => setContent((c) => ({ ...c, [key]: !on }))}
              >
                <span className="admin-social-toggle-label">{label}</span>
                <span className="admin-social-toggle-dot" aria-hidden />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSaveLanding}
          disabled={saving}
          style={{ marginTop: "1rem" }}
        >
          {savingSection === "landing" ? "Saving…" : "Save section"}
        </button>
      </div>
      </section>

      <section className="content-section" aria-labelledby="content-tip-heading">
        <h2 id="content-tip-heading" className="content-section-title">Tip page</h2>
      <div className="content-block">
        <h2>Hero image</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
          Choose an image from your media library. Leave empty for gradient only.
        </p>
        <div className="admin-hero-image-block">
          {content.tipPageHeroImageUrl ? (
            <div className="admin-hero-image-preview">
              <img
                src={content.tipPageHeroImageUrl}
                alt="Current hero"
                className="admin-hero-image-img"
              />
              <div className="admin-hero-image-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { setMediaPickerFor("tip"); setShowMediaPicker(true); }}
        >
          Change image
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setContent((c) => ({ ...c, tipPageHeroImageUrl: "" }))}
        >
          Remove
        </button>
              </div>
            </div>
          ) : (
            <div className="admin-hero-image-empty">
              <p className="admin-hero-image-empty-text">No image set</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setMediaPickerFor("tip"); setShowMediaPicker(true); }}
              >
                Choose image
              </button>
            </div>
          )}
        </div>
        <label className="admin-content-label" style={{ display: "block", marginTop: "1rem", marginBottom: "0.35rem", fontWeight: 500, fontSize: "0.9rem" }}>
          Hero title (text overlay)
        </label>
        <input
          type="text"
          value={content.tipPageHeroTitle}
          onChange={(e) => setContent((c) => ({ ...c, tipPageHeroTitle: e.target.value }))}
          placeholder="e.g. Show Your Love"
          className="admin-content-input"
          style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.95rem", background: "var(--bg-card)", color: "var(--text)" }}
        />
        <div className="admin-hero-text-options">
          <label className="admin-content-label" style={{ display: "block", marginTop: "0.5rem", marginBottom: "0.25rem", fontWeight: 500, fontSize: "0.85rem" }}>
            Title color
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              type="color"
              value={content.tipPageHeroTitleColor || "#d25288"}
              onChange={(e) => setContent((c) => ({ ...c, tipPageHeroTitleColor: e.target.value }))}
              title="Title text color"
              style={{ width: 36, height: 28, padding: 2, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", background: "var(--bg)" }}
            />
          </div>
          <label className="admin-content-label" style={{ display: "block", marginTop: "0.5rem", marginBottom: "0.25rem", fontWeight: 500, fontSize: "0.85rem" }}>
            Title font size (px)
          </label>
          <input
            type="number"
            min={10}
            max={120}
            value={content.tipPageHeroTitleFontSize ?? ""}
            onChange={(e) => setContent((c) => ({ ...c, tipPageHeroTitleFontSize: e.target.value === "" ? undefined : Math.max(10, Math.min(120, Number(e.target.value))) }))}
            placeholder="e.g. 32"
            className="admin-content-input"
            style={{ width: "6rem", padding: "0.4rem 0.5rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.9rem", background: "var(--bg-card)", color: "var(--text)" }}
          />
        </div>
        <label className="admin-content-label" style={{ display: "block", marginTop: "1rem", marginBottom: "0.35rem", fontWeight: 500, fontSize: "0.9rem" }}>
          Hero subtext
        </label>
        <input
          type="text"
          value={content.tipPageHeroSubtext}
          onChange={(e) => setContent((c) => ({ ...c, tipPageHeroSubtext: e.target.value }))}
          placeholder="e.g. No minimum — send what you like."
          className="admin-content-input"
          style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.95rem", background: "var(--bg-card)", color: "var(--text)" }}
        />
        <div className="admin-hero-text-options">
          <label className="admin-content-label" style={{ display: "block", marginTop: "0.5rem", marginBottom: "0.25rem", fontWeight: 500, fontSize: "0.85rem" }}>
            Subtext color
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              type="color"
              value={content.tipPageHeroSubtextColor || "#fef0f7"}
              onChange={(e) => setContent((c) => ({ ...c, tipPageHeroSubtextColor: e.target.value }))}
              title="Subtext color"
              style={{ width: 36, height: 28, padding: 2, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", background: "var(--bg)" }}
            />
          </div>
          <label className="admin-content-label" style={{ display: "block", marginTop: "0.5rem", marginBottom: "0.25rem", fontWeight: 500, fontSize: "0.85rem" }}>
            Subtext font size (px)
          </label>
          <input
            type="number"
            min={10}
            max={72}
            value={content.tipPageHeroSubtextFontSize ?? ""}
            onChange={(e) => setContent((c) => ({ ...c, tipPageHeroSubtextFontSize: e.target.value === "" ? undefined : Math.max(10, Math.min(72, Number(e.target.value))) }))}
            placeholder="e.g. 18"
            className="admin-content-input"
            style={{ width: "6rem", padding: "0.4rem 0.5rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.9rem", background: "var(--bg-card)", color: "var(--text)" }}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSaveTipPage}
          disabled={saving}
          style={{ marginTop: "1rem" }}
        >
          {savingSection === "tip" ? "Saving…" : "Save section"}
        </button>
      </div>
      </section>

      <section className="content-section" aria-labelledby="content-about-stormi-heading">
        <h2 id="content-about-stormi-heading" className="content-section-title">About Stormi J (member profile card)</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
          Image or video and text shown when members click “About Stormi J” in the header. Video is shown first if both are set.
        </p>
        <div className="content-block">
          <h2>Image</h2>
          <div className="admin-hero-image-block">
            {content.aboutStormiJImageUrl ? (
              <div className="admin-hero-image-preview">
                <img src={content.aboutStormiJImageUrl} alt="About Stormi J" className="admin-hero-image-img" />
                <div className="admin-hero-image-actions">
                  <button type="button" className="btn btn-primary" onClick={() => { setMediaPickerFor("about"); setShowMediaPicker(true); }}>
                    Change image
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setContent((c) => ({ ...c, aboutStormiJImageUrl: "" }))}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="admin-hero-image-empty">
                <p className="admin-hero-image-empty-text">No image set</p>
                <button type="button" className="btn btn-primary" onClick={() => { setMediaPickerFor("about"); setShowMediaPicker(true); }}>
                  Choose image
                </button>
              </div>
            )}
          </div>
          <label className="admin-content-label" style={{ display: "block", marginTop: "1rem", marginBottom: "0.35rem", fontWeight: 500, fontSize: "0.9rem" }}>
            Video URL (optional)
          </label>
          <input
            type="url"
            value={content.aboutStormiJVideoUrl ?? ""}
            onChange={(e) => setContent((c) => ({ ...c, aboutStormiJVideoUrl: e.target.value }))}
            placeholder="https://…"
            className="admin-content-input"
            style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.95rem", background: "var(--bg-card)", color: "var(--text)" }}
          />
          <label className="admin-content-label" style={{ display: "block", marginTop: "1rem", marginBottom: "0.35rem", fontWeight: 500, fontSize: "0.9rem" }}>
            Bio / info text
          </label>
          <textarea
            value={content.aboutStormiJText ?? ""}
            onChange={(e) => setContent((c) => ({ ...c, aboutStormiJText: e.target.value }))}
            placeholder="A few lines about Stormi J…"
            rows={4}
            className="admin-content-input"
            style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.95rem", background: "var(--bg-card)", color: "var(--text)", resize: "vertical" }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveAboutStormiJ}
            disabled={saving}
            style={{ marginTop: "1rem" }}
          >
            {savingSection === "about" ? "Saving…" : "Save About Stormi J"}
          </button>
        </div>
      </section>

      <section className="content-section" aria-labelledby="content-legal-heading">
        <h2 id="content-legal-heading" className="content-section-title">Legal</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
          These dates appear as “Last updated: …” on the Terms and Privacy pages.
        </p>
        <div className="content-block" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={() => openLegalModal("privacy")}>
            Edit Privacy page
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => openLegalModal("terms")}>
            Edit Terms page
          </button>
        </div>
      </section>

      {legalModal && (
        <div className="admin-content-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setLegalModal(null)}>
          <div className="admin-content-modal" style={{ width: "min(92vw, 900px)", maxHeight: "95vh", display: "flex", flexDirection: "column", background: "var(--bg-card)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <h2 id="legal-modal-title" style={{ margin: 0, padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", fontSize: "1.1rem" }}>
              {legalModal === "privacy" ? "Edit Privacy Policy" : "Edit Terms of Service"}
            </h2>
            <textarea
              value={legalDraft}
              onChange={(e) => setLegalDraft(e.target.value)}
              placeholder="HTML content (e.g. <p>...</p>, <h2>...</h2>)"
              rows={22}
              className="admin-content-input"
              style={{ flex: 1, minHeight: 320, margin: "1rem 1.25rem", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.9rem", background: "var(--bg)", color: "var(--text)", resize: "vertical" }}
            />
            <div style={{ padding: "0 1.25rem 1rem" }}>
              <p style={{ margin: "0 0 0.5rem", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600 }}>
                Live preview
              </p>
              <div
                className="legal-body"
                style={{
                  maxHeight: "260px",
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.85rem",
                  background: "var(--bg)",
                }}
                dangerouslySetInnerHTML={{ __html: prepareLegalHtml(legalDraft.trim() || (legalModal === "privacy" ? DEFAULT_PRIVACY_HTML : DEFAULT_TERMS_HTML)) }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", padding: "1rem 1.25rem", borderTop: "1px solid var(--border)" }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setLegalModal(null); setLegalDraft(""); }}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={saveLegalModal} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMediaPicker && (
        <div className="admin-content-modal-overlay" role="dialog" aria-modal="true" aria-label={mediaPickerFor === "about" ? "Choose About Stormi J image" : "Choose hero image"} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }} onClick={() => { setShowMediaPicker(false); setMediaPickerFor(null); }}>
          <div className="admin-content-modal admin-media-picker-modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", fontSize: "1.1rem", flexShrink: 0 }}>{mediaPickerFor === "about" ? "Choose About Stormi J image" : "Choose hero image"}</h2>
            <div className="admin-media-picker-body">
              {mediaLoading ? (
                <div className="admin-media-picker-loading">
                  <p style={{ margin: 0, fontSize: "1rem" }}>Loading images…</p>
                </div>
              ) : mediaItems.length === 0 ? (
                <p style={{ color: "var(--text-muted)", margin: 0 }}>No images in media library. Upload images in Media first.</p>
              ) : (
                <div className="admin-media-picker-grid">
                  {mediaItems.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      className="admin-content-media-pick"
                      onClick={() => {
                        if (mediaPickerFor === "about") {
                          setContent((c) => ({ ...c, aboutStormiJImageUrl: item.url }));
                        } else {
                          setContent((c) => ({ ...c, tipPageHeroImageUrl: item.url }));
                        }
                        setShowMediaPicker(false);
                        setMediaPickerFor(null);
                      }}
                    >
                      <LazyMediaImage src={item.url} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="admin-media-picker-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowMediaPicker(false); setMediaPickerFor(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
