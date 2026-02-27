"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseStorage } from "../../../../lib/firebase";
import {
  listMediaLibrary,
  listMediaLibraryCounts,
  uploadToMediaLibrary,
  type MediaItem,
} from "../../../../lib/media-library";
import { LazyMediaImage } from "../../../components/LazyMediaImage";

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
  const [filter, setFilter] = useState<"all" | "images" | "videos">("all");
  const [addFolderName, setAddFolderName] = useState("");
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
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
    filter === "videos" ? library.filter((i) => i.isVideo) : filter === "images" ? library.filter((i) => !i.isVideo) : library;

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

  return (
    <main className="admin-main admin-media-page">
      <div className="admin-media-vault">
        <header className="admin-media-header">
          <div>
            <h1>My Vault</h1>
            <p className="admin-media-intro">Upload and manage images and videos you can reuse in posts.</p>
          </div>
          <label className="admin-media-upload-btn">
            <input
              type="file"
              accept="image/*,video/*"
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
                  <button type="button" className="admin-media-delete-btn" onClick={handleDeleteSelected}>
                    Delete selected ({selectedPaths.size})
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <p className="admin-media-loading">Loading…</p>
            ) : filteredItems.length === 0 ? (
              <div className="admin-media-empty">
                <p>No media here. Upload an image or video to get started.</p>
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
                      {item.isVideo ? (
                        <video src={item.url} muted playsInline preload="none" className="admin-media-card-media" />
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
    </main>
  );
}
