"use client";

import React, { useCallback, useRef, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import Link from "next/link";
import { StudioShell } from "../../../features/premium-studio/components/StudioShell";
import { useStudioSettings } from "../../../features/premium-studio/hooks/useStudioSettings";

function InfoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

const SLIDER_CONFIG = [
  { id: "formality", label: "Formality", description: "Low for casual & slang, high for formal & professional.", default: 30 },
  { id: "humor", label: "Humor", description: "Low for serious, high for witty & funny replies.", default: 50 },
  { id: "empathy", label: "Empathy", description: "Low for direct, high for supportive & understanding.", default: 70 },
  { id: "profanity", label: "Profanity", description: "Control the level of strong or crude language in outputs.", default: 50 },
  { id: "spiciness", label: "Spiciness", description: "Control the level of bold/explicit language.", default: 100, suffix: " 🌶️" as const },
] as const;

export default function AdminAITrainingPage() {
  const { user } = useAuth();
  const {
    creatorPersonality,
    formality,
    humor,
    empathy,
    profanity,
    spiciness,
    setCreatorPersonality,
    setFormality,
    setHumor,
    setEmpathy,
    setProfanity,
    setSpiciness,
    saveCreatorPersonality,
    saveSliders,
    loading,
  } = useStudioSettings();

  const creatorPersonalityRef = useRef<HTMLTextAreaElement>(null);
  const sliderValues = { formality, humor, empathy, profanity, spiciness };
  const setSlider = useCallback((id: string, value: number) => {
    if (id === "formality") setFormality(value);
    else if (id === "humor") setHumor(value);
    else if (id === "empathy") setEmpathy(value);
    else if (id === "profanity") setProfanity(value);
    else if (id === "spiciness") setSpiciness(value);
  }, [setFormality, setHumor, setEmpathy, setProfanity, setSpiciness]);

  const handleSliderChange = useCallback((id: string, value: number) => {
    setSlider(id, value);
    saveSliders(
      id === "formality"
        ? { formality: value }
        : id === "humor"
          ? { humor: value }
          : id === "empathy"
            ? { empathy: value }
            : id === "profanity"
              ? { profanity: value }
              : { spiciness: value }
    );
  }, [setSlider, saveSliders]);

  if (!user) {
    return (
      <StudioShell title="AI Training">
        <p className="admin-posts-message admin-posts-message-error">Please sign in to use AI Training.</p>
        <Link href="/admin/login" className="btn btn-primary" style={{ marginTop: "1rem" }}>
          Sign in
        </Link>
      </StudioShell>
    );
  }

  return (
    <StudioShell title="AI Training">
      <div className="prompts-page prompts-page-ai-training">
        <div className="ai-training-card">
          <h2>AI Personality & Tone</h2>
          <p className="ai-training-subtitle" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
            These settings apply to all AI features: chat, captions, interactive prompts, and rating prompts.
          </p>
          {loading ? (
            <p className="admin-posts-message" style={{ color: "var(--text-muted)" }}>Loading…</p>
          ) : (
            SLIDER_CONFIG.map(({ id, label, description, suffix = "" }) => (
              <div key={id} className="ai-training-slider-block">
                <div className="ai-training-slider-header">
                  <span className="ai-training-slider-label">{label}{suffix}</span>
                  <span className="ai-training-slider-value">{sliderValues[id]}</span>
                </div>
                <input
                  type="range"
                  className="ai-training-slider-input"
                  min={0}
                  max={100}
                  value={sliderValues[id]}
                  onChange={(e) => handleSliderChange(id, Number(e.target.value))}
                  aria-label={label}
                />
                <p className="ai-training-slider-desc">{description}</p>
              </div>
            ))
          )}
        </div>

        <div className="ai-training-card">
          <h2>Creator Personality</h2>
          <p className="ai-training-subtitle">Personality Description / Brand</p>
          <p className="ai-training-toggle-desc" style={{ marginBottom: "1rem" }}>
            This describes your voice and brand for all AI features. Use the Personality button on Chat session, Interactive prompts, and Post to see this in context.
          </p>
          <div className="ai-training-personality-wrap">
            <textarea
              ref={creatorPersonalityRef}
              placeholder="I am a flirty, confident creator who..."
              value={creatorPersonality}
              onChange={(e) => setCreatorPersonality(e.target.value)}
              onBlur={saveCreatorPersonality}
              aria-label="Creator personality description"
            />
            <button
              type="button"
              className="ai-training-info-btn"
              title="How your personality is used in AI outputs"
              aria-label="Info about creator personality"
            >
              <InfoIcon />
            </button>
          </div>
          <div className="ai-training-personality-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => creatorPersonalityRef.current?.focus()}
              aria-label="Focus to edit"
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { saveCreatorPersonality(); }}
              aria-label="Save creator personality"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
