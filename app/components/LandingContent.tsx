"use client";

import { useEffect, useState } from "react";
import { getFirebaseDb } from "../../lib/firebase";
import type { SiteConfigContent } from "../../lib/site-config";
import { loadLandingConfig } from "./landing-config-client";

export function LandingTestimonial() {
  const [content, setContent] = useState<SiteConfigContent | null>(null);
  const db = getFirebaseDb();

  useEffect(() => {
    if (!db) return;
    loadLandingConfig(db)
      .then((cfg) => {
        if (cfg.content) setContent(cfg.content as SiteConfigContent);
      })
      .catch(() => {});
  }, [db]);

  if (!content?.testimonialQuote?.trim()) return null;

  return (
    <section className="testimonial reveal landing-panel visible landing-testimonial-wired">
      <h2 className="section-title">What people say</h2>
      <blockquote className="landing-testimonial-quote">
        &ldquo;{content.testimonialQuote.trim()}&rdquo;
        {content.testimonialAttribution?.trim() && (
          <cite className="landing-testimonial-attribution"> — {content.testimonialAttribution.trim()}</cite>
        )}
      </blockquote>
    </section>
  );
}

export function LandingCtaCount() {
  const [content, setContent] = useState<SiteConfigContent | null>(null);
  const db = getFirebaseDb();

  useEffect(() => {
    if (!db) return;
    loadLandingConfig(db)
      .then((cfg) => {
        if (cfg.content) setContent(cfg.content as SiteConfigContent);
      })
      .catch(() => {});
  }, [db]);

  if (!content?.showMemberCount || typeof content.memberCount !== "number") return null;

  return (
    <p className="preview-sub landing-cta-count">
      Join <strong>{content.memberCount}</strong> in the circle
    </p>
  );
}
