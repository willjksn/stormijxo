"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
import type { SiteConfigContent } from "../../lib/site-config";
import { SITE_CONFIG_CONTENT_ID } from "../../lib/site-config";

const CONTENT_DOC_PATH = "site_config";

export function LandingTestimonial() {
  const [content, setContent] = useState<SiteConfigContent | null>(null);
  const db = getFirebaseDb();

  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, CONTENT_DOC_PATH, SITE_CONFIG_CONTENT_ID))
      .then((snap) => {
        if (snap.exists()) setContent(snap.data() as SiteConfigContent);
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
    getDoc(doc(db, CONTENT_DOC_PATH, SITE_CONFIG_CONTENT_ID))
      .then((snap) => {
        if (snap.exists()) setContent(snap.data() as SiteConfigContent);
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
