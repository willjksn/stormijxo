"use client";

import { useEffect, useState } from "react";
import { getFirebaseDb } from "../../lib/firebase";
import { loadLandingConfig } from "./landing-config-client";

export function LandingHeroMedia() {
  const db = getFirebaseDb();
  const [hero, setHero] = useState<{ url?: string; type?: "image" | "video" | string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!db) {
      setReady(true);
      return;
    }
    loadLandingConfig(db)
      .then((cfg) => {
        if (!active) return;
        const media = cfg.landing?.hero;
        if (media?.url) setHero(media);
      })
      .catch(() => {
        // Keep fallback media on read errors.
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [db]);

  const wrapStyle = ready ? undefined : { visibility: "hidden" as const };

  if (hero?.url && hero.type === "video") {
    return (
      <video
        src={hero.url}
        className="hero-image"
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        style={wrapStyle}
      />
    );
  }

  if (hero?.url) {
    return (
      <img
        src={hero.url}
        alt="Creator"
        className="hero-image"
        style={{ objectPosition: "top center", ...(wrapStyle || {}) }}
      />
    );
  }

  return (
    <img
      src="/images/hero.png"
      alt="Creator"
      className="hero-image"
      data-landing-default
      style={wrapStyle}
      onLoad={() => setReady(true)}
    />
  );
}
