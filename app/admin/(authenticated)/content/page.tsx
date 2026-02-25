"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, getDoc, setDoc, getDocs, collection } from "firebase/firestore";
import { getFirebaseDb, getFirebaseStorage } from "../../../../lib/firebase";
import { listMediaLibraryAll, type MediaItem } from "../../../../lib/media-library";
import type { SiteConfigContent } from "../../../../lib/site-config";
import { SITE_CONFIG_CONTENT_ID } from "../../../../lib/site-config";
import { DEFAULT_PRIVACY_HTML, DEFAULT_TERMS_HTML } from "../../../../lib/legal-defaults";

const CONTENT_DOC_PATH = "site_config";

function todayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminContentPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSection, setSavingSection] = useState<null | "landing" | "tip">(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [content, setContent] = useState<SiteConfigContent>({
    testimonialQuote: "",
    testimonialAttribution: "",
    showMemberCount: false,
    memberCount: 0,
    tipPageHeroImageUrl: "",
    tipPageHeroTitle: "",
    tipPageHeroSubtext: "",
    privacyPolicyLastUpdated: "",
    termsLastUpdated: "",
    privacyPolicyHtml: "",
    termsHtml: "",
  });
  const [legalModal, setLegalModal] = useState<null | "privacy" | "terms">(null);
  const [legalDraft, setLegalDraft] = useState("");
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();

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
            showMemberCount: !!d.showMemberCount,
            memberCount: typeof d.memberCount === "number" ? d.memberCount : 0,
            tipPageHeroImageUrl: d.tipPageHeroImageUrl ?? "",
            tipPageHeroTitle: d.tipPageHeroTitle ?? "",
            tipPageHeroSubtext: d.tipPageHeroSubtext ?? "",
            privacyPolicyLastUpdated: d.privacyPolicyLastUpdated ?? "",
            termsLastUpdated: d.termsLastUpdated ?? "",
            privacyPolicyHtml: d.privacyPolicyHtml ?? "",
            termsHtml: d.termsHtml ?? "",
          });
        }
      })
      .catch(() => setMessage({ type: "error", text: "Could not load content." }))
      .finally(() => setLoading(false));
  }, [db]);

  const showMessage = (type: "ok" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const saveSection = async (
    section: "landing" | "tip",
    payload: Partial<SiteConfigContent>
  ) => {
    if (!db) return;
    setSavingSection(section);
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(
        doc(db, CONTENT_DOC_PATH, SITE_CONFIG_CONTENT_ID),
        { ...content, ...payload },
        { merge: true }
      );
      setContent((c) => ({ ...c, ...payload }));
      showMessage("ok", section === "landing" ? "Landing content saved." : "Tip page saved.");
    } catch {
      showMessage("error", "Failed to save.");
    } finally {
      setSaving(false);
      setSavingSection(null);
    }
  };

  const handleSaveLanding = () => {
    saveSection("landing", {
      showMemberCount: content.showMemberCount,
      memberCount: content.memberCount,
    });
  };

  const handleSaveTipPage = () => {
    saveSection("tip", {
      tipPageHeroImageUrl: content.tipPageHeroImageUrl?.trim() ?? "",
      tipPageHeroTitle: content.tipPageHeroTitle?.trim() ?? "",
      tipPageHeroSubtext: content.tipPageHeroSubtext?.trim() ?? "",
    });
  };

  const handleRefreshCount = async () => {
    if (!db) return;
    setSaving(true);
    setMessage(null);
    try {
      const snap = await getDocs(collection(db, "members"));
      const count = snap.size;
      setContent((c) => ({ ...c, memberCount: count }));
      await setDoc(
        doc(db, CONTENT_DOC_PATH, SITE_CONFIG_CONTENT_ID),
        {
          testimonialQuote: content.testimonialQuote?.trim() ?? "",
          testimonialAttribution: content.testimonialAttribution?.trim() ?? "",
          showMemberCount: content.showMemberCount,
          memberCount: count,
          tipPageHeroImageUrl: content.tipPageHeroImageUrl?.trim() ?? "",
          tipPageHeroTitle: content.tipPageHeroTitle?.trim() ?? "",
          tipPageHeroSubtext: content.tipPageHeroSubtext?.trim() ?? "",
          privacyPolicyLastUpdated: content.privacyPolicyLastUpdated?.trim() ?? "",
          termsLastUpdated: content.termsLastUpdated?.trim() ?? "",
          privacyPolicyHtml: content.privacyPolicyHtml ?? "",
          termsHtml: content.termsHtml ?? "",
        },
        { merge: true }
      );
      showMessage("ok", `Member count updated: ${count}.`);
    } catch {
      showMessage("error", "Could not refresh member count.");
    } finally {
      setSaving(false);
    }
  };

  const openLegalModal = (which: "privacy" | "terms") => {
    const html = which === "privacy"
      ? (content.privacyPolicyHtml || DEFAULT_PRIVACY_HTML)
      : (content.termsHtml || DEFAULT_TERMS_HTML);
    setLegalDraft(html);
    setLegalModal(which);
  };

  const saveLegalModal = async () => {
    if (!db || !legalModal) return;
    const today = todayYMD();
    const payload =
      legalModal === "privacy"
        ? { privacyPolicyHtml: legalDraft.trim(), privacyPolicyLastUpdated: today }
        : { termsHtml: legalDraft.trim(), termsLastUpdated: today };
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(
        doc(db, CONTENT_DOC_PATH, SITE_CONFIG_CONTENT_ID),
        {
          ...content,
          ...payload,
        },
        { merge: true }
      );
      setContent((c) => ({ ...c, ...payload }));
      setLegalModal(null);
      setLegalDraft("");
      showMessage("ok", legalModal === "privacy" ? "Privacy policy saved. Date set to today." : "Terms saved. Date set to today.");
    } catch {
      showMessage("error", "Failed to save.");
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
        Site-wide content: landing page (testimonial, member count), tip page hero, and legal “last updated” dates.
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

      <section className="content-section" aria-labelledby="content-landing-heading">
        <h2 id="content-landing-heading" className="content-section-title">Landing page</h2>

      <div className="content-block">
        <h2>Member count</h2>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.95rem", color: "var(--text-muted)" }}>
          Display &quot;Join <strong>{content.memberCount}</strong> in the circle&quot; in the CTA when enabled. Count comes from the members collection.
        </p>
        <label className="admin-content-checkbox" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <input
            type="checkbox"
            checked={content.showMemberCount}
            onChange={(e) => setContent((c) => ({ ...c, showMemberCount: e.target.checked }))}
          />
          <span>Show member count on landing page</span>
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleRefreshCount}
          disabled={saving}
          style={{ marginRight: "0.5rem" }}
        >
          Refresh count from members
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSaveLanding}
          disabled={saving}
          style={{ marginLeft: "0.25rem" }}
        >
          {savingSection === "landing" ? "Saving…" : "Save section"}
        </button>
      </div>
      </section>

      <section className="content-section" aria-labelledby="content-tip-heading">
        <h2 id="content-tip-heading" className="content-section-title">Tip page</h2>
      <div className="content-block">
        <h2>Hero image</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          Choose an image from your media library. Leave empty for gradient only.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
          {content.tipPageHeroImageUrl ? (
            <div style={{ position: "relative", flex: "0 0 auto" }}>
              <img
                src={content.tipPageHeroImageUrl}
                alt="Hero"
                style={{ maxWidth: 160, maxHeight: 100, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginLeft: "0.5rem", marginTop: "0.5rem" }}
                onClick={() => setContent((c) => ({ ...c, tipPageHeroImageUrl: "" }))}
              >
                Remove
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowMediaPicker(true)}
          >
            {content.tipPageHeroImageUrl ? "Change image" : "Add media"}
          </button>
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
        <label className="admin-content-label" style={{ display: "block", marginTop: "0.75rem", marginBottom: "0.35rem", fontWeight: 500, fontSize: "0.9rem" }}>
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
        <div className="admin-content-modal-overlay" role="dialog" aria-modal="true" aria-label="Choose hero image" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowMediaPicker(false)}>
          <div className="admin-content-modal" style={{ maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", background: "var(--bg-card)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", fontSize: "1.1rem" }}>Choose hero image</h2>
            <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
              {mediaLoading ? (
                <p style={{ color: "var(--text-muted)" }}>Loading…</p>
              ) : mediaItems.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>No images in media library. Upload images in Media first.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.75rem" }}>
                  {mediaItems.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      className="admin-content-media-pick"
                      onClick={() => {
                        setContent((c) => ({ ...c, tipPageHeroImageUrl: item.url }));
                        setShowMediaPicker(false);
                      }}
                      style={{ padding: 0, border: "2px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--bg)", cursor: "pointer" }}
                    >
                      <img src={item.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--border)" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowMediaPicker(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
