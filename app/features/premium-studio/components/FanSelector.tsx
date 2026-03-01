"use client";

import React from "react";
import type { FanOption } from "../types";

interface FanSelectorProps {
  fans: FanOption[];
  selectedUid: string | null;
  onSelect: (uid: string) => void;
  loading?: boolean;
}

function getDisplay(fan: FanOption): string {
  if (fan.displayName?.trim()) return fan.displayName.trim();
  if (fan.email?.trim()) return fan.email.trim();
  return fan.uid.slice(0, 8);
}

export function FanSelector({ fans, selectedUid, onSelect, loading }: FanSelectorProps) {
  if (loading) {
    return <p className="admin-posts-hint">Loading fans…</p>;
  }
  if (fans.length === 0) {
    return <p className="admin-posts-hint">No conversations yet. Messages will appear here.</p>;
  }
  return (
    <div className="premium-studio-fan-list">
      <label className="admin-posts-overlay-label">Select conversation</label>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {fans.map((fan) => (
          <li key={fan.uid} style={{ marginBottom: "0.35rem" }}>
            <button
              type="button"
              className={`admin-tabs-bar tab ${selectedUid === fan.uid ? "active" : ""}`}
              style={{ width: "100%", textAlign: "left", justifyContent: "flex-start" }}
              onClick={() => onSelect(fan.uid)}
            >
              {getDisplay(fan)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
