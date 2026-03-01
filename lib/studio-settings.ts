/**
 * Studio settings (AI Training) — Firestore persistence.
 * Path: studioSettings/{uid}
 * Used by: AI Training page, Chat session, Interactive prompts, Posts.
 */

import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, type Firestore } from "firebase/firestore";

export const STUDIO_SETTINGS_COLLECTION = "studioSettings";

export interface StudioSettingsData {
  creatorPersonality: string;
  formality: number;
  humor: number;
  empathy: number;
  profanity: number;
  spiciness: number;
  updatedAt?: unknown;
}

const DEFAULTS: StudioSettingsData = {
  creatorPersonality: "",
  formality: 30,
  humor: 50,
  empathy: 70,
  profanity: 50,
  spiciness: 100,
};

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

function parseNumber(val: unknown, defaultVal: number, min: number, max: number): number {
  if (typeof val === "number" && !Number.isNaN(val)) return clamp(Math.round(val), min, max);
  if (typeof val === "string") return clamp(parseInt(val, 10) || defaultVal, min, max);
  return defaultVal;
}

export function parseStudioSettings(data: Record<string, unknown> | null): StudioSettingsData {
  if (!data || typeof data !== "object") return { ...DEFAULTS };
  return {
    creatorPersonality: typeof data.creatorPersonality === "string" ? data.creatorPersonality.trim().slice(0, 4000) : DEFAULTS.creatorPersonality,
    formality: parseNumber(data.formality, DEFAULTS.formality, 0, 100),
    humor: parseNumber(data.humor, DEFAULTS.humor, 0, 100),
    empathy: parseNumber(data.empathy, DEFAULTS.empathy, 0, 100),
    profanity: parseNumber(data.profanity, DEFAULTS.profanity, 0, 100),
    spiciness: parseNumber(data.spiciness, DEFAULTS.spiciness, 0, 100),
  };
}

export async function getStudioSettings(db: Firestore, uid: string): Promise<StudioSettingsData> {
  const snap = await getDoc(doc(db, STUDIO_SETTINGS_COLLECTION, uid));
  return parseStudioSettings(snap.exists() ? (snap.data() as Record<string, unknown>) : null);
}

export async function setStudioSettings(
  db: Firestore,
  uid: string,
  patch: Partial<StudioSettingsData>
): Promise<void> {
  const ref = doc(db, STUDIO_SETTINGS_COLLECTION, uid);
  const snap = await getDoc(ref);
  const current = parseStudioSettings(snap.exists() ? (snap.data() as Record<string, unknown>) : null);
  const next = {
    ...current,
    ...patch,
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, next);
}

export function subscribeStudioSettings(
  db: Firestore,
  uid: string,
  onData: (data: StudioSettingsData) => void
): () => void {
  const ref = doc(db, STUDIO_SETTINGS_COLLECTION, uid);
  return onSnapshot(ref, (snap) => {
    onData(parseStudioSettings(snap.exists() ? (snap.data() as Record<string, unknown>) : null));
  });
}
