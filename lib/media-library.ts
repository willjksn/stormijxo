/**
 * Media library helpers: list and upload to Firebase Storage content/media/
 * Supports folders via path prefix: content/media/ (General) and content/media/{folderId}/
 */
import {
  ref,
  list,
  getDownloadURL,
  uploadBytesResumable,
  deleteObject,
  type ListResult,
  type StorageReference,
  type UploadTaskSnapshot,
} from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";

const MEDIA_PREFIX = "content/media";

export type MediaItem = { url: string; path: string; name: string; isVideo: boolean; folderId: string };

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
    const isVideo = /\.(mp4|webm|mov|ogg)(\?|$)/i.test(name) || itemRef.fullPath.toLowerCase().includes("video");
    return { url, path: itemRef.fullPath, name, isVideo, folderId: folderId || "general" } satisfies MediaItem;
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
