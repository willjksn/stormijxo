import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "../../../../lib/studio/verify-auth";
import { generateChatSessionSummaryWithGemini } from "../../../../lib/studio/gemini-shared";
import { handleApiError } from "../../../../lib/studio/error-handler";

const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_FAN_NAME = 200;

function sanitize(body: unknown): {
  recentMessages: { role: "user" | "assistant"; content: string }[];
  fanName: string;
} {
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const raw = Array.isArray(o.recentMessages) ? o.recentMessages.slice(-MAX_MESSAGES) : [];
  const recentMessages = raw
    .map((m: unknown) => {
      if (!m || typeof m !== "object") return null;
      const row = m as Record<string, unknown>;
      const role = row.role === "assistant" ? "assistant" : "user";
      const content = typeof row.content === "string" ? row.content.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
      return content ? { role, content } : null;
    })
    .filter(Boolean) as { role: "user" | "assistant"; content: string }[];
  const fanName = typeof o.fanName === "string" ? o.fanName.trim().slice(0, MAX_FAN_NAME) : "";
  return { recentMessages, fanName };
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req.headers.get("authorization"));
    if (!authResult.ok) return authResult.response;

    const body = await req.json().catch(() => ({}));
    const { recentMessages, fanName } = sanitize(body);
    if (recentMessages.length === 0) {
      return NextResponse.json({ error: "Provide at least one message." }, { status: 400 });
    }

    const summary = await generateChatSessionSummaryWithGemini({ recentMessages, fanName: fanName || undefined });
    return NextResponse.json({ summary });
  } catch (err) {
    return handleApiError(err);
  }
}
