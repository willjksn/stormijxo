"use client";

import { useCallback, useEffect, useState } from "react";
import { getFirebaseDb } from "../../../../lib/firebase";
import {
  getStudioSettings,
  setStudioSettings,
  subscribeStudioSettings,
  type StudioSettingsData,
} from "../../../../lib/studio-settings";
import { useAuth } from "../../../contexts/AuthContext";

export function useStudioSettings() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [data, setData] = useState<StudioSettingsData>({
    creatorPersonality: "",
    formality: 30,
    humor: 50,
    empathy: 70,
    profanity: 50,
    spiciness: 100,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getStudioSettings(db, uid)
      .then(setData)
      .finally(() => setLoading(false));
  }, [uid]);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !uid) return;
    return subscribeStudioSettings(db, uid, setData);
  }, [uid]);

  const saveCreatorPersonality = useCallback(() => {
    const db = getFirebaseDb();
    if (!db || !uid) return;
    setStudioSettings(db, uid, { creatorPersonality: data.creatorPersonality }).catch(() => {});
  }, [uid, data.creatorPersonality]);

  const saveSliders = useCallback(
    (sliders: Partial<Pick<StudioSettingsData, "formality" | "humor" | "empathy" | "profanity" | "spiciness">>) => {
      const db = getFirebaseDb();
      if (!db || !uid) return;
      setStudioSettings(db, uid, sliders).catch(() => {});
    },
    [uid]
  );

  return {
    creatorPersonality: data.creatorPersonality,
    formality: data.formality,
    humor: data.humor,
    empathy: data.empathy,
    profanity: data.profanity,
    spiciness: data.spiciness,
    setCreatorPersonality: (v: string) => setData((prev) => ({ ...prev, creatorPersonality: v })),
    setFormality: (v: number) => setData((prev) => ({ ...prev, formality: v })),
    setHumor: (v: number) => setData((prev) => ({ ...prev, humor: v })),
    setEmpathy: (v: number) => setData((prev) => ({ ...prev, empathy: v })),
    setProfanity: (v: number) => setData((prev) => ({ ...prev, profanity: v })),
    setSpiciness: (v: number) => setData((prev) => ({ ...prev, spiciness: v })),
    saveCreatorPersonality,
    saveSliders,
    loading,
  };
}

/** Use when you have uid from elsewhere (e.g. props) and don't want to use AuthContext. */
export function useStudioSettingsForUser(uid: string | null) {
  const [data, setData] = useState<StudioSettingsData>({
    creatorPersonality: "",
    formality: 30,
    humor: 50,
    empathy: 70,
    profanity: 50,
    spiciness: 100,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getStudioSettings(db, uid)
      .then(setData)
      .finally(() => setLoading(false));
  }, [uid]);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !uid) return;
    return subscribeStudioSettings(db, uid, setData);
  }, [uid]);

  const saveCreatorPersonality = useCallback(() => {
    const db = getFirebaseDb();
    if (!db || !uid) return;
    setStudioSettings(db, uid, { creatorPersonality: data.creatorPersonality }).catch(() => {});
  }, [uid, data.creatorPersonality]);

  const saveSliders = useCallback(
    (sliders: Partial<Pick<StudioSettingsData, "formality" | "humor" | "empathy" | "profanity" | "spiciness">>) => {
      const db = getFirebaseDb();
      if (!db || !uid) return;
      setStudioSettings(db, uid, sliders).catch(() => {});
    },
    [uid]
  );

  return {
    creatorPersonality: data.creatorPersonality,
    formality: data.formality,
    humor: data.humor,
    empathy: data.empathy,
    profanity: data.profanity,
    spiciness: data.spiciness,
    setCreatorPersonality: (v: string) => setData((prev) => ({ ...prev, creatorPersonality: v })),
    setFormality: (v: number) => setData((prev) => ({ ...prev, formality: v })),
    setHumor: (v: number) => setData((prev) => ({ ...prev, humor: v })),
    setEmpathy: (v: number) => setData((prev) => ({ ...prev, empathy: v })),
    setProfanity: (v: number) => setData((prev) => ({ ...prev, profanity: v })),
    setSpiciness: (v: number) => setData((prev) => ({ ...prev, spiciness: v })),
    saveCreatorPersonality,
    saveSliders,
    loading,
  };
}
