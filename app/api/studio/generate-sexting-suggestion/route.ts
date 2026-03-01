import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "../../../../lib/studio/verify-auth";
import { rateLimit } from "../../../../lib/studio/rate-limit";
import { getAiUsageRemaining, incrementAiUsage } from "../../../../lib/studio/ai-usage";
import { sanitizeSextingInput } from "../../../../lib/studio/input-sanitizer";
import { getCachedSuggestion, setCachedSuggestion, makeSuggestionCacheKey } from "../../../../lib/studio/ai-cache";
import { generateSextingSuggestionWithGemini, generateSextingSuggestionsWithGemini } from "../../../../lib/studio/gemini-shared";
import { handleApiError, rateLimitResponse } from "../../../../lib/studio/error-handler";

function extractPrimaryReplyFromJsonish(text: string): string | null {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [
    trimmed,
    codeBlockMatch?.[1]?.trim() || "",
    trimmed.replace(/\\"/g, "\""),
    (codeBlockMatch?.[1]?.trim() || "").replace(/\\"/g, "\""),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { primary_reply?: unknown };
      if (typeof parsed?.primary_reply === "string" && parsed.primary_reply.trim()) {
        return parsed.primary_reply.trim();
      }
    } catch {
      // ignore
    }

    const quoted = candidate.match(/"primary_reply"\s*:\s*("(?:\\.|[^"\\])*")/i);
    if (quoted?.[1]) {
      try {
        const value = JSON.parse(quoted[1]);
        if (typeof value === "string" && value.trim()) return value.trim();
      } catch {
        // ignore
      }
    }
  }

  return null;
}

function normalizeSuggestionText(input: unknown): string {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  const extracted = extractPrimaryReplyFromJsonish(trimmed);
  if (extracted) return extracted;

  // Never surface raw JSON object text in chat UI.
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return "Hey 😊";

  return trimmed;
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req.headers.get("authorization"));
    if (!authResult.ok) return authResult.response;
    const { uid } = authResult;

    const rl = await rateLimit(uid, "sexting", 60, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt - Date.now());

    const remaining = await getAiUsageRemaining(uid);
    if (remaining <= 0) return NextResponse.json({ error: "Daily AI suggestion limit reached. Try again tomorrow." }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const sanitized = sanitizeSextingInput(body);
    if (sanitized.recentMessages.length === 0) {
      return NextResponse.json({ error: "Provide at least one recent message." }, { status: 400 });
    }

    const numSuggestions = sanitized.numSuggestions ?? 1;
    if (numSuggestions > 1) {
      let suggestions: string[];
      try {
        suggestions = await generateSextingSuggestionsWithGemini({
          recentMessages: sanitized.recentMessages,
          fanName: sanitized.fanName || undefined,
          creatorPersona: sanitized.creatorPersona || undefined,
          tone: sanitized.tone || undefined,
          count: numSuggestions,
          formality: sanitized.formality,
          humor: sanitized.humor,
          empathy: sanitized.empathy,
          profanity: sanitized.profanity,
          spiciness: sanitized.spiciness,
          emoji: sanitized.emoji,
          wrappingUp: sanitized.wrappingUp,
          fanSessionContext: sanitized.fanSessionContext || undefined,
        });
      } catch (geminiErr) {
        return handleApiError(geminiErr, "Suggestion generation failed.");
      }
      const normalizedSuggestions = suggestions
        .map((s) => normalizeSuggestionText(s))
        .filter((s) => s.length > 0);
      await incrementAiUsage(uid);
      return NextResponse.json({
        suggestion: normalizedSuggestions[0] ?? "Hey 😊",
        suggestions: normalizedSuggestions.length > 0 ? normalizedSuggestions : ["Hey 😊"],
      });
    }

    const cacheKey = makeSuggestionCacheKey(sanitized);
    const cached = getCachedSuggestion(cacheKey);
    if (cached) return NextResponse.json({ suggestion: normalizeSuggestionText(cached) || "Hey 😊" });

    let suggestion: string;
    try {
      suggestion = await generateSextingSuggestionWithGemini({
        recentMessages: sanitized.recentMessages,
        fanName: sanitized.fanName || undefined,
        creatorPersona: sanitized.creatorPersona || undefined,
        tone: sanitized.tone || undefined,
        formality: sanitized.formality,
        humor: sanitized.humor,
        empathy: sanitized.empathy,
        profanity: sanitized.profanity,
        spiciness: sanitized.spiciness,
        emoji: sanitized.emoji,
        wrappingUp: sanitized.wrappingUp,
        fanSessionContext: sanitized.fanSessionContext || undefined,
      });
    } catch (geminiErr) {
      return handleApiError(geminiErr, "Suggestion generation failed.");
    }

    const normalizedSuggestion = normalizeSuggestionText(suggestion) || "Hey 😊";
    setCachedSuggestion(cacheKey, normalizedSuggestion);
    await incrementAiUsage(uid);

    return NextResponse.json({ suggestion: normalizedSuggestion });
  } catch (err) {
    return handleApiError(err);
  }
}
