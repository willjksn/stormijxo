import { promises as fs } from "node:fs";
import path from "node:path";

const ASSET_ROOT = path.join(process.cwd(), "assets");

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolved = await params;
  const requestedPath = resolved.path.join("/");
  const fullPath = path.join(ASSET_ROOT, requestedPath);
  const normalized = path.normalize(fullPath);

  if (!normalized.startsWith(path.normalize(ASSET_ROOT))) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await fs.readFile(normalized);
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(normalized),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
