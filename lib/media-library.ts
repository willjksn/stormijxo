/**
 * Media library helpers: list and upload to Firebase Storage content/media/
 * Supports folders via path prefix: content/media/ (General) and content/media/{folderId}/
 */
import {
  ref,
  listAll,
  getDownloadURL,
  uploadBytesResumable,
  deleteObject,
  type ListResult,
  type UploadTaskSnapshot,
} from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";

const MEDIA_PREFIX = "content/media";

export type MediaItem = { url: string; path: string; name: string; isVideo: boolean; folderId: string };

/** List items in a folder. folderId empty = root (General). */
export async function listMediaLibrary(
  storage: FirebaseStorage,
  folderId: string = ""
): Promise<MediaItem[]> {
  const path = folderId ? `${MEDIA_PREFIX}/${folderId}` : MEDIA_PREFIX;
  const listRef = ref(storage, path);
  const result: ListResult = await listAll(listRef);
  const items: MediaItem[] = [];
  for (const itemRef of result.items) {
    try {
      const url = await getDownloadURL(itemRef);
      const name = itemRef.name;
      const isVideo = /\.(mp4|webm|mov|ogg)(\?|$)/i.test(name) || itemRef.fullPath.toLowerCase().includes("video");
      items.push({ url, path: itemRef.fullPath, name, isVideo, folderId: folderId || "general" });
    } catch {
      // skip failed
    }
  }
  return items.reverse();
}

/** List all items across root and all folder paths. */
export async function listMediaLibraryAll(
  storage: FirebaseStorage,
  folderIds: string[]
): Promise<MediaItem[]> {
  const all: MediaItem[] = [];
  const root = await listMediaLibrary(storage, "");
  root.forEach((i) => all.push({ ...i, folderId: "general" }));
  for (const fid of folderIds) {
    if (!fid || fid === "general") continue;
    const inFolder = await listMediaLibrary(storage, fid);
    all.push(...inFolder);
  }
  return all;
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
