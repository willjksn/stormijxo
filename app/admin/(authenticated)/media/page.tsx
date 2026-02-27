"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseStorage } from "../../../../lib/firebase";
import {
  listMediaLibrary,
  listMediaLibraryCounts,
  uploadToMediaLibrary,
  moveMediaLibrary,
  type MediaItem,
} from "../../../../lib/media-library";
import { LazyMediaImage } from "../../../components/LazyMediaImage";

function VoiceIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function VideoCardPreview({ url }: { url: string }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className="admin-media-card-video-fallback">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="admin-media-card-video-fallback-icon" aria-hidden>
          <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
          <path d="M10 9l5 3-5 3V9z" />
        </svg>
        <span>Video</span>
      </div>
    );
  }
  return (
    <video
      src={url}
      muted
      playsInline
      preload="metadata"
      className="admin-media-card-media"
      onError={() => setError(true)}
    />
  );
}

const MEDIA_COLLECTION = "mediaLibrary";
const MEDIA_CONFIG_DOC = "config";
const GENERAL_ID = "general";

type FolderMeta = { id: string; name: string };

function storagePathFromUrl(url: string): string | null {
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

function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "folder";
}

export default function AdminMediaPage() {
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();
  const [folders, setFolders] = useState<FolderMeta[]>([{ id: GENERAL_ID, name: "General" }]);
  const [currentFolderId, setCurrentFolderId] = useState<string>(GENERAL_ID);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({ general: 0 });
  const [filter, setFilter] = useState<"all" | "images" | "videos" | "voice_notes">("all");
  const [addFolderName, setAddFolderName] = useState("");
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string>(GENERAL_ID);
  const [moving, setMoving] = useState(false);
  const addFolderButtonRef = useRef<HTMLButtonElement | null>(null);
  const addFolderPanelRef = useRef<HTMLDivElement | null>(null);

  const loadFolders = useCallback(async () => {
    if (!db) return;
    const snap = await getDoc(doc(db, MEDIA_COLLECTION, MEDIA_CONFIG_DOC));
    const data = snap.data();
    const list = (data?.folders as FolderMeta[] | undefined) || [];
    setFolders([{ id: GENERAL_ID, name: "General" }, ...list.filter((f) => f.id !== GENERAL_ID)]);
  }, [db]);

  const loadLibrary = useCallback(async () => {
    if (!storage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const folderId = currentFolderId === GENERAL_ID ? "" : currentFolderId;
      const items = await listMediaLibrary(storage, folderId);
      setLibrary(items);
    } catch {
      setLibrary([]);
    } finally {
      setLoading(false);
    }
  }, [storage, currentFolderId]);

  const loadFolderCounts = useCallback(async () => {
    if (!storage) return;
    try {
      const folderIds = folders.map((f) => (f.id === GENERAL_ID ? "general" : f.id));
      const counts = await listMediaLibraryCounts(storage, folderIds);
      setFolderCounts(counts);
    } catch {
      // Keep last known counts on transient failures.
    }
  }, [storage, folders]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    loadFolderCounts();
  }, [loadFolderCounts]);

  useEffect(() => {
    setSelectedPaths(new Set());
  }, [currentFolderId, filter]);

  useEffect(() => {
    if (!message || message.type !== "success") return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    if (!showAddFolder) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (addFolderButtonRef.current?.contains(target)) return;
      if (addFolderPanelRef.current?.contains(target)) return;
      setShowAddFolder(false);
      setAddFolderName("");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAddFolder(false);
        setAddFolderName("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showAddFolder]);

  const filteredItems =
    filter === "videos"
      ? library.filter((i) => i.isVideo)
      : filter === "images"
        ? library.filter((i) => !i.isVideo && !i.isAudio)
        : filter === "voice_notes"
          ? library.filter((i) => i.isAudio)
          : library;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !storage) return;
    setUploading(true);
    setMessage(null);
    const file = files[0];
    const folderPath = currentFolderId === GENERAL_ID || currentFolderId === "all" ? "" : currentFolderId;
    uploadToMediaLibrary(storage, file, setUploadProgress, folderPath)
      .then(() => {
        setMessage({ type: "success", text: `${file.name} added.` });
        loadLibrary();
        loadFolderCounts();
      })
      .catch((err) => setMessage({ type: "error", text: (err as Error).message || "Upload failed" }))
      .finally(() => {
        setUploading(false);
        setUploadProgress(0);
        e.target.value = "";
      });
  };

  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedPaths.size === filteredItems.length) setSelectedPaths(new Set());
    else setSelectedPaths(new Set(filteredItems.map((i) => i.path)));
  };

  const getInUseMediaPaths = useCallback(async (): Promise<Set<string>> => {
    const inUse = new Set<string>();
    if (!db) return inUse;
    const postsSnap = await getDocs(collection(db, "posts"));
    postsSnap.forEach((postDoc) => {
      const data = postDoc.data() as Record<string, unknown>;
      const mediaUrls = Array.isArray(data.mediaUrls) ? (data.mediaUrls as unknown[]) : [];
      mediaUrls.forEach((urlRaw) => {
        if (typeof urlRaw !== "string") return;
        const path = storagePathFromUrl(urlRaw);
        if (path) inUse.add(path);
      });
      const audioUrls = Array.isArray(data.audioUrls) ? (data.audioUrls as unknown[]) : [];
      audioUrls.forEach((urlRaw) => {
        if (typeof urlRaw !== "string") return;
        const path = storagePathFromUrl(urlRaw);
        if (path) inUse.add(path);
      });
    });
    const contentSnap = await getDoc(doc(db, "site_config", "content"));
    if (contentSnap.exists()) {
      const content = contentSnap.data() as Record<string, unknown>;
      [
        content.tipPageHeroImageUrl,
        content.aboutStormiJImageUrl,
        content.aboutStormiJVideoUrl,
      ].forEach((urlRaw) => {
        if (typeof urlRaw !== "string") return;
        const path = storagePathFromUrl(urlRaw);
        if (path) inUse.add(path);
      });
    }
    return inUse;
  }, [db]);

  const handleDeleteSelected = async () => {
    if (!storage || selectedPaths.size === 0) return;
    try {
      const selected = Array.from(selectedPaths);
      const inUsePaths = await getInUseMediaPaths();
      const blockedCount = selected.filter((path) => inUsePaths.has(path)).length;
      const deletable = selected.filter((path) => !inUsePaths.has(path));
      if (deletable.length === 0) {
        setMessage({ type: "error", text: "Selected media is currently used by feed/content and cannot be deleted." });
        return;
      }
      // Keep feed/content safe by never deleting files still referenced in posts/site content.
      await import("../../../../lib/media-library").then(({ deleteMediaLibrary }) => deleteMediaLibrary(storage, deletable));
      const suffix = blockedCount > 0 ? ` ${blockedCount} in-use item(s) were kept.` : "";
      setMessage({ type: "success", text: `${deletable.length} item(s) deleted.${suffix}` });
      setSelectedPaths(new Set());
      loadLibrary();
      loadFolderCounts();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message || "Delete failed" });
    }
  };

  const addFolder = async () => {
    const name = addFolderName.trim();
    if (!name || !db) return;
    const id = slug(name);
    const existing = folders.find((f) => f.id === id || f.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setMessage({ type: "error", text: "A folder with that name already exists." });
      return;
    }
    try {
      const customFolders = folders.filter((f) => f.id !== GENERAL_ID);
      const newCustom = [...customFolders, { id, name }];
      await setDoc(doc(db, MEDIA_COLLECTION, MEDIA_CONFIG_DOC), { folders: newCustom }, { merge: true });
      setFolders([{ id: GENERAL_ID, name: "General" }, ...newCustom]);
      setAddFolderName("");
      setShowAddFolder(false);
      setMessage({ type: "success", text: `Folder "${name}" added.` });
      loadFolderCounts();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message || "Could not add folder." });
    }
  };

  const folderCount = (folderId: string) => {
    if (folderId === GENERAL_ID) return folderCounts.general ?? 0;
    return folderCounts[folderId] ?? 0;
  };

  const handleRenameFolder = async () => {
    const name = renameValue.trim();
    if (!name || !db || !renameFolderId) return;
    const customFolders = folders.filter((f) => f.id !== GENERAL_ID);
    const updated = customFolders.map((f) => (f.id === renameFolderId ? { ...f, name } : f));
    await setDoc(doc(db, MEDIA_COLLECTION, MEDIA_CONFIG_DOC), { folders: updated }, { merge: true });
    setFolders([{ id: GENERAL_ID, name: "General" }, ...updated]);
    setRenameFolderId(null);
    setRenameValue("");
    setMessage({ type: "success", text: `Folder renamed to "${name}".` });
    loadFolderCounts();
  };

  const handleDeleteFolder = async () => {
    if (currentFolderId === GENERAL_ID || !db || !storage) return;
    const itemsInFolder = library.filter((i) => i.folderId === currentFolderId);
    try {
      const inUsePaths = await getInUseMediaPaths();
      const hasInUse = itemsInFolder.some((i) => inUsePaths.has(i.path));
      if (hasInUse) {
        setMessage({ type: "error", text: "This folder contains media used by feed/content. Remove those references first." });
        return;
      }
      if (itemsInFolder.length > 0) {
        await import("../../../../lib/media-library").then(({ deleteMediaLibrary }) =>
          deleteMediaLibrary(storage, itemsInFolder.map((i) => i.path))
        );
      }
      const customFolders = folders.filter((f) => f.id !== GENERAL_ID && f.id !== currentFolderId);
      await setDoc(doc(db, MEDIA_COLLECTION, MEDIA_CONFIG_DOC), { folders: customFolders }, { merge: true });
      setFolders([{ id: GENERAL_ID, name: "General" }, ...customFolders]);
      setCurrentFolderId(GENERAL_ID);
      setMessage({ type: "success", text: "Folder deleted." });
      loadLibrary();
      loadFolderCounts();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message || "Delete failed" });
    }
  };

  const handleMoveSelected = async () => {
    if (!storage || selectedPaths.size === 0) return;
    const inUsePaths = await getInUseMediaPaths();
    const selected = Array.from(selectedPaths);
    const inUseCount = selected.filter((p) => inUsePaths.has(p)).length;
    if (inUseCount > 0) {
      setMessage({ type: "error", text: "Some selected items are used in posts or content. Remove those references first, or move only unused items." });
      return;
    }
    const targetId = moveTargetFolderId === GENERAL_ID ? "" : moveTargetFolderId;
    setMoving(true);
    setMessage(null);
    try {
      await moveMediaLibrary(storage, selected, targetId, (current, total) => {
        setMessage({ type: "success", text: `Moving… ${current} of ${total}` });
      });
      setMessage({ type: "success", text: `${selected.length} item(s) moved.` });
      setSelectedPaths(new Set());
      setShowMoveModal(false);
      setMoveTargetFolderId(GENERAL_ID);
      await new Promise((r) => setTimeout(r, 400));
      loadLibrary();
      loadFolderCounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Move failed";
      setMessage({ type: "error", text: msg });
    } finally {
      setMoving(false);
    }
  };

  return (
    <main className="admin-main admin-media-page">
      <div className="admin-media-vault">
        <header className="admin-media-header">
          <div>
            <h1>My Vault</h1>
            <p className="admin-media-intro">Upload and manage images, videos, and voice notes you can reuse in posts.</p>
          </div>
          <label className="admin-media-upload-btn">
            <input
              type="file"
              accept="image/*,video/*,audio/*"
              onChange={handleUpload}
              disabled={uploading}
              className="sr-only"
            />
            {uploading ? `Uploading… ${Math.round(uploadProgress)}%` : "Upload Media"}
          </label>
        </header>
        {message && (
          <p className={`admin-media-message admin-media-message-${message.type}`} role="alert">
            {message.text}
          </p>
        )}

        <div className="admin-media-body">
          <aside className="admin-media-sidebar">
            <div className="admin-media-sidebar-head">
              <span>Folders</span>
              <button
                type="button"
                className="admin-media-folder-add"
                onClick={() => setShowAddFolder((v) => !v)}
                aria-label="Add folder"
                ref={addFolderButtonRef}
              >
                +
              </button>
            </div>
            {showAddFolder && (
              <div className="admin-media-folder-new" ref={addFolderPanelRef}>
                <input
                  type="text"
                  value={addFolderName}
                  onChange={(e) => setAddFolderName(e.target.value)}
                  placeholder="Folder name"
                  onKeyDown={(e) => e.key === "Enter" && addFolder()}
                />
                <button type="button" className="admin-media-folder-save" onClick={addFolder}>
                  Add
                </button>
              </div>
            )}
            <ul className="admin-media-folder-list">
              <li>
                <button
                  type="button"
                  className={`admin-media-folder-item${currentFolderId === GENERAL_ID ? " active" : ""}`}
                  onClick={() => setCurrentFolderId(GENERAL_ID)}
                >
                  <span className="admin-media-folder-icon">📁</span>
                  General
                  <span className="admin-media-folder-count">{folderCount(GENERAL_ID)}</span>
                </button>
              </li>
              {folders
                .filter((f) => f.id !== GENERAL_ID)
                .map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className={`admin-media-folder-item${currentFolderId === f.id ? " active" : ""}`}
                      onClick={() => setCurrentFolderId(f.id)}
                    >
                      <span className="admin-media-folder-icon">📁</span>
                      {f.name}
                      <span className="admin-media-folder-count">{folderCount(f.id)}</span>
                    </button>
                  </li>
                ))}
            </ul>
            {currentFolderId !== GENERAL_ID && (
              <div className="admin-media-folder-actions">
                <button
                  type="button"
                  className="admin-media-folder-rename"
                  onClick={() => {
                    const f = folders.find((x) => x.id === currentFolderId);
                    if (f) {
                      setRenameFolderId(currentFolderId);
                      setRenameValue(f.name);
                    }
                  }}
                >
                  Rename
                </button>
                <button type="button" className="admin-media-folder-delete" onClick={handleDeleteFolder}>
                  Delete
                </button>
              </div>
            )}
            {renameFolderId && (
              <div className="admin-media-folder-rename-inline">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRenameFolder()}
                  placeholder="New name"
                  autoFocus
                />
                <button type="button" onClick={handleRenameFolder}>Save</button>
                <button type="button" onClick={() => { setRenameFolderId(null); setRenameValue(""); }}>Cancel</button>
              </div>
            )}
          </aside>

          <div className="admin-media-main">
            <div className="admin-media-toolbar">
              <div className="admin-media-tabs">
                <button
                  type="button"
                  className={filter === "all" ? "active" : ""}
                  onClick={() => setFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={filter === "images" ? "active" : ""}
                  onClick={() => setFilter("images")}
                >
                  Images
                </button>
                <button
                  type="button"
                  className={filter === "videos" ? "active" : ""}
                  onClick={() => setFilter("videos")}
                >
                  Videos
                </button>
                <button
                  type="button"
                  className={filter === "voice_notes" ? "active" : ""}
                  onClick={() => setFilter("voice_notes")}
                  aria-label="Voice notes"
                >
                  <VoiceIcon className="admin-media-tab-icon" />
                  Voice notes
                </button>
              </div>
              <div className="admin-media-toolbar-right">
                <button type="button" className="admin-media-select-all" onClick={selectAll}>
                  {selectedPaths.size === filteredItems.length && filteredItems.length > 0 ? "Deselect all" : "Select all"}
                </button>
                <span className="admin-media-count">{filteredItems.length} items</span>
                <button
                  type="button"
                  className="admin-media-view-toggle-btn"
                  onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
                  aria-label={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
                >
                  {viewMode === "grid" ? "List" : "Grid"}
                </button>
                {selectedPaths.size > 0 && (
                  <>
                    <button
                      type="button"
                      className="admin-media-move-btn"
                      onClick={() => {
                        const otherFolder = folders.find((f) => f.id !== currentFolderId);
                        setMoveTargetFolderId(otherFolder ? otherFolder.id : GENERAL_ID);
                        setShowMoveModal(true);
                      }}
                    >
                      Move {selectedPaths.size} selected
                    </button>
                    <button type="button" className="admin-media-delete-btn" onClick={handleDeleteSelected}>
                      Delete selected ({selectedPaths.size})
                    </button>
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <p className="admin-media-loading">Loading…</p>
            ) : filteredItems.length === 0 ? (
              <div className="admin-media-empty">
                <p>
                  {filter === "voice_notes"
                    ? "No voice notes here. Record voice in a post (Posts → Record voice) or upload an audio file."
                    : filter === "videos"
                      ? "No videos here. Upload a video to get started."
                      : filter === "images"
                        ? "No images here. Upload an image to get started."
                        : "No media here. Upload an image, video, or audio to get started."}
                </p>
              </div>
            ) : (
              <div className={`admin-media-grid admin-media-view-${viewMode}`}>
                {filteredItems.map((item) => (
                  <div
                    key={item.path}
                    className={`admin-media-card${selectedPaths.has(item.path) ? " selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="admin-media-card-check"
                      onClick={() => toggleSelect(item.path)}
                      aria-label={selectedPaths.has(item.path) ? "Deselect" : "Select"}
                    >
                      {selectedPaths.has(item.path) ? "✓" : ""}
                    </button>
                    <div className="admin-media-card-preview">
                      {item.isAudio ? (
                        <div className="admin-media-card-voice">
                          <VoiceIcon className="admin-media-card-voice-icon" />
                          <audio src={item.url} controls className="admin-media-card-audio" />
                        </div>
                      ) : item.isVideo ? (
                        <VideoCardPreview url={item.url} />
                      ) : (
                        <LazyMediaImage src={item.url} alt="" className="admin-media-card-media" loading="lazy" />
                      )}
                    </div>
                    {viewMode === "list" && (
                      <p className="admin-media-card-title">{item.name}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showMoveModal && (
        <div className="admin-media-move-overlay" onClick={() => !moving && setShowMoveModal(false)}>
          <div className="admin-media-move-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-media-move-head">
              <h3>Move {selectedPaths.size} Item{selectedPaths.size !== 1 ? "s" : ""}</h3>
              <button
                type="button"
                className="admin-media-move-close"
                onClick={() => !moving && setShowMoveModal(false)}
                aria-label="Close"
                disabled={moving}
              >
                ×
              </button>
            </div>
            <p className="admin-media-move-hint">Select a folder to move the selected item(s) to:</p>
            <ul className="admin-media-move-folders">
              {folders.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className={`admin-media-move-folder-btn${moveTargetFolderId === f.id ? " active" : ""}`}
                    onClick={() => setMoveTargetFolderId(f.id)}
                    disabled={moving}
                  >
                    <span className="admin-media-folder-icon">📁</span>
                    {f.name}
                    <span className="admin-media-folder-count">{folderCount(f.id)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {moveTargetFolderId === currentFolderId && folders.length > 1 && (
              <p className="admin-media-move-same-folder-hint">Select a different folder above to move into.</p>
            )}
            <div className="admin-media-move-actions">
              <button
                type="button"
                className="admin-media-move-cancel"
                onClick={() => !moving && setShowMoveModal(false)}
                disabled={moving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-media-move-submit"
                onClick={handleMoveSelected}
                disabled={moving || moveTargetFolderId === currentFolderId}
                title={moveTargetFolderId === currentFolderId ? "Select a different folder to move to" : undefined}
              >
                {moving ? "Moving…" : "Move"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
