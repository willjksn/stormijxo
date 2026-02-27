"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseStorage } from "../../../../lib/firebase";
import { listMediaLibraryAll, uploadToMediaLibrary, type MediaItem } from "../../../../lib/media-library";
import type { SiteConfigContent } from "../../../../lib/site-config";
import { SITE_CONFIG_CONTENT_ID } from "../../../../lib/site-config";
import { DEFAULT_PRIVACY_HTML, DEFAULT_TERMS_HTML } from "../../../../lib/legal-defaults";
import { prepareLegalHtml } from "../../../../lib/legal-display";
import { LazyMediaImage } from "../../../components/LazyMediaImage";
import { AdminEmojiPicker } from "../../components/AdminEmojiPicker";

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
    aboutStormiJVisible: true,
    aboutStormiJVideoUrl: "",
    aboutStormiJText: "",
    aboutStormiJTextColor: "#2f1a24",
    aboutStormiJTextFontSize: 16,
    aboutStormiJTextFontFamily: "DM Sans",
  });
  const [legalModal, setLegalModal] = useState<null | "privacy" | "terms">(null);
  const [legalDraft, setLegalDraft] = useState("");
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerFor, setMediaPickerFor] = useState<null | "tip" | "aboutImage" | "aboutVideo">(null);
  const [aboutUploading, setAboutUploading] = useState<"image" | "video" | null>(null);
  const [aboutUploadProgress, setAboutUploadProgress] = useState(0);
  const aboutImageInputRef = useRef<HTMLInputElement>(null);
  const aboutVideoInputRef = useRef<HTMLInputElement>(null);
  const aboutBioEmojiWrapRef = useRef<HTMLDivElement>(null);
  const aboutBioTextareaRef = useRef<HTMLTextAreaElement>(null);
  const aboutBioPickerContainerRef = useRef<HTMLDivElement | null>(null);
  const [aboutBioEmojiOpen, setAboutBioEmojiOpen] = useState(false);
  const [aboutBioEmojiQuery, setAboutBioEmojiQuery] = useState("");
  const [aboutBioPickerPosition, setAboutBioPickerPosition] = useState<{ top: number; right: number } | null>(null);
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
            aboutStormiJVisible: d.aboutStormiJVisible !== false,
            aboutStormiJVideoUrl: d.aboutStormiJVideoUrl ?? "",
            aboutStormiJText: d.aboutStormiJText ?? "",
            aboutStormiJTextColor: d.aboutStormiJTextColor ?? "#2f1a24",
            aboutStormiJTextFontSize: typeof d.aboutStormiJTextFontSize === "number" ? d.aboutStormiJTextFontSize : 16,
            aboutStormiJTextFontFamily: d.aboutStormiJTextFontFamily ?? "DM Sans",
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
          aboutStormiJVisible: d.aboutStormiJVisible !== false,
          aboutStormiJVideoUrl: d.aboutStormiJVideoUrl ?? "",
          aboutStormiJText: d.aboutStormiJText ?? "",
          aboutStormiJTextColor: d.aboutStormiJTextColor ?? "#2f1a24",
          aboutStormiJTextFontSize: typeof d.aboutStormiJTextFontSize === "number" ? d.aboutStormiJTextFontSize : 16,
          aboutStormiJTextFontFamily: d.aboutStormiJTextFontFamily ?? "DM Sans",
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
      aboutStormiJVisible: c.aboutStormiJVisible !== false,
      aboutStormiJVideoUrl: c.aboutStormiJVideoUrl?.trim() ?? "",
      aboutStormiJText: c.aboutStormiJText?.trim() ?? "",
      aboutStormiJTextColor: c.aboutStormiJTextColor?.trim() ?? "#2f1a24",
      aboutStormiJTextFontSize: c.aboutStormiJTextFontSize,
      aboutStormiJTextFontFamily: c.aboutStormiJTextFontFamily?.trim() ?? "DM Sans",
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
      const folderIds = ["general", ...folders.map((f) => f.id).filter((id) => id !== "general")];
      const items = await listMediaLibraryAll(storage, folderIds);
      setMediaItems(items);
    } catch {
      setMediaItems([]);
    } finally {
      setMediaLoading(false);
    }
  }, [storage, db]);

  useEffect(() => {
    if (showMediaPicker) loadMedia();
  }, [showMediaPicker, loadMedia]);

  useEffect(() => {
    if (!aboutBioEmojiOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (aboutBioEmojiWrapRef.current?.contains(target)) return;
      if (aboutBioPickerContainerRef.current?.contains(target)) return;
      setAboutBioEmojiOpen(false);
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [aboutBioEmojiOpen]);

  useLayoutEffect(() => {
    if (!aboutBioEmojiOpen || !aboutBioEmojiWrapRef.current) {
      setAboutBioPickerPosition(null);
      return;
    }
    const rect = aboutBioEmojiWrapRef.current.getBoundingClientRect();
    const gap = 6;
    const pickerWidth = 320;
    setAboutBioPickerPosition({
      top: rect.bottom + gap,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [aboutBioEmojiOpen]);

  const insertAboutBioEmoji = useCallback((emoji: string) => {
    const el = aboutBioTextareaRef.current;
    const current = contentRef.current.aboutStormiJText ?? "";
    if (!el) {
      setContent((c) => ({ ...c, aboutStormiJText: (c.aboutStormiJText ?? "") + emoji }));
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + emoji + current.slice(end);
    setContent((c) => ({ ...c, aboutStormiJText: next }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }, []);

  const handleAboutImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !storage) return;
      if (!file.type.startsWith("image/")) {
        showMessage("error", "Please choose an image file.");
        return;
      }
      setAboutUploading("image");
      setAboutUploadProgress(0);
      setMessage(null);
      try {
        const url = await uploadToMediaLibrary(storage, file, setAboutUploadProgress, "");
        setContent((c) => ({ ...c, aboutStormiJImageUrl: url }));
        showMessage("ok", "Image uploaded.");
      } catch (err) {
        showMessage("error", (err as Error)?.message ?? "Upload failed.");
      } finally {
        setAboutUploading(null);
      }
    },
    [storage, showMessage]
  );

  const handleAboutVideoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !storage) return;
      if (!file.type.startsWith("video/")) {
        showMessage("error", "Please choose a video file.");
        return;
      }
      setAboutUploading("video");
      setAboutUploadProgress(0);
      setMessage(null);
      try {
        const url = await uploadToMediaLibrary(storage, file, setAboutUploadProgress, "");
        setContent((c) => ({ ...c, aboutStormiJVideoUrl: url }));
        showMessage("ok", "Video uploaded.");
      } catch (err) {
        showMessage("error", (err as Error)?.message ?? "Upload failed.");
      } finally {
        setAboutUploading(null);
      }
    },
    [storage, showMessage]
  );

  if (loading) {
    return (
      <main className="admin-main" style={{ maxWidth: 920, margin: "0 auto" }}>
        <p className="intro" style={{ color: "var(--text-muted)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main className="admin-main admin-content-main" style={{ maxWidth: 920, margin: "0 auto" }}>
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
          Shown when members click “About Stormi J” in the header. Video appears first if both image and video are set.
        </p>

        <div className="admin-about-stormi-card">
          <div className="admin-about-stormi-card-head">
            <div className="admin-about-stormi-title-row">
              <img src="/assets/sj-heart-logo-transparent.png" alt="" aria-hidden className="admin-about-stormi-title-logo" />
              <h2>About Stormi J</h2>
            </div>
            <p>Image or video for the profile card. Upload from your computer or pick from the media library.</p>
          </div>

          <div className="admin-about-stormi-media-section">
            <p className="admin-about-stormi-media-label">Image</p>
            <div className="admin-about-stormi-media-row">
              <div className="admin-about-stormi-media-preview">
                {content.aboutStormiJImageUrl ? (
                  <img src={content.aboutStormiJImageUrl} alt="About Stormi J" />
                ) : (
                  <span className="admin-about-stormi-media-empty">None</span>
                )}
              </div>
              <div className="admin-about-stormi-actions">
                <input
                  ref={aboutImageInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-hidden
                  onChange={handleAboutImageUpload}
                  disabled={!!aboutUploading}
                />
                <button type="button" className="admin-about-stormi-btn primary" disabled={!!aboutUploading} onClick={() => aboutImageInputRef.current?.click()}>
                  {aboutUploading === "image" ? `${Math.round(aboutUploadProgress)}%` : "Upload"}
                </button>
                <button type="button" className="admin-about-stormi-btn" onClick={() => { setMediaPickerFor("aboutImage"); setShowMediaPicker(true); }} disabled={!!aboutUploading}>
                  Library
                </button>
                {content.aboutStormiJImageUrl && (
                  <button type="button" className="admin-about-stormi-btn danger" onClick={() => setContent((c) => ({ ...c, aboutStormiJImageUrl: "" }))}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="admin-about-stormi-media-section">
            <p className="admin-about-stormi-media-label">Video (optional)</p>
            <div className="admin-about-stormi-media-row">
              <div className="admin-about-stormi-media-preview">
                {content.aboutStormiJVideoUrl ? (
                  <video src={content.aboutStormiJVideoUrl} muted />
                ) : (
                  <span className="admin-about-stormi-media-empty">None</span>
                )}
              </div>
              <div className="admin-about-stormi-actions">
                <input
                  ref={aboutVideoInputRef}
                  type="file"
                  accept="video/*"
                  className="sr-only"
                  aria-hidden
                  onChange={handleAboutVideoUpload}
                  disabled={!!aboutUploading}
                />
                <button type="button" className="admin-about-stormi-btn primary" disabled={!!aboutUploading} onClick={() => aboutVideoInputRef.current?.click()}>
                  {aboutUploading === "video" ? `${Math.round(aboutUploadProgress)}%` : "Upload"}
                </button>
                <button type="button" className="admin-about-stormi-btn" onClick={() => { setMediaPickerFor("aboutVideo"); setShowMediaPicker(true); }} disabled={!!aboutUploading}>
                  Library
                </button>
                {content.aboutStormiJVideoUrl && (
                  <button type="button" className="admin-about-stormi-btn danger" onClick={() => setContent((c) => ({ ...c, aboutStormiJVideoUrl: "" }))}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="admin-about-stormi-text-section">
            <label htmlFor="about-stormi-j-bio">Bio / info text</label>
            <div className="admin-posts-caption-wrap" ref={aboutBioEmojiWrapRef}>
              <textarea
                ref={aboutBioTextareaRef}
                id="about-stormi-j-bio"
                value={content.aboutStormiJText ?? ""}
                onChange={(e) => setContent((c) => ({ ...c, aboutStormiJText: e.target.value }))}
                placeholder="A few lines about Stormi J…"
                rows={5}
                className="admin-posts-caption-input"
              />
              <button
                type="button"
                className="admin-posts-emoji-trigger admin-posts-emoji-trigger-inline"
                onClick={() => {
                  setAboutBioEmojiOpen((o) => !o);
                  setAboutBioEmojiQuery("");
                }}
                aria-label="Add emoji"
              >
                😀
              </button>
              {aboutBioEmojiOpen && typeof document !== "undefined" && aboutBioPickerPosition && createPortal(
                <div
                  ref={aboutBioPickerContainerRef}
                  style={{
                    position: "fixed",
                    top: aboutBioPickerPosition.top,
                    right: aboutBioPickerPosition.right,
                    left: "auto",
                    width: "min(320px, calc(100vw - 1.5rem))",
                    zIndex: 1000,
                  }}
                >
                  <AdminEmojiPicker
                    onPick={insertAboutBioEmoji}
                    onClose={() => setAboutBioEmojiOpen(false)}
                    query={aboutBioEmojiQuery}
                    setQuery={setAboutBioEmojiQuery}
                  />
                </div>,
                document.body
              )}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem", alignItems: "flex-end" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.82rem", color: "var(--text-muted)", textTransform: "none", letterSpacing: 0, margin: 0 }}>
                Text color
                <input
                  type="color"
                  value={content.aboutStormiJTextColor || "#2f1a24"}
                  onChange={(e) => setContent((c) => ({ ...c, aboutStormiJTextColor: e.target.value }))}
                  title="About text color"
                  style={{ width: 44, height: 32, padding: 2, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", background: "var(--bg)" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.82rem", color: "var(--text-muted)", textTransform: "none", letterSpacing: 0, margin: 0 }}>
                Font size (px)
                <input
                  type="number"
                  min={12}
                  max={36}
                  value={content.aboutStormiJTextFontSize ?? 16}
                  onChange={(e) => setContent((c) => ({ ...c, aboutStormiJTextFontSize: Math.max(12, Math.min(36, Number(e.target.value) || 16)) }))}
                  className="admin-content-input"
                  style={{ width: "6.5rem", padding: "0.4rem 0.5rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.9rem", background: "var(--bg-card)", color: "var(--text)" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.82rem", color: "var(--text-muted)", textTransform: "none", letterSpacing: 0, margin: 0, minWidth: 170 }}>
                Font
                <select
                  value={content.aboutStormiJTextFontFamily ?? "DM Sans"}
                  onChange={(e) => setContent((c) => ({ ...c, aboutStormiJTextFontFamily: e.target.value }))}
                  className="admin-content-input"
                  style={{ width: "100%", padding: "0.42rem 0.5rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.9rem", background: "var(--bg-card)", color: "var(--text)" }}
                >
                  <option value="DM Sans">DM Sans</option>
                  <option value="Playfair Display">Playfair Display</option>
                  <option value="Cormorant Garamond">Cormorant Garamond</option>
                  <option value="Great Vibes">Great Vibes</option>
                  <option value="Segoe UI">Segoe UI</option>
                  <option value="Arial">Arial</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Tahoma">Tahoma</option>
                  <option value="Trebuchet MS">Trebuchet MS</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                </select>
              </label>
            </div>
          </div>

          <div className="admin-about-stormi-save-wrap" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              role="switch"
              aria-checked={content.aboutStormiJVisible !== false}
              title={content.aboutStormiJVisible !== false ? "Hide About Stormi J button" : "Show About Stormi J button"}
              className={`admin-social-toggle ${content.aboutStormiJVisible !== false ? "on" : "off"}`}
              onClick={() => setContent((c) => ({ ...c, aboutStormiJVisible: !(c.aboutStormiJVisible !== false) }))}
            >
              <span className="admin-social-toggle-label">Show in member header</span>
              <span className="admin-social-toggle-dot" aria-hidden />
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveAboutStormiJ}
              disabled={saving}
            >
              {savingSection === "about" ? "Saving…" : "Save About Stormi J"}
            </button>
          </div>
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
        <div className="admin-content-modal-overlay" role="dialog" aria-modal="true" aria-label={mediaPickerFor === "aboutVideo" ? "Choose video" : "Choose image"} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }} onClick={() => { setShowMediaPicker(false); setMediaPickerFor(null); }}>
          <div className="admin-content-modal admin-media-picker-modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", fontSize: "1.1rem", flexShrink: 0 }}>
              {mediaPickerFor === "aboutVideo" ? "Choose video from library" : mediaPickerFor === "aboutImage" ? "Choose About Stormi J image" : "Choose hero image"}
            </h2>
            <div className="admin-media-picker-body">
              {mediaLoading ? (
                <div className="admin-media-picker-loading">
                  <p style={{ margin: 0, fontSize: "1rem" }}>Loading…</p>
                </div>
              ) : (() => {
                const displayItems = mediaPickerFor === "aboutVideo" ? mediaItems.filter((i) => i.isVideo) : mediaItems.filter((i) => !i.isVideo && !i.isAudio);
                return displayItems.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", margin: 0 }}>
                    {mediaPickerFor === "aboutVideo" ? "No videos in media library. Upload videos in Media first." : "No images in media library. Upload images in Media first."}
                  </p>
                ) : (
                  <div className="admin-media-picker-grid">
                    {displayItems.map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        className="admin-content-media-pick"
                        onClick={() => {
                          if (mediaPickerFor === "tip") {
                            setContent((c) => ({ ...c, tipPageHeroImageUrl: item.url }));
                          } else if (mediaPickerFor === "aboutImage") {
                            setContent((c) => ({ ...c, aboutStormiJImageUrl: item.url }));
                          } else if (mediaPickerFor === "aboutVideo") {
                            setContent((c) => ({ ...c, aboutStormiJVideoUrl: item.url }));
                          }
                          setShowMediaPicker(false);
                          setMediaPickerFor(null);
                        }}
                      >
                        {item.isVideo ? (
                          <video src={item.url} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }} muted />
                        ) : (
                          <LazyMediaImage src={item.url} alt="" loading="lazy" />
                        )}
                      </button>
                    ))}
                  </div>
                );
              })()}
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
