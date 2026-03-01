import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "../../../../lib/studio/verify-auth";
import { rateLimit } from "../../../../lib/studio/rate-limit";
import { getCaptionUsageRemaining, incrementCaptionUsage } from "../../../../lib/studio/caption-usage";
import { sanitizeCaptionInput } from "../../../../lib/studio/input-sanitizer";
import { getCachedCaptions, setCachedCaptions, makeCaptionCacheKey } from "../../../../lib/studio/ai-cache";
import { generateCaptionsWithGemini } from "../../../../lib/studio/gemini-shared";
import { handleApiError, badRequest, rateLimitResponse } from "../../../../lib/studio/error-handler";

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req.headers.get("authorization"));
    if (!authResult.ok) return authResult.response;
    const { uid } = authResult;

    const rl = await rateLimit(uid, "captions", 30, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt - Date.now());

    const remaining = await getCaptionUsageRemaining(uid);
    if (remaining <= 0) return NextResponse.json({ error: "Daily caption limit reached. Try again tomorrow." }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const sanitized = sanitizeCaptionInput(body);
    const hasInput = sanitized.imageUrls.length > 0 || !!sanitized.bio || !!sanitized.starterText;
    if (!hasInput) {
      return badRequest("Provide at least one of: imageUrls (or imageUrl), bio, or starterText.");
    }

    const cacheKey = makeCaptionCacheKey({
      imageUrls: sanitized.imageUrls,
      bio: sanitized.bio,
      tone: sanitized.tone,
      length: sanitized.length,
      starterText: sanitized.starterText,
    });
    const cached = getCachedCaptions(cacheKey);
    if (cached) return NextResponse.json({ captions: cached });

    let captions: string[];
    try {
      captions = await generateCaptionsWithGemini({
        imageUrls: sanitized.imageUrls.length ? sanitized.imageUrls : undefined,
        hasVideo: !!body.hasVideo,
        bio: sanitized.bio,
        tone: sanitized.tone,
        length: sanitized.length,
        starterText: sanitized.starterText,
        count: sanitized.count,
        formality: sanitized.formality,
        humor: sanitized.humor,
        empathy: sanitized.empathy,
        profanity: sanitized.profanity,
        spiciness: sanitized.spiciness,
      });
    } catch (geminiErr) {
      return handleApiError(geminiErr, "Caption generation failed.");
    }

    setCachedCaptions(cacheKey, captions);
    await incrementCaptionUsage(uid);

    return NextResponse.json({ captions });
  } catch (err) {
    return handleApiError(err);
  }
}
