/**
 * Prepare legal page HTML for display: decode entities and auto-link URLs.
 * Call in the client before setting innerHTML.
 */

/** Decode HTML entities so "&lt;p&gt;" becomes "<p>" and renders as HTML. */
export function decodeHtmlEntities(html: string): string {
  if (typeof document === "undefined") return html;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  return textarea.value;
}

/** Replace plain https?:// URLs in text with clickable links. Skips URLs already inside href="...". */
export function linkifyUrls(html: string): string {
  return html.replace(
    /(^|>|\s)(https?:\/\/[^\s<>"]+)(?=[\s<]|$)/g,
    (_, before, url) => `${before}<a href="${url}" target="_blank" rel="noopener">${url}</a>`
  );
}

export function prepareLegalHtml(html: string): string {
  const decoded = decodeHtmlEntities(html);
  return linkifyUrls(decoded);
}
