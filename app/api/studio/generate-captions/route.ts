import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuthForStudio } from "../../../../lib/studio/verify-auth";
import { rateLimit } from "../../../../lib/studio/rate-limit";
import { getCaptionUsageRemaining, incrementCaptionUsage } from "../../../../lib/studio/caption-usage";
import {
  generateCaptionsFromMedia,
  fetchMediaAsBase64,
  type CaptionOption,
} from "../../../../lib/studio/gemini-shared";
import { handleApiError, structuredError, rateLimitResponse } from "../../../../lib/studio/error-handler";

const MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_INLINE_VIDEO_BYTES = 20 * 1024 * 1024;

const requestSchema = z.object({
  mediaUrl: z.string().optional(),
  mediaUrls: z.array(z.string()).optional(),
  mediaData: z
    .object({
      data: z.string(),
      mimeType: z.string().min(1),
    })
    .optional(),
  goal: z.string().optional(),
  tone: z.string().optional(),
  promptText: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  emojiEnabled: z.boolean().optional(),
  emojiIntensity: z.number().min(0).max(10).optional(),
  emoji: z.number().min(0).max(100).optional(),
  creatorPersonality: z.string().optional(),
  imageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  bio: z.string().optional(),
  starterText: z.string().optional(),
  hasVideo: z.boolean().optional(),
  count: z.number().min(1).max(5).optional(),
});

function getMediaUrlsFromBody(body: z.infer<typeof requestSchema>): string[] {
  const single = body.mediaUrl ?? body.imageUrl;
  const list = body.mediaUrls ?? body.imageUrls ?? [];
  const combined = single && typeof single === "string" && single.startsWith("http") ? [single, ...(Array.isArray(list) ? list : [])] : Array.isArray(list) ? list : [];
  return combined.filter((u) => typeof u === "string" && u.trim().startsWith("http"));
}

function validateInlineMediaSize(
  data: string,
  mimeType: string
): { ok: true } | { ok: false; message: string } {
  try {
    const buf = Buffer.from(data, "base64");
    const bytes = buf.byteLength;
    const isVideo = /video\//i.test(mimeType);
    const max = isVideo ? MAX_INLINE_VIDEO_BYTES : MAX_INLINE_IMAGE_BYTES;
    if (bytes > max) {
      return {
        ok: false,
        message: `Inline media too large: ${bytes} bytes (max ${isVideo ? "20MB" : "4MB"}). Use mediaUrl instead.`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Invalid base64 in mediaData.data." };
  }
}

function mapGeminiErrorToResponse(err: unknown): NextResponse | null {
  const message = err instanceof Error ? err.message : String(err);
  const isModelMissing =
    /models\/.+is not found|not supported for generateContent|model not found for candidates|NOT_FOUND/i.test(
      message
    );
  if (isModelMissing) {
    return NextResponse.json(
      {
        error: "service_unavailable",
        message:
          "Caption AI model is unavailable for this API key/project. Verify your Gemini key has access to supported models and Generative Language API is enabled.",
      },
      { status: 503 }
    );
  }
  const isReferrerBlocked =
    /API_KEY_HTTP_REFERRER_BLOCKED|Requests from referer <empty> are blocked|referer/i.test(
      message
    );
  if (isReferrerBlocked) {
    return NextResponse.json(
      {
        error: "service_unavailable",
        message:
          "Caption AI key is restricted to browser referrers, but this endpoint runs server-side. In Google Cloud Credentials, remove HTTP referrer restriction for this key or use a server key.",
      },
      { status: 503 }
    );
  }
  const isServiceDisabled =
    /SERVICE_DISABLED|Generative Language API has not been used|generativelanguage\.googleapis\.com/i.test(
      message
    );
  if (isServiceDisabled) {
    return NextResponse.json(
      {
        error: "service_unavailable",
        message:
          "Caption AI is not configured yet: Generative Language API is disabled for the current Google project. Enable it in Google Cloud Console and try again.",
      },
      { status: 503 }
    );
  }
  const isPermissionDenied = /PERMISSION_DENIED|403/i.test(message);
  if (isPermissionDenied) {
    return NextResponse.json(
      {
        error: "service_unavailable",
        message:
          "Caption AI is temporarily unavailable due to Gemini API permission settings. Please verify the API key/project and retry.",
      },
      { status: 503 }
    );
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuthForStudio(req.headers.get("authorization"));
    if (!authResult.ok) return authResult.response;
    const { uid } = authResult;

    const rl = await rateLimit(uid, "captions", 30, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt - Date.now());

    const remaining = await getCaptionUsageRemaining(uid);
    if (remaining <= 0) {
      return structuredError({
        code: "rate_limit",
        message: "Daily caption limit reached. Try again tomorrow.",
        status: 429,
      });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request", message: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const firstMsg = issues[0]?.message ?? "Invalid request body.";
      return NextResponse.json(
        { error: "Invalid request", message: firstMsg, details: issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (process.env.NODE_ENV !== "test") {
      console.info("[generate-captions] request keys:", Object.keys(data).join(", "));
    }

    const mediaUrls = getMediaUrlsFromBody(data);
    const mediaData = data.mediaData;
    const hasUrls = mediaUrls.length > 0;
    const hasInline = !!mediaData?.data && !!mediaData?.mimeType;

    if (!hasUrls && !hasInline) {
      return NextResponse.json(
        {
          error: "Invalid request",
          message: "Add at least one image or video to the post, or send mediaUrl/mediaUrls/mediaData.",
        },
        { status: 400 }
      );
    }

    const mediaParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];

    if (hasInline) {
      const sizeCheck = validateInlineMediaSize(mediaData!.data, mediaData!.mimeType);
      if (!sizeCheck.ok) {
        const isTooLarge = sizeCheck.message.includes("too large");
        if (process.env.NODE_ENV !== "test") {
          console.info("[generate-captions] media type (inline):", mediaData!.mimeType, "size_check:", sizeCheck.ok ? "ok" : sizeCheck.message);
        }
        return NextResponse.json(
          { error: "Invalid request", message: sizeCheck.message },
          { status: isTooLarge ? 413 : 400 }
        );
      }
      if (process.env.NODE_ENV !== "test") {
        console.info("[generate-captions] media type (inline):", mediaData!.mimeType);
      }
      mediaParts.push({
        inlineData: { mimeType: mediaData!.mimeType, data: mediaData!.data },
      });
    }

    if (hasUrls) {
      for (const url of mediaUrls.slice(0, 5)) {
        try {
          const { data: fetchedData, mimeType } = await fetchMediaAsBase64(
            url,
            MAX_INLINE_IMAGE_BYTES,
            MAX_INLINE_VIDEO_BYTES
          );
          if (process.env.NODE_ENV !== "test") {
            console.info("[generate-captions] media type (url):", mimeType, "url:", url.slice(0, 80) + "...");
          }
          mediaParts.push({ inlineData: { mimeType, data: fetchedData } });
        } catch (e) {
          console.warn("[generate-captions] fetch media failed:", url, e);
          const isTooLarge = e instanceof Error && e.message.includes("too large");
          return NextResponse.json(
            {
              error: "Invalid request",
              message: e instanceof Error ? e.message : "Could not load image or video from URL. Use a public URL or upload media first.",
            },
            { status: isTooLarge ? 413 : 400 }
          );
        }
      }
    }

    if (mediaParts.length === 0) {
      return NextResponse.json(
        {
          error: "Invalid request",
          message: "No image or video could be loaded from the URLs. Check that links are public and accessible.",
        },
        { status: 400 }
      );
    }

    let options: CaptionOption[];
    try {
      options = await generateCaptionsFromMedia({
        mediaParts,
        goal: data.goal ?? data.starterText ?? data.promptText,
        tone: data.tone,
        promptText: data.promptText ?? data.starterText,
        creatorPersonality: data.creatorPersonality ?? data.bio,
        platforms: data.platforms,
        emojiEnabled: data.emojiEnabled,
        emojiIntensity: data.emojiIntensity ?? (typeof data.emoji === "number" ? Math.round(data.emoji / 10) : undefined),
        count: data.count ?? 5,
      });
    } catch (geminiErr) {
      console.error("[generate-captions] Gemini error:", geminiErr);
      const mapped = mapGeminiErrorToResponse(geminiErr);
      if (mapped) return mapped;
      return handleApiError(geminiErr, "Caption generation failed.");
    }

    await incrementCaptionUsage(uid);

    const response = options.map((o) => ({
      caption: o.caption,
      hashtags: [] as string[],
    }));
    if (process.env.NODE_ENV !== "test") {
      console.info("[generate-captions] response count:", response.length, "parse_path: normalized_array");
    }
    return NextResponse.json(response);
  } catch (err) {
    console.error("[generate-captions]", err);
    return handleApiError(err);
  }
}
