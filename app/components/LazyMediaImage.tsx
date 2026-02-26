"use client";

import { useState } from "react";

type LazyMediaImageProps = {
  src: string;
  alt?: string;
  className?: string;
  /** "lazy" for grids/lists, "eager" for above-the-fold hero */
  loading?: "lazy" | "eager";
  /** Optional: custom placeholder class */
  placeholderClassName?: string;
};

/**
 * Image that shows a placeholder until loaded. Uses loading="lazy" and decoding="async"
 * to avoid blocking and only load when near viewport. Reduces perceived wait and layout shift.
 */
export function LazyMediaImage({
  src,
  alt = "",
  className = "",
  loading = "lazy",
  placeholderClassName = "lazy-media-image-placeholder",
}: LazyMediaImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <span className="lazy-media-image-wrap">
      {!loaded && <span className={placeholderClassName} aria-hidden />}
      <img
        src={src}
        alt={alt}
        className={`${className}${loaded ? " lazy-media-image-loaded" : ""}`.trim()}
        loading={loading}
        decoding="async"
        onLoad={() => setLoaded(true)}
      />
    </span>
  );
}
