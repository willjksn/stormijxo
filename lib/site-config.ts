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
  /** Tip page hero title text color (hex, e.g. #ffffff) */
  tipPageHeroTitleColor?: string;
  /** Tip page hero subtext color (hex) */
  tipPageHeroSubtextColor?: string;
  /** Tip page hero title font size in pixels (number) */
  tipPageHeroTitleFontSize?: number;
  /** Tip page hero subtext font size in pixels (number) */
  tipPageHeroSubtextFontSize?: number;
  /** Privacy policy last updated date (YYYY-MM-DD) */
  privacyPolicyLastUpdated?: string;
  /** Terms of service last updated date (YYYY-MM-DD) */
  termsLastUpdated?: string;
  /** Privacy policy body (HTML). When set, shown on /privacy; date set on save. */
  privacyPolicyHtml?: string;
  /** Terms of service body (HTML). When set, shown on /terms; date set on save. */
  termsHtml?: string;
  /** Show Instagram icon in hero and footer (default true) */
  showSocialInstagram?: boolean;
  /** Show Facebook icon in hero and footer (default true) */
  showSocialFacebook?: boolean;
  /** Show X (Twitter) icon in hero and footer (default true) */
  showSocialX?: boolean;
  /** Show TikTok icon in hero and footer (default true) */
  showSocialTiktok?: boolean;
  /** Show YouTube icon in hero and footer (default true) */
  showSocialYoutube?: boolean;
  /** About Stormi J profile card: image URL (optional) */
  aboutStormiJImageUrl?: string;
  /** About Stormi J profile card: video URL (optional, shown if set) */
  aboutStormiJVideoUrl?: string;
  /** About Stormi J profile card: bio/info text */
  aboutStormiJText?: string;
  /** About Stormi J profile card: bio text color (hex) */
  aboutStormiJTextColor?: string;
  /** About Stormi J profile card: bio text font size in px */
  aboutStormiJTextFontSize?: number;
  /** About Stormi J profile card: bio text font family */
  aboutStormiJTextFontFamily?: string;
};

export const SITE_CONFIG_CONTENT_ID = "content";
export const SITE_CONFIG_TIP_PAGE_ID = "tipPage";
