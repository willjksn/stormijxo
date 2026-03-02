import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "../../../../lib/studio/verify-auth";
import { rateLimit } from "../../../../lib/studio/rate-limit";
import { analyzeMediaWithGemini } from "../../../../lib/studio/gemini-shared";
import { handleApiError, badRequest, rateLimitResponse } from "../../../../lib/studio/error-handler";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req.headers.get("authorization"));
    if (!authResult.ok) return authResult.response;
    const { uid } = authResult;

    const rl = await rateLimit(uid, "analyze_media", 15, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt - Date.now());

    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file") ?? formData?.get("image") ?? formData?.get("video");
    if (!file || !(file instanceof File)) {
      return badRequest("Missing file. Send a multipart form with 'file', 'image', or 'video'.");
    }

    const mime = (file.type || "").toLowerCase();
    const isImage = ALLOWED_IMAGE_TYPES.includes(mime);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(mime);
    if (!isImage && !isVideo) {
      return badRequest(`Unsupported type. Use image (${ALLOWED_IMAGE_TYPES.join(", ")}) or video (${ALLOWED_VIDEO_TYPES.join(", ")}).`);
    }

    const bytes = await file.arrayBuffer();
    const size = bytes.byteLength;
    if (isImage && size > MAX_IMAGE_BYTES) {
      return badRequest(`Image too large. Max ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`);
    }
    if (isVideo && size > MAX_VIDEO_BYTES) {
      return badRequest(`Video too large. Max ${MAX_VIDEO_BYTES / 1024 / 1024}MB.`);
    }

    const base64 = Buffer.from(bytes).toString("base64");
    const description = await analyzeMediaWithGemini({ data: base64, mimeType: mime });
    return NextResponse.json({ description });
  } catch (err) {
    return handleApiError(err, "Media analysis failed.");
  }
}
