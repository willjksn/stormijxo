"use client";

import React, { useCallback, useState } from "react";
import { generateSextingSuggestion } from "../api/client";
import type { SextingContextMessage } from "../types";
import { stormijxoStudioTokens } from "../theme/stormijxoStudioTokens";

interface AISuggestionsPanelProps {
  getToken: () => Promise<string>;
  recentMessages: SextingContextMessage[];
  fanName?: string;
  creatorPersona?: string;
  profanity?: number;
  spiciness?: number;
  formality?: number;
  humor?: number;
  empathy?: number;
  tone?: string;
  onSuggestionSelect?: (text: string) => void;
  onUseSuggestion?: (text: string) => void;
  usageRemaining?: number;
  cardMode?: boolean;
  initialSuggestions?: string[];
  onRequestSuggestions?: () => void;
  suggestionsLoading?: boolean;
  /** When true (e.g. AI Chat Bot is on), disable the Suggest reply button. */
  suggestionsDisabled?: boolean;
}

const TONES = [
  { id: "playful", label: "Playful" },
  { id: "intimate", label: "Intimate" },
  { id: "tease", label: "Tease" },
  { id: "sweet", label: "Sweet" },
] as const;

export function AISuggestionsPanel({
  getToken,
  recentMessages,
  fanName = "",
  creatorPersona = "",
  profanity,
  spiciness,
  formality,
  humor,
  empathy,
  tone: toneProp,
  onSuggestionSelect,
  onUseSuggestion,
  usageRemaining = 200,
  cardMode = false,
  initialSuggestions = [],
  onRequestSuggestions,
  suggestionsLoading = false,
  suggestionsDisabled = false,
}: AISuggestionsPanelProps) {
  const [tone, setTone] = useState<typeof TONES[number]["id"]>("playful");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [suggestionsList, setSuggestionsList] = useState<string[]>([]);

  const handleGenerate = useCallback(async () => {
    if (!getToken) return;
    if (!cardMode && recentMessages.length === 0) return;
    setError(null);
    if (!cardMode) setSuggestion("");
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await generateSextingSuggestion(token, {
        recentMessages,
        fanName: fanName || undefined,
        creatorPersona: creatorPersona || undefined,
        tone,
        profanity: profanity !== undefined ? profanity : undefined,
        spiciness: spiciness !== undefined ? spiciness : undefined,
        formality: formality !== undefined ? formality : undefined,
        humor: humor !== undefined ? humor : undefined,
        empathy: empathy !== undefined ? empathy : undefined,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (cardMode) {
        setSuggestionsList((prev) => [...prev, res.suggestion]);
      } else {
        setSuggestion(res.suggestion);
      }
    } finally {
      setLoading(false);
    }
  }, [getToken, recentMessages, fanName, creatorPersona, profanity, spiciness, formality, humor, empathy, tone, cardMode]);

  if (cardMode) {
    const displaySuggestions = initialSuggestions.length > 0 ? initialSuggestions : suggestionsList;
    return (
      <div className="chat-session-ai-cards-wrap">
        {onRequestSuggestions && (
          <button
            type="button"
            className="chat-session-suggest-reply-btn"
            onClick={onRequestSuggestions}
            disabled={suggestionsDisabled || suggestionsLoading || usageRemaining <= 0 || recentMessages.length === 0}
            title={suggestionsDisabled ? "AI Chat Bot is on — turn it off to use suggestions" : undefined}
          >
            {suggestionsLoading ? "…" : "✨ Suggest reply"}
          </button>
        )}
        {error && (
          <p className="admin-posts-message admin-posts-message-error" style={{ marginTop: "0.75rem" }}>{error}</p>
        )}
        <div className="chat-session-suggestion-cards">
          {displaySuggestions.map((text, i) => (
            <div key={i} className="chat-session-suggestion-card">
              <p className="chat-session-suggestion-card-text">{text}</p>
              <p className="chat-session-suggestion-card-confidence">Confidence: 85%</p>
              <div className="chat-session-suggestion-card-actions">
                <button type="button" className="chat-session-card-link" onClick={() => onSuggestionSelect?.(text)}>Copy</button>
                <button type="button" className="chat-session-card-link" onClick={() => onUseSuggestion?.(text)}>Use</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="panel active"
      style={{
        background: stormijxoStudioTokens.surface,
        border: `1px solid ${stormijxoStudioTokens.border}`,
        borderRadius: 18,
        padding: "1.25rem",
        boxShadow: "0 14px 42px rgba(212, 85, 139, 0.11)",
      }}
    >
      <h3 className="admin-posts-card-heading" style={{ marginTop: 0, fontSize: "1rem" }}>AI suggestion</h3>
      <p className="admin-posts-hint" style={{ marginBottom: "0.75rem" }}>
        Suggest next message.
      </p>
      <div style={{ marginBottom: "0.75rem" }}>
        <label className="admin-posts-overlay-label">Tone</label>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value as typeof TONES[number]["id"])}
          className="admin-posts-overlay-select"
        >
          {TONES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleGenerate}
        disabled={loading || recentMessages.length === 0 || usageRemaining <= 0}
      >
        {loading ? "…" : "✨ Suggest reply"}
      </button>
      {error && (
        <p className="admin-posts-message admin-posts-message-error" style={{ marginTop: "0.75rem" }}>{error}</p>
      )}
      {suggestion && (
        <div style={{ marginTop: "1rem" }}>
          <p className="admin-posts-overlay-label">Suggestion</p>
          <button
            type="button"
            className="admin-posts-option-btn active"
            style={{ width: "100%", textAlign: "left", padding: "0.75rem" }}
            onClick={() => onSuggestionSelect?.(suggestion)}
          >
            {suggestion}
          </button>
        </div>
      )}
    </div>
  );
}
