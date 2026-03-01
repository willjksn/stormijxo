"use client";

import React, { useCallback, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import Link from "next/link";
import { StudioShell } from "../../../features/premium-studio/components/StudioShell";
import { generateRatingPrompts, generateRatingLong, analyzeMedia } from "../../../features/premium-studio/api/client";
import { useStudioSettings } from "../../../features/premium-studio/hooks/useStudioSettings";
import type { RatingShortPrompt } from "../../../features/premium-studio/types";

const TONES = ["Playful", "Flirty", "Teasing", "Confident", "Warm", "Exclusive", "Explicit"] as const;

/** Example kinds of rating prompts — creator messages that ask fans to send something and offer a rating. */
const RATING_SUBJECT_SUGGESTIONS = [
  "Full body pic rating",
  "Rating prompts for specific body parts",
  "Interactive rating challenges",
  "Voice note rating",
  "Brutally honest rating",
  "Selfie / face rating",
  "Outfit or lingerie rating",
] as const;

function CopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16V4a2 2 0 0 1 2-2h12" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

export default function AdminRatingPromptsPage() {
  const { user } = useAuth();
  const { creatorPersonality, profanity, spiciness, formality, humor, empathy } = useStudioSettings();
  const [longPersonalityOpen, setLongPersonalityOpen] = useState(false);
  const [tone, setTone] = useState("Playful");

  // Short rating state
  const [ratingSubject, setRatingSubject] = useState("");
  const [shortLoading, setShortLoading] = useState(false);
  const [shortError, setShortError] = useState<string | null>(null);
  const [shortResult, setShortResult] = useState<{
    tone_used?: string;
    rating_subject?: string;
    prompts?: RatingShortPrompt[];
    best_3_for_conversion?: string[];
  } | null>(null);

  // Long rating state
  const [longRatingSubject, setLongRatingSubject] = useState("");
  const [fanDetails, setFanDetails] = useState("");
  const [desiredLength, setDesiredLength] = useState("300-500 words");
  const [longLoading, setLongLoading] = useState(false);
  const [longError, setLongError] = useState<string | null>(null);
  const [mediaAnalyzeLoading, setMediaAnalyzeLoading] = useState(false);
  const [mediaAnalyzeError, setMediaAnalyzeError] = useState<string | null>(null);
  const longFormMediaInputRef = React.useRef<HTMLInputElement>(null);
  const [longResult, setLongResult] = useState<{
    tone_used?: string;
    overall_score?: string;
    rating_response?: string;
    section_summary?: Record<string, string>;
    follow_up_options?: string[];
  } | null>(null);

  const getToken = useCallback(() => (user ? user.getIdToken(true) : Promise.resolve("")), [user]);

  const handleGenerateShort = useCallback(async () => {
    if (!user || !ratingSubject.trim()) return;
    setShortLoading(true);
    setShortError(null);
    setShortResult(null);
    try {
      const token = await getToken();
      if (!token) {
        setShortError("Please sign in.");
        return;
      }
      const res = await generateRatingPrompts(token, {
        tone_suggestion: tone.toLowerCase(),
        rating_subject: ratingSubject.trim(),
        profanity: profanity !== undefined ? profanity : undefined,
        spiciness: spiciness !== undefined ? spiciness : undefined,
        formality: formality !== undefined ? formality : undefined,
        humor: humor !== undefined ? humor : undefined,
        empathy: empathy !== undefined ? empathy : undefined,
      });
      if (res.error) {
        setShortError(res.error);
        return;
      }
      setShortResult({
        tone_used: res.tone_used,
        rating_subject: res.rating_subject,
        prompts: res.prompts ?? [],
        best_3_for_conversion: res.best_3_for_conversion ?? [],
      });
    } catch (e) {
      setShortError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setShortLoading(false);
    }
  }, [user, getToken, tone, ratingSubject, profanity, spiciness, formality, humor, empathy]);

  const handleGenerateLong = useCallback(async () => {
    if (!user || !longRatingSubject.trim() || !fanDetails.trim()) return;
    setLongLoading(true);
    setLongError(null);
    setLongResult(null);
    try {
      const token = await getToken();
      if (!token) {
        setLongError("Please sign in.");
        return;
      }
      const res = await generateRatingLong(token, {
        tone_suggestion: tone.toLowerCase(),
        long_rating_subject: longRatingSubject.trim(),
        fan_details: fanDetails.trim(),
        desired_length: desiredLength.trim() || "300-500 words",
        creator_voice: creatorPersonality.trim() || undefined,
        profanity: profanity !== undefined ? profanity : undefined,
        spiciness: spiciness !== undefined ? spiciness : undefined,
        formality: formality !== undefined ? formality : undefined,
        humor: humor !== undefined ? humor : undefined,
        empathy: empathy !== undefined ? empathy : undefined,
      });
      if (res.error) {
        setLongError(res.error);
        return;
      }
      setLongResult({
        tone_used: res.tone_used,
        overall_score: res.overall_score,
        rating_response: res.rating_response,
        section_summary: res.section_summary,
        follow_up_options: res.follow_up_options ?? [],
      });
    } catch (e) {
      setLongError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setLongLoading(false);
    }
  }, [user, getToken, tone, longRatingSubject, fanDetails, desiredLength, creatorPersonality, profanity, spiciness, formality, humor, empathy]);

  const handleAnalyzeMedia = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!user || !file) return;
    setMediaAnalyzeError(null);
    setMediaAnalyzeLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setMediaAnalyzeError("Please sign in.");
        return;
      }
      const res = await analyzeMedia(token, file);
      if (res.error) {
        setMediaAnalyzeError(res.error);
        return;
      }
      if (res.description) {
        setFanDetails((prev) => (prev ? `${prev}\n\n--- Analyzed from upload ---\n\n${res.description}` : res.description));
      }
    } catch (err) {
      setMediaAnalyzeError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setMediaAnalyzeLoading(false);
    }
  }, [user, getToken]);

  const copyToClipboard = useCallback((text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
  }, []);

  if (!user) {
    return (
      <StudioShell title="Rating prompts">
        <p className="admin-posts-message admin-posts-message-error">Please sign in to use Rating prompts.</p>
        <Link href="/admin/login" className="btn btn-primary" style={{ marginTop: "1rem" }}>
          Sign in
        </Link>
      </StudioShell>
    );
  }

  return (
    <StudioShell title="Rating Prompts">
      <div className="prompts-page prompts-page-rating">
        <div className="prompts-shared-tone prompts-panel chat-session-assistant-panel" style={{ marginBottom: "1.5rem" }}>
          <label className="chat-session-label">Tone (shared)</label>
          <div className="chat-session-tone-row">
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                className={`chat-session-role-btn ${tone === t ? "active" : ""}`}
                onClick={() => setTone(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Short rating prompts */}
        <section className="prompts-section">
          <h2 className="prompts-section-title">Short rating prompts</h2>

          <div className="prompts-panel chat-session-assistant-panel">
            <div className="chat-session-assistant-inner">
              <label className="chat-session-label">Kind of rating prompts (required)</label>
              <div className="prompts-subject-chips">
                {RATING_SUBJECT_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`prompts-subject-chip ${ratingSubject === s ? "active" : ""}`}
                    onClick={() => setRatingSubject(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="chat-session-input"
                placeholder="e.g. Rating prompts for specific body parts, Interactive rating challenges"
                value={ratingSubject}
                onChange={(e) => setRatingSubject(e.target.value)}
              />
              <button
                type="button"
                className="chat-session-start-btn"
                onClick={handleGenerateShort}
                disabled={shortLoading || !ratingSubject.trim()}
              >
                {shortLoading ? "Generating…" : "Generate 10 rating prompts"}
              </button>
            </div>
          </div>
          {shortError && (
            <p className="admin-posts-message admin-posts-message-error" style={{ marginTop: "0.5rem" }}>
              {shortError}
            </p>
          )}
          {shortResult && shortResult.prompts && shortResult.prompts.length > 0 && (
            <div className="prompts-results" style={{ marginTop: "1rem" }}>
              {shortResult.tone_used && (
                <p className="prompts-results-tone" style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                  Tone: {shortResult.tone_used} · Subject: {shortResult.rating_subject}
                </p>
              )}
              <div className="prompts-rating-list">
                {shortResult.prompts.map((p, i) => (
                  <div key={i} className="prompts-rating-card">
                    <p className="prompts-rating-text">{p.prompt_text}</p>
                    {p.angle && <span className="prompts-rating-angle">{p.angle}</span>}
                    {p.cta && <p className="prompts-rating-cta">CTA: {p.cta}</p>}
                    <button
                      type="button"
                      className="prompts-copy-btn"
                      onClick={() => copyToClipboard(p.prompt_text ?? "")}
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
              {shortResult.best_3_for_conversion && shortResult.best_3_for_conversion.length > 0 && (
                <div className="prompts-best3" style={{ marginTop: "1rem" }}>
                  <h4 style={{ color: "var(--accent)", fontSize: "0.95rem", marginBottom: "0.5rem" }}>Best 3 for conversion</h4>
                  <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--text)" }}>
                    {shortResult.best_3_for_conversion.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Long-form rating */}
        <section className="prompts-section" style={{ marginTop: "2rem" }}>
          <h2 className="prompts-section-title">Long-form rating</h2>
          <div className="prompts-panel chat-session-assistant-panel">
            <div className="chat-session-assistant-inner">
              <label className="chat-session-label">Rating subject (required)</label>
              <input
                type="text"
                className="chat-session-input"
                placeholder="e.g. custom rating of my fan's message"
                value={longRatingSubject}
                onChange={(e) => setLongRatingSubject(e.target.value)}
              />
              <label className="chat-session-label">Fan details to rate (required)</label>
              <div className="prompts-fan-details-wrap" style={{ position: "relative" }}>
                <textarea
                  className="admin-posts-caption-input"
                  placeholder="Paste or describe what the fan sent (message, photo description, etc.)"
                  value={fanDetails}
                  onChange={(e) => setFanDetails(e.target.value)}
                  rows={4}
                  style={{ minHeight: 100 }}
                />
                <button
                  type="button"
                  className="prompts-copy-box-btn"
                  onClick={() => copyToClipboard(fanDetails)}
                  disabled={!fanDetails.trim()}
                  title="Copy all"
                  aria-label="Copy all"
                >
                  <CopyIcon />
                </button>
              </div>
              <div className="prompts-media-upload-row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                <input
                  ref={longFormMediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  style={{ display: "none" }}
                  onChange={handleAnalyzeMedia}
                />
                <button
                  type="button"
                  className="chat-session-duration-btn"
                  onClick={() => longFormMediaInputRef.current?.click()}
                  disabled={mediaAnalyzeLoading}
                >
                  {mediaAnalyzeLoading ? "Analyzing…" : "Upload image/video to analyze"}
                </button>
                <span className="prompts-media-hint" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  AI will describe it and fill the box above for your rating.
                </span>
              </div>
              {mediaAnalyzeError && (
                <p className="admin-posts-message admin-posts-message-error" style={{ marginTop: "0.35rem", fontSize: "0.85rem" }}>{mediaAnalyzeError}</p>
              )}
              <label className="chat-session-label">Desired length</label>
              <input
                type="text"
                className="chat-session-input"
                placeholder="300-500 words"
                value={desiredLength}
                onChange={(e) => setDesiredLength(e.target.value)}
              />
              <div className="chat-session-personality-wrap" style={{ marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className={`chat-session-personality-btn ${longPersonalityOpen ? "active" : ""}`}
                  onClick={() => setLongPersonalityOpen((o) => !o)}
                  aria-expanded={longPersonalityOpen}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                >
                  <span className="chat-session-personality-icon"><SparklesIcon /></span>
                  Creator Personality
                </button>
                {longPersonalityOpen && (
                  <div className="chat-session-personality-content" style={{ marginTop: "0.5rem" }}>
                    <p className="admin-posts-hint" style={{ marginBottom: "0.5rem" }}>
                      From <Link href="/admin/ai-training" style={{ color: "var(--accent)" }}>AI Training</Link>. Used for long-form rating voice.
                    </p>
                    <div
                      className="admin-posts-caption-input"
                      style={{ minHeight: 60, whiteSpace: "pre-wrap", padding: "0.75rem" }}
                      role="textbox"
                      aria-readonly
                    >
                      {creatorPersonality || "No personality set. Add one in AI Training."}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="chat-session-start-btn"
                onClick={handleGenerateLong}
                disabled={longLoading || !longRatingSubject.trim() || !fanDetails.trim()}
              >
                {longLoading ? "Generating…" : "Generate long-form rating"}
              </button>
            </div>
          </div>
          {longError && (
            <p className="admin-posts-message admin-posts-message-error" style={{ marginTop: "0.5rem" }}>
              {longError}
            </p>
          )}
          {longResult && longResult.rating_response && (
            <div className="prompts-results prompts-long-result" style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
                {longResult.overall_score && (
                  <p style={{ fontWeight: 600, color: "var(--accent)", margin: 0 }}>
                    Score: {longResult.overall_score}
                  </p>
                )}
                <button
                  type="button"
                  className="prompts-copy-all-btn"
                  onClick={() => copyToClipboard(longResult.rating_response ?? "")}
                  title="Copy full rating to paste in chat or DM"
                  aria-label="Copy full rating"
                >
                  <CopyIcon />
                  <span>Copy full rating</span>
                </button>
              </div>
              <div
                className="prompts-long-response"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "1rem",
                  whiteSpace: "pre-wrap",
                  color: "var(--text)",
                }}
              >
                {longResult.rating_response}
              </div>
              {longResult.section_summary && Object.keys(longResult.section_summary).length > 0 && (
                <div className="prompts-section-summary" style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  {Object.entries(longResult.section_summary).map(([k, v]) => (
                    <p key={k}><strong>{k}:</strong> {v}</p>
                  ))}
                </div>
              )}
              {longResult.follow_up_options && longResult.follow_up_options.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                  <h4 style={{ color: "var(--accent)", fontSize: "0.95rem", marginBottom: "0.5rem" }}>Follow-up options</h4>
                  <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                    {longResult.follow_up_options.map((s, i) => (
                      <li key={i}>
                        <button type="button" className="prompts-copy-inline" onClick={() => copyToClipboard(s)}>
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </StudioShell>
  );
}
