import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuthForStudio } from "../../../../lib/studio/verify-auth";
import { rateLimit } from "../../../../lib/studio/rate-limit";
import { getCaptionUsageRemaining, incrementCaptionUsage } from "../../../../lib/studio/caption-usage";
import { getFirebaseAdmin } from "../../../../lib/studio/firebase-admin";
import {
  generateCaptionsFromMedia,
  generateCaptionsWithGemini,
  fetchMediaAsBase64,
  type CaptionOption,
} from "../../../../lib/studio/gemini-shared";
import { handleApiError, structuredError, rateLimitResponse } from "../../../../lib/studio/error-handler";

const MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_INLINE_VIDEO_BYTES = 20 * 1024 * 1024;
type ParsedCaptionRequest = z.infer<typeof requestSchema>;

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
  emojiIntensity: z.union([z.number().min(0).max(10), z.string()]).optional().transform((v) => {
    if (v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : undefined;
  }),
  emoji: z.union([z.number().min(0).max(100), z.string()]).optional().transform((v) => {
    if (v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : undefined;
  }),
  creatorPersonality: z.string().optional(),
  imageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  bio: z.string().optional(),
  starterText: z.string().optional(),
  hasVideo: z.boolean().optional(),
  count: z.union([z.number().min(1).max(5), z.string()]).optional().transform((v) => {
    if (v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 1;
  }),
  postId: z.string().optional(),
  postID: z.string().optional(),
  post_id: z.string().optional(),
  id: z.string().optional(),
  urls: z.array(z.string()).optional(),
  media: z
    .array(
      z.union([
        z.string(),
        z.object({
          url: z.string().optional(),
          src: z.string().optional(),
        }),
      ])
    )
    .optional(),
  post: z
    .object({
      id: z.string().optional(),
      postId: z.string().optional(),
      post_id: z.string().optional(),
    })
    .optional(),
});

function getMediaUrlsFromBody(body: ParsedCaptionRequest): string[] {
  const single = body.mediaUrl ?? body.imageUrl;
  const list = body.mediaUrls ?? body.imageUrls ?? body.urls ?? [];
  const fromMediaArray = Array.isArray(body.media)
    ? body.media
        .map((m) =>
          typeof m === "string"
            ? m
            : typeof m?.url === "string"
              ? m.url
              : typeof m?.src === "string"
                ? m.src
                : ""
        )
        .filter(Boolean)
    : [];
  const combined = [
    ...(single && typeof single === "string" ? [single] : []),
    ...(Array.isArray(list) ? list : []),
    ...fromMediaArray,
  ];
  const seen = new Set<string>();
  return combined
    .filter((u) => typeof u === "string" && u.trim().startsWith("http"))
    .map((u) => u.trim())
    .filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
}

function getPostIdFromBody(body: ParsedCaptionRequest, req: NextRequest): string {
  const queryPostId = req.nextUrl.searchParams.get("postId") ?? "";
  const postIdCandidates = [
    body.postId,
    body.postID,
    body.post_id,
    body.id,
    body.post?.postId,
    body.post?.post_id,
    body.post?.id,
    queryPostId,
  ];
  return (postIdCandidates.find((v) => typeof v === "string" && v.trim().length > 0) ?? "").trim();
}

function getRequestId(req: NextRequest): string {
  const fromHeader = req.headers.get("x-request-id");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function jsonWithRequestId(
  requestId: string,
  body: unknown,
  init?: ResponseInit
): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("x-request-id", requestId);
  return response;
}

type NormalizedCaptionRequest = {
  postId: string;
  mediaUrls: string[];
  mediaData?: { data: string; mimeType: string };
  goal?: string;
  tone?: string;
  promptText: string;
  platforms?: string[];
  emojiEnabled?: boolean;
  emojiIntensity?: number;
  creatorPersonality?: string;
  hasVideo: boolean;
  count: number;
};

function normalizeCaptionRequest(body: ParsedCaptionRequest, req: NextRequest): NormalizedCaptionRequest {
  const promptText = (body.promptText ?? body.starterText ?? "").trim();
  const goal = typeof body.goal === "string" && body.goal.trim() ? body.goal.trim() : undefined;
  const tone = typeof body.tone === "string" && body.tone.trim() ? body.tone.trim() : undefined;
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.map((p) => String(p).trim()).filter(Boolean)
    : undefined;

  return {
    postId: getPostIdFromBody(body, req),
    mediaUrls: getMediaUrlsFromBody(body),
    mediaData: body.mediaData,
    goal,
    tone,
    promptText,
    platforms,
    emojiEnabled: body.emojiEnabled,
    emojiIntensity:
      typeof body.emojiIntensity === "number"
        ? body.emojiIntensity
        : typeof body.emoji === "number"
          ? Math.round(body.emoji / 10)
          : undefined,
    creatorPersonality: body.creatorPersonality ?? body.bio,
    hasVideo: body.hasVideo ?? false,
    count: body.count ?? 5,
  };
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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const startedAt = Date.now();
  try {
    const authResult = await verifyAuthForStudio(req.headers.get("authorization"));
    if (!authResult.ok) {
      authResult.response.headers.set("x-request-id", requestId);
      return authResult.response;
    }
    const { uid } = authResult;

    const rl = await rateLimit(uid, "captions", 30, 60_000);
    if (!rl.allowed) {
      const response = rateLimitResponse(rl.resetAt - Date.now());
      response.headers.set("x-request-id", requestId);
      return response;
    }

    const remaining = await getCaptionUsageRemaining(uid);
    if (remaining <= 0) {
      const response = structuredError({
        code: "rate_limit",
        message: "Daily caption limit reached. Try again tomorrow.",
        status: 429,
      });
      response.headers.set("x-request-id", requestId);
      return response;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("[generate-captions]", requestId, "400: Invalid JSON body", parseErr);
      return jsonWithRequestId(
        requestId,
        { error: "Invalid request", message: "Request body must be valid JSON.", requestId },
        { status: 400 }
      );
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const firstMsg = issues[0]?.message ?? "Invalid request body.";
      console.error("[generate-captions]", requestId, "400: Schema validation failed", {
        message: firstMsg,
        issues,
      });
      return jsonWithRequestId(
        requestId,
        { error: "Invalid request", message: firstMsg, details: issues, requestId },
        { status: 400 }
      );
    }

    const normalized = normalizeCaptionRequest(parsed.data, req);
    if (process.env.NODE_ENV !== "test") {
      console.info("[generate-captions]", requestId, "start", {
        uid,
        hasMediaUrls: normalized.mediaUrls.length > 0,
        hasInlineMedia: Boolean(normalized.mediaData?.data && normalized.mediaData?.mimeType),
        hasPrompt: normalized.promptText.length > 0,
        hasPostId: Boolean(normalized.postId),
      });
    }

    let mediaUrls = normalized.mediaUrls;
    const mediaData = normalized.mediaData;
    let hasUrls = mediaUrls.length > 0;
    const hasInline = !!mediaData?.data && !!mediaData?.mimeType;
    let textPrompt = normalized.promptText;
    let hasTextPrompt = textPrompt.length > 0;
    const postId = normalized.postId;

    if (!hasUrls && !hasInline && !hasTextPrompt && postId) {
      try {
        const { db } = getFirebaseAdmin();
        const postSnap = await db.collection("posts").doc(postId).get();
        if (postSnap.exists) {
          const postData = postSnap.data() as
            | {
                mediaUrl?: string;
                mediaUrls?: string[];
                imageUrl?: string;
                imageUrls?: string[];
                body?: string;
                caption?: string;
              }
            | undefined;

          const postUrls = [
            postData?.mediaUrl,
            ...(Array.isArray(postData?.mediaUrls) ? postData.mediaUrls : []),
            postData?.imageUrl,
            ...(Array.isArray(postData?.imageUrls) ? postData.imageUrls : []),
          ].filter((u): u is string => typeof u === "string" && u.trim().startsWith("http"));

          if (postUrls.length > 0) {
            mediaUrls = postUrls;
            hasUrls = true;
          }

          if (!hasTextPrompt) {
            const postPrompt = (postData?.body ?? postData?.caption ?? "").trim();
            if (postPrompt) {
              textPrompt = postPrompt;
              hasTextPrompt = true;
            }
          }
        }
      } catch (postLookupErr) {
        console.warn("[generate-captions]", requestId, "post lookup failed for fallback", {
          postId,
          postLookupErr,
        });
      }
    }

    if (!hasUrls && !hasInline && !hasTextPrompt) {
      textPrompt = "Write a short engaging social caption with a playful tone.";
      hasTextPrompt = true;
      if (process.env.NODE_ENV !== "test") {
        console.warn("[generate-captions]", requestId, "fallback_text_mode: no_media_no_prompt");
      }
    }

    const mediaParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];

    if (hasInline) {
      const sizeCheck = validateInlineMediaSize(mediaData!.data, mediaData!.mimeType);
      if (!sizeCheck.ok) {
        const isTooLarge = sizeCheck.message.includes("too large");
        console.error("[generate-captions]", requestId, "400: Inline media size check failed", {
          mimeType: mediaData!.mimeType,
          message: sizeCheck.message,
        });
        return jsonWithRequestId(
          requestId,
          { error: "Invalid request", message: sizeCheck.message, requestId },
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
      let mediaFetchFailures = 0;
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
          const msg = e instanceof Error ? e.message : String(e);
          mediaFetchFailures += 1;
          console.error("[generate-captions]", requestId, "media fetch failed", {
            url: url.slice(0, 100),
            error: msg,
          });
          continue;
        }
      }

      if (mediaFetchFailures > 0 && process.env.NODE_ENV !== "test") {
        console.warn("[generate-captions]", requestId, "media_fetch_partial_failures", {
          attempted: Math.min(mediaUrls.length, 5),
          failed: mediaFetchFailures,
          loaded: mediaParts.length,
        });
      }
    }

    if (mediaParts.length === 0 && !hasTextPrompt) {
      textPrompt = normalized.promptText || "Write a short engaging social caption with a playful tone.";
      hasTextPrompt = true;
      if (process.env.NODE_ENV !== "test") {
        console.warn("[generate-captions]", requestId, "fallback_text_mode: media_fetch_failed");
      }
    }

    let options: CaptionOption[];
    try {
      if (mediaParts.length > 0) {
        options = await generateCaptionsFromMedia({
          mediaParts,
          goal: normalized.goal ?? textPrompt,
          tone: normalized.tone,
          promptText: textPrompt || undefined,
          creatorPersonality: normalized.creatorPersonality,
          platforms: normalized.platforms,
          emojiEnabled: normalized.emojiEnabled,
          emojiIntensity: normalized.emojiIntensity,
          count: normalized.count,
        });
      } else {
        const textCaptions = await generateCaptionsWithGemini({
          imageUrls: [],
          hasVideo: normalized.hasVideo,
          bio: normalized.creatorPersonality ?? "",
          tone: normalized.tone ?? "flirty",
          length: "medium",
          starterText: textPrompt,
          count: normalized.count,
          emoji:
            typeof normalized.emojiIntensity === "number"
              ? Math.round(normalized.emojiIntensity * 10)
              : undefined,
        });
        options = textCaptions.map((caption) => ({ caption, hashtags: [] as string[] }));
      }
    } catch (geminiErr) {
      console.error("[generate-captions]", requestId, "Gemini error:", geminiErr);
      const mapped = mapGeminiErrorToResponse(geminiErr);
      if (mapped) {
        mapped.headers.set("x-request-id", requestId);
        return mapped;
      }
      const response = handleApiError(geminiErr, "Caption generation failed.");
      response.headers.set("x-request-id", requestId);
      return response;
    }

    await incrementCaptionUsage(uid);

    const response = options.map((o) => ({
      caption: o.caption,
      hashtags: [] as string[],
    }));
    // Never return empty array so client always gets at least one caption (e.g. if parse failed)
    const safeResponse =
      response.length > 0
        ? response
        : [{ caption: "Share your moment ✨", hashtags: [] as string[] }];
    if (process.env.NODE_ENV !== "test") {
      console.info("[generate-captions]", requestId, "response", {
        count: safeResponse.length,
        elapsedMs: Date.now() - startedAt,
        parsePath: "normalized_array",
      });
    }
    return jsonWithRequestId(requestId, safeResponse);
  } catch (err) {
    console.error("[generate-captions]", requestId, err);
    const response = handleApiError(err);
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
