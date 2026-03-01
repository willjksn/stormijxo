import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "../../../../lib/studio/verify-auth";
import { rateLimit } from "../../../../lib/studio/rate-limit";
import { getAiUsageRemaining, incrementAiUsage } from "../../../../lib/studio/ai-usage";
import { sanitizeSextingInput } from "../../../../lib/studio/input-sanitizer";
import { getCachedSuggestion, setCachedSuggestion, makeSuggestionCacheKey } from "../../../../lib/studio/ai-cache";
import { generateSextingSuggestionWithGemini, generateSextingSuggestionsWithGemini } from "../../../../lib/studio/gemini-shared";
import { handleApiError, rateLimitResponse } from "../../../../lib/studio/error-handler";

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
          wrappingUp: sanitized.wrappingUp,
          fanSessionContext: sanitized.fanSessionContext || undefined,
        });
      } catch (geminiErr) {
        return handleApiError(geminiErr, "Suggestion generation failed.");
      }
      await incrementAiUsage(uid);
      return NextResponse.json({ suggestion: suggestions[0] ?? "", suggestions });
    }

    const cacheKey = makeSuggestionCacheKey(sanitized);
    const cached = getCachedSuggestion(cacheKey);
    if (cached) return NextResponse.json({ suggestion: cached });

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
        wrappingUp: sanitized.wrappingUp,
        fanSessionContext: sanitized.fanSessionContext || undefined,
      });
    } catch (geminiErr) {
      return handleApiError(geminiErr, "Suggestion generation failed.");
    }

    setCachedSuggestion(cacheKey, suggestion);
    await incrementAiUsage(uid);

    return NextResponse.json({ suggestion });
  } catch (err) {
    return handleApiError(err);
  }
}
