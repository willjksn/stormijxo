"use client";

import { useLayoutEffect, useRef } from "react";

/** Grow textarea with content up to maxHeightPx, then scroll inside (fixes mobile single-line input clipping). */
export function useAutosizeTextarea(value: string, maxHeightPx = 140) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeightPx)}px`;
  }, [value, maxHeightPx]);

  return ref;
}
