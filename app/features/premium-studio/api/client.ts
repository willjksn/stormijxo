/**
 * Premium Studio API client (captions, sexting suggestions, usage, interactive ideas, rating prompts).
 * Caller must pass Firebase ID token (e.g. from useAuth().user.getIdToken()).
 */

import type {
  GenerateCaptionRequest,
  GenerateCaptionResponse,
  GenerateSextingSuggestionRequest,
  GenerateSextingSuggestionResponse,
  UsageLimit,
  GenerateInteractiveIdeasRequest,
  GenerateInteractiveIdeasResponse,
  GenerateRatingPromptsRequest,
  GenerateRatingPromptsResponse,
  GenerateRatingLongRequest,
  GenerateRatingLongResponse,
} from "../types";

export async function generateCaptions(
  idToken: string,
  body: GenerateCaptionRequest
): Promise<GenerateCaptionResponse> {
  const res = await fetch("/api/studio/generate-captions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { captions: [], error: data.error || "Caption generation failed" };
  }
  return { captions: Array.isArray(data.captions) ? data.captions : [data.caption || ""], error: data.error };
}

export async function generateSextingSuggestion(
  idToken: string,
  body: GenerateSextingSuggestionRequest
): Promise<GenerateSextingSuggestionResponse> {
  const res = await fetch("/api/studio/generate-sexting-suggestion", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { suggestion: "", error: data.error || "Suggestion failed" };
  }
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : undefined;
  return { suggestion: data.suggestion ?? "", suggestions, error: data.error };
}

export async function fetchUsage(idToken: string): Promise<UsageLimit> {
  const res = await fetch("/api/studio/usage", {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      captionGenerationsRemaining: 0,
      aiSuggestionsRemaining: 0,
      limitPeriod: "day",
    };
  }
  return {
    captionGenerationsRemaining: typeof data.captionGenerationsRemaining === "number" ? data.captionGenerationsRemaining : 0,
    aiSuggestionsRemaining: typeof data.aiSuggestionsRemaining === "number" ? data.aiSuggestionsRemaining : 0,
    limitPeriod: data.limitPeriod === "month" ? "month" : "day",
  };
}

export async function generateInteractiveIdeas(
  idToken: string,
  body: GenerateInteractiveIdeasRequest
): Promise<GenerateInteractiveIdeasResponse> {
  const res = await fetch("/api/studio/generate-interactive-ideas", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ideas: [], ab_test_variants: [], error: data.error || "Interactive ideas generation failed" };
  }
  return {
    tone_used: data.tone_used,
    ideas: Array.isArray(data.ideas) ? data.ideas : [],
    ab_test_variants: Array.isArray(data.ab_test_variants) ? data.ab_test_variants : [],
    error: data.error,
  };
}

export async function generateRatingPrompts(
  idToken: string,
  body: GenerateRatingPromptsRequest
): Promise<GenerateRatingPromptsResponse> {
  const res = await fetch("/api/studio/generate-rating-prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { prompts: [], best_3_for_conversion: [], error: data.error || "Rating prompts generation failed" };
  }
  return {
    tone_used: data.tone_used,
    rating_subject: data.rating_subject,
    prompts: Array.isArray(data.prompts) ? data.prompts : [],
    best_3_for_conversion: Array.isArray(data.best_3_for_conversion) ? data.best_3_for_conversion : [],
    error: data.error,
  };
}

export async function generateRatingLong(
  idToken: string,
  body: GenerateRatingLongRequest
): Promise<GenerateRatingLongResponse> {
  const res = await fetch("/api/studio/generate-rating-long", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || "Long-form rating generation failed" };
  }
  return {
    tone_used: data.tone_used,
    overall_score: data.overall_score,
    rating_response: data.rating_response,
    section_summary: data.section_summary,
    follow_up_options: Array.isArray(data.follow_up_options) ? data.follow_up_options : [],
    error: data.error,
  };
}

export async function analyzeMedia(idToken: string, file: File): Promise<{ description?: string; error?: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/studio/analyze-media", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || "Media analysis failed" };
  }
  return { description: data.description, error: data.error };
}

export async function generateChatSessionSummary(
  idToken: string,
  body: { recentMessages: { role: "user" | "assistant"; content: string }[]; fanName?: string }
): Promise<{ summary: string; error?: string }> {
  const res = await fetch("/api/studio/generate-chat-session-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { summary: "", error: data.error || "Summary generation failed" };
  }
  return { summary: data.summary ?? "", error: data.error };
}
