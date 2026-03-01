"use client";

import React, { useCallback, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import Link from "next/link";
import { StudioShell } from "../../../features/premium-studio/components/StudioShell";
import { generateInteractiveIdeas } from "../../../features/premium-studio/api/client";
import { useStudioSettings } from "../../../features/premium-studio/hooks/useStudioSettings";
import type { InteractiveIdea, AbTestVariant } from "../../../features/premium-studio/types";

const TONES = ["Playful", "Flirty", "Teasing", "Confident", "Warm", "Soft"] as const;
const OBJECTIVES = ["comments", "DMs", "tips", "PPV opens", "retention"] as const;

function SparklesIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

export default function AdminInteractivePromptsPage() {
  const { user } = useAuth();
  const { creatorPersonality, profanity, spiciness, formality, humor, empathy } = useStudioSettings();
  const [personalityOpen, setPersonalityOpen] = useState(false);
  const [tone, setTone] = useState("Playful");
  const [interactiveFocus, setInteractiveFocus] = useState("");
  const [objective, setObjective] = useState("comments");
  const [constraints, setConstraints] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    tone_used?: string;
    ideas?: InteractiveIdea[];
    ab_test_variants?: AbTestVariant[];
  } | null>(null);

  const getToken = useCallback(() => (user ? user.getIdToken(true) : Promise.resolve("")), [user]);

  const handleGenerate = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Please sign in.");
        return;
      }
      const res = await generateInteractiveIdeas(token, {
        tone_suggestion: tone.toLowerCase(),
        interactive_focus: interactiveFocus.trim() || undefined,
        creator_voice: creatorPersonality.trim() || undefined,
        objective,
        constraints: constraints.trim() || undefined,
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
      setResult({
        tone_used: res.tone_used,
        ideas: res.ideas ?? [],
        ab_test_variants: res.ab_test_variants ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }, [user, getToken, tone, interactiveFocus, creatorPersonality, profanity, spiciness, formality, humor, empathy, objective, constraints]);

  const copyToClipboard = useCallback((text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
  }, []);

  if (!user) {
    return (
      <StudioShell title="Interactive prompts">
        <p className="admin-posts-message admin-posts-message-error">Please sign in to use Interactive prompts.</p>
        <Link href="/admin/login" className="btn btn-primary" style={{ marginTop: "1rem" }}>
          Sign in
        </Link>
      </StudioShell>
    );
  }

  return (
    <StudioShell title="Interactive Post Ideas">
      <div className="prompts-page prompts-page-interactive">
        <div className="prompts-panel chat-session-assistant-panel">
          <div className="chat-session-assistant-inner">
            <label className="chat-session-label">Tone</label>
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

            <label className="chat-session-label">Interactive focus (optional)</label>
            <input
              type="text"
              className="chat-session-input"
              placeholder="e.g. polls, challenges"
              value={interactiveFocus}
              onChange={(e) => setInteractiveFocus(e.target.value)}
            />

            <label className="chat-session-label">Objective</label>
            <div className="chat-session-duration-row">
              {OBJECTIVES.map((obj) => (
                <button
                  key={obj}
                  type="button"
                  className={`chat-session-duration-btn ${objective === obj ? "active" : ""}`}
                  onClick={() => setObjective(obj)}
                >
                  {obj}
                </button>
              ))}
            </div>

            <div className="chat-session-personality-wrap" style={{ marginTop: "0.5rem" }}>
              <button
                type="button"
                className={`chat-session-personality-btn ${personalityOpen ? "active" : ""}`}
                onClick={() => setPersonalityOpen((o) => !o)}
                aria-expanded={personalityOpen}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
              >
                <span className="chat-session-personality-icon"><SparklesIcon /></span>
                Creator Personality
              </button>
              {personalityOpen && (
                <div className="chat-session-personality-content" style={{ marginTop: "0.5rem" }}>
                  <p className="admin-posts-hint" style={{ marginBottom: "0.5rem" }}>
                    From <a href="/admin/ai-training" style={{ color: "var(--accent)" }}>AI Training</a>. Used for all AI features.
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

            <label className="chat-session-label">Constraints (optional)</label>
            <input
              type="text"
              className="chat-session-input"
              placeholder="e.g. no explicit, keep it short"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
            />

            <button
              type="button"
              className="chat-session-start-btn"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? "Generating…" : "Generate 10 ideas"}
            </button>
          </div>
        </div>

        {error && (
          <p className="admin-posts-message admin-posts-message-error" style={{ marginTop: "1rem" }}>
            {error}
          </p>
        )}

        {result && (
          <div className="prompts-results" style={{ marginTop: "1.5rem" }}>
            {result.tone_used && (
              <p className="prompts-results-tone" style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                Tone used: {result.tone_used}
              </p>
            )}
            {result.ideas && result.ideas.length > 0 && (
              <section className="prompts-results-section">
                <h3 className="chat-session-panel-title">Ideas</h3>
                <div className="prompts-ideas-list">
                  {result.ideas.map((idea, i) => (
                    <div key={i} className="prompts-idea-card">
                      <div className="prompts-idea-header">
                        <strong style={{ color: "var(--accent)" }}>{idea.title ?? `Idea ${i + 1}`}</strong>
                        {idea.interaction_mechanic && (
                          <span className="prompts-idea-mechanic">{idea.interaction_mechanic}</span>
                        )}
                      </div>
                      {idea.post_caption && (
                        <p className="prompts-idea-caption">{idea.post_caption}</p>
                      )}
                      {idea.cta && <p className="prompts-idea-cta">CTA: {idea.cta}</p>}
                      {idea.dm_followup_trigger && (
                        <p className="prompts-idea-dm">DM follow-up: {idea.dm_followup_trigger}</p>
                      )}
                      {idea.why_it_should_work && (
                        <p className="prompts-idea-why">{idea.why_it_should_work}</p>
                      )}
                      <button
                        type="button"
                        className="prompts-copy-btn"
                        onClick={() => copyToClipboard(idea.post_caption ?? "")}
                      >
                        Copy caption
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {result.ab_test_variants && result.ab_test_variants.length > 0 && (
              <section className="prompts-results-section" style={{ marginTop: "1.5rem" }}>
                <h3 className="chat-session-panel-title">A/B test variants</h3>
                <div className="prompts-ab-list">
                  {result.ab_test_variants.map((ab, i) => (
                    <div key={i} className="prompts-ab-card">
                      <strong style={{ color: "var(--text)" }}>{ab.test}</strong>
                      <p><span style={{ color: "var(--accent)" }}>A:</span> {ab.variant_a}</p>
                      <p><span style={{ color: "var(--accent)" }}>B:</span> {ab.variant_b}</p>
                      <p className="prompts-ab-metric">Metric: {ab.success_metric}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </StudioShell>
  );
}
