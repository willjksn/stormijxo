/**
 * Fan / member area: prefer Firestore `users.username` over legal name for public labels.
 */

/** Handle used in comments, notifications, etc. (lowercase, max 60 chars). */
export function fanHubHandle(
  username: string | null | undefined,
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  const u = username?.trim().toLowerCase();
  if (u) return u.slice(0, 60);
  const fallback = (displayName || email?.split("@")[0] || "member").toString().trim();
  return fallback.slice(0, 60);
}

/** Avatar initials: prefer username, then display name, then email. */
export function fanHubInitials(
  username: string | null | undefined,
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  const u = username?.trim();
  if (u) {
    const alnum = u.replace(/[^a-z0-9]/gi, "");
    if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
    if (alnum.length === 1) return alnum[0].toUpperCase();
    return u.slice(0, 2).toUpperCase();
  }
  const parts = (displayName || "").trim().split(/\s+/);
  if (parts.length >= 2 && parts[0].length && parts[parts.length - 1].length) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  }
  if (parts[0]?.length) return parts[0][0].toUpperCase().slice(0, 2);
  const c = email?.trim()[0];
  if (c && /[A-Z0-9]/i.test(c)) return c.toUpperCase();
  return "?";
}

/** Short label for lists (e.g. likers modal): @username, else fallback. */
export function fanHubListLabel(
  username: string | null | undefined,
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  const u = username?.trim().toLowerCase();
  if (u) return `@${u}`;
  return (
    displayName?.trim() ||
    (email ? email.split("@")[0] : null) ||
    "Member"
  );
}
