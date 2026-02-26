import { promises as fs } from "node:fs";
import path from "node:path";

const ASSET_ROOT = path.join(process.cwd(), "assets");
const PUBLIC_ASSETS = path.join(process.cwd(), "public", "assets");

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

async function readAsset(requestedPath: string): Promise<{ data: Buffer; contentType: string } | null> {
  const safeSegments = requestedPath.split(/[/\\]/).filter((p) => p && p !== ".." && p !== ".");
  const safePath = safeSegments.join("/");
  if (!safePath) return null;

  const fullPath = path.join(ASSET_ROOT, safePath);
  const publicPath = path.join(PUBLIC_ASSETS, safePath);
  const assetsNorm = path.normalize(ASSET_ROOT);
  const publicNorm = path.normalize(PUBLIC_ASSETS);

  try {
    const p = path.normalize(fullPath);
    if (p.startsWith(assetsNorm)) {
      const data = await fs.readFile(fullPath);
      return { data, contentType: contentTypeFor(fullPath) };
    }
  } catch {
    // try public
  }
  try {
    const p = path.normalize(publicPath);
    if (p.startsWith(publicNorm)) {
      const data = await fs.readFile(publicPath);
      return { data, contentType: contentTypeFor(publicPath) };
    }
  } catch {
    //
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolved = await params;
  const requestedPath = resolved.path.join("/");
  const result = await readAsset(requestedPath);
  if (!result) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(result.data), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const res = await GET(request, context);
  if (res.status !== 200) return res;
  return new Response(null, {
    status: 200,
    headers: Object.fromEntries(res.headers.entries()),
  });
}
