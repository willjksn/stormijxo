import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "../../../../lib/studio/verify-auth";
import { rateLimit } from "../../../../lib/studio/rate-limit";
import { generateRatingLongWithGemini } from "../../../../lib/studio/gemini-shared";
import { handleApiError, badRequest, rateLimitResponse } from "../../../../lib/studio/error-handler";

const MAX_STR = 2000;

function sanitize(body: Record<string, unknown>) {
  const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_STR) : "");
  const num = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(100, Math.round(v))) : undefined);
  return {
    tone_suggestion: str(body.tone_suggestion) || "playful",
    long_rating_subject: str(body.long_rating_subject),
    fan_details: str(body.fan_details),
    creator_voice: str(body.creator_voice),
    fan_profile: str(body.fan_profile),
    creator_gender: str(body.creator_gender),
    target_audience_gender: str(body.target_audience_gender),
    constraints: str(body.constraints),
    desired_length: str(body.desired_length) || "300-500 words",
    formality: num(body.formality),
    humor: num(body.humor),
    empathy: num(body.empathy),
    profanity: num(body.profanity),
    spiciness: num(body.spiciness),
  };
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req.headers.get("authorization"));
    if (!authResult.ok) return authResult.response;
    const { uid } = authResult;

    const rl = await rateLimit(uid, "rating_long", 15, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt - Date.now());

    const body = await req.json().catch(() => ({}));
    const params = sanitize(body as Record<string, unknown>);
    if (!params.long_rating_subject) {
      return badRequest("long_rating_subject is required.");
    }
    if (!params.fan_details) {
      return badRequest("fan_details is required.");
    }

    const result = await generateRatingLongWithGemini(params);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "Long-form rating generation failed.");
  }
}
