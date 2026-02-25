/**
 * Site config stored in Firestore site_config collection.
 * - content: landing testimonial, member count, tip page hero, legal dates
 */

export type SiteConfigContent = {
  testimonialQuote?: string;
  testimonialAttribution?: string;
  /** Show "Join X in the circle" on landing; X is memberCount */
  showMemberCount?: boolean;
  /** Cached member count (updated by admin when they click Refresh) */
  memberCount?: number;
  /** Tip page hero image URL (optional) */
  tipPageHeroImageUrl?: string;
  /** Tip page hero title overlay (e.g. "Show Your Love") */
  tipPageHeroTitle?: string;
  /** Tip page hero subtext (e.g. "No minimum — send what you like.") */
  tipPageHeroSubtext?: string;
  /** Privacy policy last updated date (YYYY-MM-DD) */
  privacyPolicyLastUpdated?: string;
  /** Terms of service last updated date (YYYY-MM-DD) */
  termsLastUpdated?: string;
  /** Privacy policy body (HTML). When set, shown on /privacy; date set on save. */
  privacyPolicyHtml?: string;
  /** Terms of service body (HTML). When set, shown on /terms; date set on save. */
  termsHtml?: string;
};

export const SITE_CONFIG_CONTENT_ID = "content";
export const SITE_CONFIG_TIP_PAGE_ID = "tipPage";
