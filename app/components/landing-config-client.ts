"use client";

import type { Firestore } from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import type { SiteConfigContent } from "../../lib/site-config";
import { SITE_CONFIG_CONTENT_ID } from "../../lib/site-config";

type LandingMediaItem = {
  url?: string;
  type?: "image" | "video" | string;
};

type LandingLegacyDoc = {
  hero?: LandingMediaItem;
  socialLinks?: Partial<
    Record<
      "instagram" | "facebook" | "x" | "tiktok" | "youtube",
      { url?: string; show?: boolean | string }
    >
  >;
};

export type LandingConfigPayload = {
  content: SiteConfigContent | null;
  landing: LandingLegacyDoc | null;
};

let cachedPromise: Promise<LandingConfigPayload> | null = null;

export function loadLandingConfig(db: Firestore | null): Promise<LandingConfigPayload> {
  if (!db) return Promise.resolve({ content: null, landing: null });
  if (cachedPromise) return cachedPromise;

  cachedPromise = Promise.all([
    getDoc(doc(db, "site_config", SITE_CONFIG_CONTENT_ID)),
    getDoc(doc(db, "site_config", "landing")),
  ])
    .then(([contentSnap, landingSnap]) => ({
      content: contentSnap.exists() ? (contentSnap.data() as SiteConfigContent) : null,
      landing: landingSnap.exists() ? (landingSnap.data() as LandingLegacyDoc) : null,
    }))
    .catch(() => ({ content: null, landing: null }));

  return cachedPromise;
}

