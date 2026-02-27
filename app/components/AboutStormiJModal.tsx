"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
import { SITE_CONFIG_CONTENT_ID } from "../../lib/site-config";
import type { SiteConfigContent } from "../../lib/site-config";

const CONTENT_DOC_PATH = "site_config";

type AboutStormiJModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AboutStormiJModal({ open, onClose }: AboutStormiJModalProps) {
  const [data, setData] = useState<{
    imageUrl: string | null;
    videoUrl: string | null;
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getFirebaseDb();

  useEffect(() => {
    if (!open || !db) {
      if (!open) setData(null);
      setLoading(!open);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    getDoc(doc(db, CONTENT_DOC_PATH, SITE_CONFIG_CONTENT_ID))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data() as SiteConfigContent;
          setData({
            imageUrl: d.aboutStormiJImageUrl?.trim() || null,
            videoUrl: d.aboutStormiJVideoUrl?.trim() || null,
            text: d.aboutStormiJText?.trim() || "",
          });
        } else {
          setData({ imageUrl: null, videoUrl: null, text: "" });
        }
      })
      .catch(() => setError("Could not load."))
      .finally(() => setLoading(false));
  }, [open, db]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-stormi-j-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="about-stormi-j-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          maxWidth: 420,
          width: "100%",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h2 id="about-stormi-j-title" style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600, color: "var(--text)" }}>
            About Stormi J
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 4,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "1rem 1.25rem" }}>
          {loading && (
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.95rem" }}>Loading…</p>
          )}
          {error && (
            <p style={{ margin: 0, color: "var(--error, #c53030)", fontSize: "0.95rem" }}>{error}</p>
          )}
          {!loading && !error && data && (
            <>
              {(data.videoUrl || data.imageUrl) && (
                <div style={{ marginBottom: "1rem", borderRadius: 8, overflow: "hidden", background: "var(--bg)" }}>
                  {data.videoUrl ? (
                    <video
                      src={data.videoUrl}
                      controls
                      controlsList="nodownload noplaybackrate noremoteplayback"
                      disablePictureInPicture
                      style={{ width: "100%", display: "block", maxHeight: 240, objectFit: "contain" }}
                      onContextMenu={(e) => e.preventDefault()}
                    />
                  ) : data.imageUrl ? (
                    <img
                      src={data.imageUrl}
                      alt="Stormi J"
                      style={{ width: "100%", display: "block", maxHeight: 320, objectFit: "contain" }}
                      onContextMenu={(e) => e.preventDefault()}
                      draggable={false}
                    />
                  ) : null}
                </div>
              )}
              {data.text ? (
                <div
                  className="about-stormi-j-text"
                  style={{ fontSize: "0.95rem", lineHeight: 1.5, color: "var(--text)", whiteSpace: "pre-wrap" }}
                >
                  {data.text}
                </div>
              ) : (
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>No info yet.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
