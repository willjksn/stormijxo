import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/caption-suggestion
 * Body: { imageUrl?: string, bio?: string, tone?: string, length?: string, starterText?: string }
 * Returns: { caption: string }
 * Works with image+bio, bio only, starterText only (finish/expand), or image only.
 */
export async function POST(req: NextRequest) {
  let starterText = "";
  try {
    const body = await req.json().catch(() => ({}));
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    const bio = typeof body.bio === "string" ? body.bio.trim() : "";
    const tone = typeof body.tone === "string" ? body.tone.trim() : "";
    const length = typeof body.length === "string" ? body.length.trim() : "";
    starterText = typeof body.starterText === "string" ? body.starterText.trim() : "";

    const toneHint = tone ? ` Tone: ${tone}.` : "";
    const lengthHint = length === "short" ? " One short sentence." : length === "long" ? " 2-3 sentences." : "";

    const apiKey = process.env.OPENAI_API_KEY;
    const hasInput = !!(imageUrl || bio || starterText);
    if (apiKey && hasInput) {
      const messages: { role: "system" | "user"; content: string | (string | { type: "image_url"; image_url: { url: string } })[] }[] = [
        {
          role: "system",
          content:
            "You are a helpful assistant that writes short, engaging social media captions. Match the tone of the user's bio if provided. Keep captions concise (1-2 sentences). Use a flirty, premium tone suitable for a creator's feed. No hashtags unless asked." +
            toneHint +
            lengthHint,
        },
      ];
      if (imageUrl && (bio || starterText)) {
        messages.push({
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            {
              type: "text",
              text: starterText
                ? `Finish or expand this caption for this image: "${starterText}". ${bio ? `Use this personality/bio: ${bio}` : ""}`
                : `Write a caption for this image. Use this personality/bio: ${bio}`,
            },
          ] as (string | { type: "image_url"; image_url: { url: string } })[],
        });
      } else if (imageUrl) {
        messages.push({
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: "Suggest a short caption for this image." },
          ] as (string | { type: "image_url"; image_url: { url: string } })[],
        });
      } else if (starterText && bio) {
        messages.push({
          role: "user",
          content: `Finish or expand this caption idea: "${starterText}". Write in the style of this bio: ${bio}.`,
        });
      } else if (starterText) {
        messages.push({
          role: "user",
          content: `Finish or expand this caption idea into a short, engaging post: "${starterText}".`,
        });
      } else if (bio) {
        messages.push({
          role: "user",
          content: `Write a short caption in the style of this bio: ${bio}`,
        });
      }
      if (messages.length > 1) {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            max_tokens: 150,
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          console.error("OpenAI caption error:", res.status, err);
          return fallbackCaption(bio, starterText);
        }
        const data = await res.json();
        const caption = data?.choices?.[0]?.message?.content?.trim() || "";
        if (caption) return NextResponse.json({ caption });
      }
    }
    return fallbackCaption(bio, starterText);
  } catch (err) {
    console.error("caption-suggestion error:", err);
    return NextResponse.json(
      { error: "Caption suggestion failed", caption: starterText || "Share your moment ✨" },
      { status: 500 }
    );
  }
}

function fallbackCaption(bio: string, starterText?: string): NextResponse {
  if (starterText) {
    return NextResponse.json({
      caption: starterText + " ✨",
    });
  }
  if (bio) {
    const firstLine = bio.split(/\n/)[0].slice(0, 80);
    return NextResponse.json({
      caption: `Feeling this energy today. ${firstLine} ✨`,
    });
  }
  return NextResponse.json({
    caption: "Share your moment ✨",
  });
}
