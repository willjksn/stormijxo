"use client";

import React, { useCallback, useState } from "react";
import { generateCaptions } from "../api/client";
import type { CaptionTone, CaptionLength } from "../types";
import { stormijxoStudioTokens } from "../theme/stormijxoStudioTokens";

const TONES: { id: CaptionTone; label: string }[] = [
  { id: "", label: "Default" },
  { id: "flirty", label: "Flirty" },
  { id: "casual", label: "Casual" },
  { id: "motivational", label: "Motivational" },
  { id: "premium", label: "Premium" },
  { id: "tease", label: "Tease" },
];

const LENGTHS: { id: CaptionLength; label: string }[] = [
  { id: "", label: "Any" },
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
];

interface CaptionComposerPanelProps {
  idToken: string;
  creatorBio: string;
  imageUrl?: string;
  onCaptionSelect?: (caption: string) => void;
  usageRemaining?: number;
}

export function CaptionComposerPanel({
  idToken,
  creatorBio,
  imageUrl = "",
  onCaptionSelect,
  usageRemaining = 100,
}: CaptionComposerPanelProps) {
  const [starterText, setStarterText] = useState("");
  const [tone, setTone] = useState<CaptionTone>("");
  const [length, setLength] = useState<CaptionLength>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captions, setCaptions] = useState<string[]>([]);

  const handleGenerate = useCallback(async () => {
    if (!idToken) return;
    setError(null);
    setCaptions([]);
    setLoading(true);
    try {
      const res = await generateCaptions(idToken, {
        imageUrl: imageUrl || undefined,
        bio: creatorBio,
        tone: tone || undefined,
        length: length || undefined,
        starterText: starterText.trim() || undefined,
        count: 3,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setCaptions(res.captions);
    } finally {
      setLoading(false);
    }
  }, [idToken, imageUrl, creatorBio, tone, length, starterText]);

  const hasInput = !!(imageUrl || creatorBio || starterText.trim());

  return (
    <div className="panel active panel-tools" style={{ background: stormijxoStudioTokens.surface, border: `1px solid ${stormijxoStudioTokens.border}`, borderRadius: 18, padding: "1.5rem", boxShadow: "0 14px 42px rgba(212, 85, 139, 0.11)" }}>
      <h2 className="admin-posts-card-heading" style={{ marginTop: 0 }}>Caption composer</h2>
      <p className="admin-posts-hint" style={{ marginBottom: "1rem" }}>
        Generate captions for your post. Use your bio and optional starter text. Remaining today: {usageRemaining}
      </p>

      <div className="admin-posts-card-section" style={{ marginBottom: "1rem" }}>
        <label className="admin-posts-overlay-label">Starter text (optional)</label>
        <textarea
          className="admin-posts-caption-input"
          value={starterText}
          onChange={(e) => setStarterText(e.target.value)}
          placeholder="e.g. Feeling cute today..."
          rows={2}
          style={{ minHeight: 60 }}
        />
      </div>

      <div className="admin-posts-overlay-row admin-posts-overlay-format" style={{ marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <label className="admin-posts-overlay-label">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as CaptionTone)}
            className="admin-posts-overlay-select"
          >
            {TONES.map((t) => (
              <option key={t.id || "default"} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="admin-posts-overlay-label">Length</label>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value as CaptionLength)}
            className="admin-posts-overlay-select"
          >
            {LENGTHS.map((l) => (
              <option key={l.id || "any"} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      {imageUrl && (
        <p className="admin-posts-hint" style={{ marginBottom: "0.75rem" }}>
          Using image for context.
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary"
        onClick={handleGenerate}
        disabled={loading || !hasInput || usageRemaining <= 0}
      >
        {loading ? "Generating…" : "✨ Generate captions"}
      </button>

      {error && (
        <p className="admin-posts-message admin-posts-message-error" style={{ marginTop: "1rem" }}>{error}</p>
      )}

      {captions.length > 0 && (
        <div className="admin-posts-card-section" style={{ marginTop: "1.5rem" }}>
          <label className="admin-posts-overlay-label">Suggestions</label>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {captions.map((cap, i) => (
              <li key={i} style={{ marginBottom: "0.5rem" }}>
                <button
                  type="button"
                  className="admin-posts-option-btn"
                  style={{ width: "100%", textAlign: "left", padding: "0.75rem" }}
                  onClick={() => onCaptionSelect?.(cap)}
                >
                  {cap}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
