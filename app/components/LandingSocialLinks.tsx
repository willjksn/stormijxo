"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
import type { SiteConfigContent } from "../../lib/site-config";
import { SITE_CONFIG_CONTENT_ID } from "../../lib/site-config";

const CONTENT_DOC_PATH = "site_config";

type SocialVisibility = {
  instagram: boolean;
  facebook: boolean;
  x: boolean;
  tiktok: boolean;
  youtube: boolean;
};

type SocialUrls = {
  instagram: string;
  facebook: string;
  x: string;
  tiktok: string;
  youtube: string;
};

type LegacySocialLink = {
  url?: string;
  show?: boolean | string;
};

type LandingLegacyDoc = {
  socialLinks?: Partial<Record<keyof SocialVisibility, LegacySocialLink>>;
};

const defaultVisibility: SocialVisibility = {
  instagram: true,
  facebook: true,
  x: true,
  tiktok: true,
  youtube: true,
};

const defaultUrls: SocialUrls = {
  instagram: "",
  facebook: "",
  x: "",
  tiktok: "",
  youtube: "",
};

export function LandingSocialLinks({ idPrefix = "social" }: { idPrefix?: string }) {
  const [vis, setVis] = useState<SocialVisibility>(defaultVisibility);
  const [urls, setUrls] = useState<SocialUrls>(defaultUrls);
  const db = getFirebaseDb();

  useEffect(() => {
    if (!db) return;
    Promise.all([
      getDoc(doc(db, CONTENT_DOC_PATH, SITE_CONFIG_CONTENT_ID)),
      getDoc(doc(db, CONTENT_DOC_PATH, "landing")),
    ])
      .then(([contentSnap, landingSnap]) => {
        if (contentSnap.exists()) {
          const d = contentSnap.data() as SiteConfigContent;
          setVis({
            instagram: d.showSocialInstagram !== false,
            facebook: d.showSocialFacebook !== false,
            x: d.showSocialX !== false,
            tiktok: d.showSocialTiktok !== false,
            youtube: d.showSocialYoutube !== false,
          });
        }

        if (landingSnap.exists()) {
          const landing = landingSnap.data() as LandingLegacyDoc;
          const links = landing.socialLinks || {};
          setUrls({
            instagram: (links.instagram?.url || "").trim(),
            facebook: (links.facebook?.url || "").trim(),
            x: (links.x?.url || "").trim(),
            tiktok: (links.tiktok?.url || "").trim(),
            youtube: (links.youtube?.url || "").trim(),
          });

          // Preserve legacy per-network show flags if configured in site_config/landing.
          const hasLegacyShow = Object.values(links).some((item) => item?.show !== undefined);
          if (hasLegacyShow) {
            setVis((prev) => ({
              instagram: links.instagram?.show === undefined ? prev.instagram : links.instagram.show === true || links.instagram.show === "true",
              facebook: links.facebook?.show === undefined ? prev.facebook : links.facebook.show === true || links.facebook.show === "true",
              x: links.x?.show === undefined ? prev.x : links.x.show === true || links.x.show === "true",
              tiktok: links.tiktok?.show === undefined ? prev.tiktok : links.tiktok.show === true || links.tiktok.show === "true",
              youtube: links.youtube?.show === undefined ? prev.youtube : links.youtube.show === true || links.youtube.show === "true",
            }));
          }
        }
      })
      .catch(() => {
        // keep defaults
      });
  }, [db]);

  const anchorProps = (url: string) => {
    const clean = (url || "").trim();
    if (!clean) {
      return { href: "#" };
    }
    return {
      href: clean,
      target: "_blank",
      rel: "noopener noreferrer",
    };
  };

  const igGradId = idPrefix + "-ig-grad";

  return (
    <>
      {vis.instagram && (
        <a {...anchorProps(urls.instagram)} aria-label="instagram">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={igGradId} x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: "#FED576" }} />
                <stop offset="25%" style={{ stopColor: "#F47133" }} />
                <stop offset="50%" style={{ stopColor: "#BC3081" }} />
                <stop offset="100%" style={{ stopColor: "#4C63D2" }} />
              </linearGradient>
            </defs>
            <path
              fill={`url(#${igGradId})`}
              d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.058 1.645-.07 4.849-.07zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm5.965-10.405a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
            />
          </svg>
        </a>
      )}
      {vis.facebook && (
        <a {...anchorProps(urls.facebook)} aria-label="facebook">
          <svg viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        </a>
      )}
      {vis.x && (
        <a {...anchorProps(urls.x)} aria-label="x">
          <svg viewBox="0 0 24 24" fill="#0F1419" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      )}
      {vis.tiktok && (
        <a {...anchorProps(urls.tiktok)} aria-label="tiktok">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="#000" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1.05-.08 6.33 6.33 0 00-6.33 6.34 6.33 6.33 0 0010.88 4.41 6.34 6.34 0 00.63-2.56V9.01a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
            <path fill="#25F4EE" d="M19.59 2v4.44a4.83 4.83 0 01-1-.1V2z" />
            <path fill="#25F4EE" d="M15.82 6.44v3.45a2.92 2.92 0 01-2.31-1.74 2.93 2.93 0 01-.88-.13v6.63a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 015.2-1.74v-6.63a2.93 2.93 0 01.88.13 2.89 2.89 0 002.31 1.74z" />
            <path fill="#FE2C55" d="M12.63 9.4v6.27a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 015.2-1.74V9.4z" />
          </svg>
        </a>
      )}
      {vis.youtube && (
        <a {...anchorProps(urls.youtube)} aria-label="youtube">
          <svg viewBox="0 0 24 24" fill="#FF0000" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </a>
      )}
    </>
  );
}
