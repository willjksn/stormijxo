/**
 * Post document shape for Firestore and app.
 * Used by admin posts, calendar, feed, and post detail.
 */
export type PostStatus = "published" | "scheduled" | "draft";

export type PostDoc = {
  title?: string;
  body: string;
  mediaUrls: string[];
  mediaTypes?: ("image" | "video")[];
  audioUrls?: string[];
  altTexts?: string[]; // optional alt text per media index
  /** Animation for text overlay on image: static, scroll-up, scroll-across, dissolve */
  captionStyle?: "static" | "scroll-up" | "scroll-across" | "dissolve";
  /** Text shown as overlay on the image (optional) */
  overlayText?: string;
  overlayTextColor?: string;
  overlayHighlight?: boolean;
  overlayUnderline?: boolean;
  overlayItalic?: boolean;
  /** Font size for overlay text in pixels (number). Legacy: "small"|"medium"|"large" mapped to 14, 18, 24 when loading. */
  overlayTextSize?: number;
  hideComments?: boolean;
  hideLikes?: boolean;
  /** When false, hides the Send Tip button in the post action bar. Default true. */
  showTipButton?: boolean;
  /** Optional poll: question + options (members can vote) */
  poll?: { question: string; options: string[] };
  /** Optional tip goal: show tips for this post with a target (e.g. "If I raise $500 I'll...") */
  tipGoal?: {
    enabled: boolean;
    description: string;
    targetCents: number;
    raisedCents: number;
  };
  /** Optional paid unlock for the full post media set. */
  lockedContent?: {
    enabled: boolean;
    priceCents: number;
  };
  status: PostStatus;
  /** YYYY-MM-DD for calendar placement */
  calendarDate: string;
  /** HH:MM for display (optional for drafts) */
  calendarTime?: string;
  /** When to publish (scheduled posts) */
  scheduledAt?: { toDate: () => Date } | null;
  /** When actually published */
  publishedAt?: { toDate: () => Date } | null;
  createdAt: { toDate: () => Date } | unknown;
  likeCount?: number;
  comments?: { username?: string; author?: string; text: string }[];
  viewCount?: number;
};

/** For calendar query: calendarDate in range */
export function postCalendarDate(post: PostDoc): string {
  return post.calendarDate || "";
}

export function postStatusColor(status: PostStatus): "green" | "pink" | "grey" {
  if (status === "published") return "green";
  if (status === "scheduled") return "pink";
  return "grey";
}
