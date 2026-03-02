import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "../../../../lib/studio/verify-auth";
import { getCaptionUsageRemaining } from "../../../../lib/studio/caption-usage";
import { getAiUsageRemaining } from "../../../../lib/studio/ai-usage";
import { CAPTION_DAILY_LIMIT } from "../../../../lib/studio/caption-usage";

export async function GET(req: NextRequest) {
  const authResult = await verifyAuth(req.headers.get("authorization"));
  if (!authResult.ok) return authResult.response;
  const { uid } = authResult;

  const [captionRemaining, aiRemaining] = await Promise.all([
    getCaptionUsageRemaining(uid),
    getAiUsageRemaining(uid),
  ]);

  return NextResponse.json({
    captionGenerationsRemaining: captionRemaining,
    aiSuggestionsRemaining: aiRemaining,
    captionDailyLimit: CAPTION_DAILY_LIMIT,
    limitPeriod: "day",
  });
}
