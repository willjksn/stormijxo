"use client";

import React, { useState } from "react";

interface StudioSettingsPanelProps {
  creatorPersona: string;
  onPersonaChange: (value: string) => void;
}

export function StudioSettingsPanel({ creatorPersona, onPersonaChange }: StudioSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="premium-studio-settings">
      <button
        type="button"
        className="admin-posts-option-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        ⚙️ Studio settings
      </button>
      {open && (
        <div className="admin-posts-card-section" style={{ marginTop: "0.75rem" }}>
          <label className="admin-posts-overlay-label">Creator persona (for AI)</label>
          <textarea
            className="admin-posts-caption-input"
            value={creatorPersona}
            onChange={(e) => onPersonaChange(e.target.value)}
            placeholder="e.g. Flirty, warm, playful. I love teasing and sweet talk."
            rows={3}
            style={{ minHeight: 80 }}
          />
        </div>
      )}
    </div>
  );
}
