/**
 * Media library helpers: list and upload to Firebase Storage content/media/
 * Supports folders via path prefix: content/media/ (General) and content/media/{folderId}/
 */
import {
  ref,
  list,
  getDownloadURL,
  getBlob,
  uploadBytes,
  uploadBytesResumable,
  deleteObject,
  type ListResult,
  type StorageReference,
  type UploadTaskSnapshot,
} from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";

const MEDIA_PREFIX = "content/media";
const USED_PREFIX = "content/used";

export type MediaItem = { url: string; path: string; name: string; isVideo: boolean; isAudio: boolean; folderId: string };

/** Extract storage path from a Firebase Storage download URL, or null. */
export function pathFromStorageUrl(url: string): string | null {
  const marker = "/o/";
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  const encoded = url.slice(idx + marker.length).split("?")[0];
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/** True if path is under content/media/ (library), not content/used/. */
export function isLibraryPath(path: string | null): boolean {
  if (!path) return false;
  const p = path.toLowerCase();
  return p.startsWith("content/media/") && !p.startsWith("content/used/");
}

const LIST_PAGE_SIZE = 1000;
const URL_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const urlCache = new Map<string, { url: string; expiresAt: number }>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listAllItemsPaged(listRef: StorageReference): Promise<ListResult["items"]> {
  const items: ListResult["items"] = [];
  let pageToken: string | undefined = undefined;
  do {
    const page = await list(listRef, {
      maxResults: LIST_PAGE_SIZE,
      ...(pageToken ? { pageToken } : {}),
    });
    items.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

async function getDownloadURLWithRetry(itemRef: StorageReference): Promise<string | null> {
  const cached = urlCache.get(itemRef.fullPath);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const url = await getDownloadURL(itemRef);
      urlCache.set(itemRef.fullPath, {
        url,
        expiresAt: Date.now() + URL_CACHE_TTL_MS,
      });
      return url;
    } catch {
      if (attempt === maxAttempts) return null;
      await sleep(120 * attempt);
    }
  }
  return null;
}

async function mapWithConcurrency<TIn, TOut>(
  input: TIn[],
  concurrency: number,
  mapper: (value: TIn, index: number) => Promise<TOut>
): Promise<TOut[]> {
  const out: TOut[] = new Array(input.length);
  let index = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, input.length)) }, async () => {
    while (index < input.length) {
      const current = index++;
      out[current] = await mapper(input[current], current);
    }
  });
  await Promise.all(workers);
  return out;
}

/** List items in a folder. folderId empty = root (General). */
export async function listMediaLibrary(
  storage: FirebaseStorage,
  folderId: string = ""
): Promise<MediaItem[]> {
  const path = folderId ? `${MEDIA_PREFIX}/${folderId}` : MEDIA_PREFIX;
  const listRef = ref(storage, path);
  const refs = await listAllItemsPaged(listRef);
  const items = await mapWithConcurrency(refs, 12, async (itemRef) => {
    const url = await getDownloadURLWithRetry(itemRef);
    if (!url) return null;
    const name = itemRef.name;
    const nameLower = name.toLowerCase();
    const isAudio =
      /\.(mp3|m4a|wav|opus|aac|flac)(\?|$)/i.test(name) ||
      /post-voice-|voice-note-/i.test(name) ||
      (/\.(webm|ogg)(\?|$)/i.test(name) && /voice|post-voice|voice-note/i.test(nameLower));
    const isVideo =
      !isAudio &&
      (/\.(mp4|webm|mov|ogg|m4v|mkv|avi|wmv|mpeg|mpg)(\?|$)/i.test(url) ||
        /\.(mp4|webm|mov|ogg|m4v|mkv|avi|wmv|mpeg|mpg)(\?|$)/i.test(name) ||
        itemRef.fullPath.toLowerCase().includes("video"));
    return { url, path: itemRef.fullPath, name, isVideo, isAudio, folderId: folderId || "general" } satisfies MediaItem;
  });
  return items.filter((item): item is MediaItem => item !== null).reverse();
}

/** List all items across root and all folder paths. */
export async function listMediaLibraryAll(
  storage: FirebaseStorage,
  folderIds: string[]
): Promise<MediaItem[]> {
  const uniqueFolders = Array.from(
    new Set(folderIds.map((fid) => (fid === "general" ? "" : fid)).filter((fid) => fid !== undefined))
  );
  const lists = await Promise.all(
    uniqueFolders.map((fid) => listMediaLibrary(storage, fid || ""))
  );
  return lists.flat();
}

/** Return per-folder counts without resolving download URLs (faster for sidebar badges). */
export async function listMediaLibraryCounts(
  storage: FirebaseStorage,
  folderIds: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const uniqueFolders = Array.from(
    new Set(folderIds.map((fid) => (fid === "general" ? "" : fid)))
  );

  const listResults = await Promise.all(
    uniqueFolders.map(async (fid) => {
      const path = fid ? `${MEDIA_PREFIX}/${fid}` : MEDIA_PREFIX;
      const refs = await listAllItemsPaged(ref(storage, path));
      return { folderId: fid || "general", count: refs.length };
    })
  );

  listResults.forEach(({ folderId, count }) => {
    counts[folderId] = count;
  });
  return counts;
}

export function uploadToMediaLibrary(
  storage: FirebaseStorage,
  file: File,
  onProgress?: (percent: number) => void,
  folderId: string = ""
): Promise<string> {
  const ext = file.name.replace(/^.*\./, "") || "bin";
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const path = folderId ? `${MEDIA_PREFIX}/${folderId}/${safeName}` : `${MEDIA_PREFIX}/${safeName}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type || undefined,
    customMetadata: { originalName: file.name },
  });
  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap: UploadTaskSnapshot) => {
        const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
        onProgress?.(pct);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

/** Delete one or more items by full storage path. */
export async function deleteMediaLibrary(
  storage: FirebaseStorage,
  paths: string[]
): Promise<void> {
  await Promise.all(paths.map((path) => deleteObject(ref(storage, path))));
}

/**
 * Move one or more items to a different folder. Downloads each file, uploads to
 * content/media/{targetFolderId}/{filename}, then deletes the original.
 * Use targetFolderId "" for General. Returns the new paths.
 */
export async function moveMediaLibrary(
  storage: FirebaseStorage,
  paths: string[],
  targetFolderId: string,
  onProgress?: (current: number, total: number, path: string) => void
): Promise<string[]> {
  const newPaths: string[] = [];
  const targetPrefix = targetFolderId ? `${MEDIA_PREFIX}/${targetFolderId}` : MEDIA_PREFIX;

  for (let i = 0; i < paths.length; i++) {
    const fromPath = paths[i]!;
    onProgress?.(i + 1, paths.length, fromPath);

    const fromRef = ref(storage, fromPath);
    let blob: Blob;
    try {
      blob = await getBlob(fromRef);
    } catch (downloadErr) {
      const msg = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
      const isCors = /cors|Access-Control|Failed to fetch|NetworkError|ERR_FAILED/i.test(msg) || (typeof msg === "string" && msg.includes("fetch"));
      if (isCors) {
        throw new Error(
          "Storage request was blocked by CORS. Configure CORS on your Firebase Storage bucket (see docs/STORAGE_CORS.md or storage-cors.json in the project root), then try again."
        );
      }
      throw new Error(`Could not download file: ${msg}`);
    }

    const fileName = fromPath.split("/").pop() || fromPath.replace(/^.*\//, "");
    const toPath = `${targetPrefix}/${fileName}`;
    const toRef = ref(storage, toPath);

    const contentType = blob.type || getContentTypeFromName(fileName);
    try {
      await uploadBytes(toRef, blob, {
        contentType: contentType || undefined,
        customMetadata: { originalName: fileName },
      });
    } catch (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
      throw new Error(`Upload to folder failed: ${msg}`);
    }

    try {
      await deleteObject(fromRef);
    } catch (deleteErr) {
      const msg = deleteErr instanceof Error ? deleteErr.message : String(deleteErr);
      throw new Error(`Upload succeeded but could not remove original: ${msg}`);
    }

    newPaths.push(toPath);
    urlCache.delete(fromPath);
  }
  return newPaths;
}

function getContentTypeFromName(fileName: string): string {
  const ext = fileName.replace(/^.*\./, "").toLowerCase();
  const types: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    ogg: "video/ogg",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
  };
  return types[ext] || "";
}

/**
 * Copy any library URLs (content/media/...) to content/used/{postId}_{index}_{filename}
 * so the post has its own copy and deleting from the library won't break the feed.
 * URLs already under content/used/ are returned as-is. Returns new URLs in same order.
 */
export async function copyLibraryUrlsToUsed(
  storage: FirebaseStorage,
  urls: string[],
  postId: string
): Promise<string[]> {
  const result: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    const path = pathFromStorageUrl(url);
    if (!path || !isLibraryPath(path)) {
      result.push(url);
      continue;
    }
    const fromRef = ref(storage, path);
    let blob: Blob;
    try {
      blob = await getBlob(fromRef);
    } catch {
      result.push(url);
      continue;
    }
    const fileName = path.split("/").pop() || `item-${i}`;
    const safeName = `${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const toPath = `${USED_PREFIX}/${postId}_${i}_${safeName}`;
    const toRef = ref(storage, toPath);
    const contentType = blob.type || getContentTypeFromName(fileName);
    await uploadBytes(toRef, blob, {
      contentType: contentType || undefined,
      customMetadata: { originalName: fileName },
    });
    const newUrl = await getDownloadURL(toRef);
    result.push(newUrl);
  }
  return result;
}
