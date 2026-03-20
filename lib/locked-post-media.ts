/**
 * Locked post media: optional single image preview while the rest stay paywalled.
 * See lockedContent.previewMediaIndex on post docs.
 */

export type LockedContentForPreview = {
  enabled?: boolean;
  priceCents?: number;
  previewMediaIndex?: number | null;
};

/** True if slot `index` is an image (not video). */
export function isImageMediaAtIndex(
  mediaUrls: string[],
  mediaTypes: ("image" | "video")[] | undefined,
  index: number
): boolean {
  const url = mediaUrls[index];
  if (!url) return false;
  const t = mediaTypes?.[index];
  if (t === "video") return false;
  if (t === "image") return true;
  return !/\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
}

/**
 * Valid preview index: only when 2+ media, locked, index in range, and that slot is an image.
 */
export function resolvePreviewMediaIndex(
  mediaUrls: string[],
  mediaTypes: ("image" | "video")[] | undefined,
  lockedContent: LockedContentForPreview | undefined
): number | null {
  const n = mediaUrls.length;
  if (n <= 1 || !lockedContent?.enabled) return null;
  const idx = lockedContent.previewMediaIndex;
  if (typeof idx !== "number" || idx < 0 || idx >= n) return null;
  if (!isImageMediaAtIndex(mediaUrls, mediaTypes, idx)) return null;
  return idx;
}

/** Feed / grid hero: when locked + valid preview, show that image; otherwise slot 0. */
export function feedHeroMediaIndex(
  mediaUrls: string[],
  mediaTypes: ("image" | "video")[] | undefined,
  lockedContent: LockedContentForPreview | undefined,
  isLockedForViewer: boolean
): number {
  if (!isLockedForViewer) return 0;
  const p = resolvePreviewMediaIndex(mediaUrls, mediaTypes, lockedContent);
  return p ?? 0;
}

/** Blur + lock overlay on feed hero when this slot should stay locked. */
export function isHeroMediaLocked(
  mediaUrls: string[],
  mediaTypes: ("image" | "video")[] | undefined,
  lockedContent: LockedContentForPreview | undefined,
  isLockedForViewer: boolean,
  heroIndex: number
): boolean {
  if (!isLockedForViewer) return false;
  const n = mediaUrls.length;
  if (n <= 1) return true;
  const p = resolvePreviewMediaIndex(mediaUrls, mediaTypes, lockedContent);
  if (p == null) return true;
  return heroIndex !== p;
}

/** Per carousel slide: locked until pay, except the preview image index when set. */
export function isCarouselSlideLocked(
  mediaUrls: string[],
  mediaTypes: ("image" | "video")[] | undefined,
  lockedContent: LockedContentForPreview | undefined,
  isLockedForViewer: boolean,
  slideIndex: number
): boolean {
  if (!isLockedForViewer) return false;
  const n = mediaUrls.length;
  if (n <= 1) return true;
  const p = resolvePreviewMediaIndex(mediaUrls, mediaTypes, lockedContent);
  if (p == null) return true;
  return slideIndex !== p;
}
