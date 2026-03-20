/**
 * Fan / member area: prefer Firestore `users.username` over legal name for public labels.
 * Never show a full email where a handle is expected (Firebase often sets displayName = email).
 */

function eqIgnoreCase(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

function emailLocalPart(email: string | null | undefined): string | null {
  const e = email?.trim();
  if (!e || !e.includes("@")) return null;
  const local = e.split("@")[0]?.trim();
  return local || null;
}

/**
 * Username from profile: lowercase; if someone stored an email in `username`, use local part only.
 */
export function safeUsernameForHandle(username: string | null | undefined): string | null {
  const u = username?.trim().toLowerCase();
  if (!u) return null;
  if (u.includes("@")) {
    const local = u.split("@")[0]?.trim();
    return local ? local.slice(0, 60) : null;
  }
  return u.slice(0, 60);
}

/**
 * Display name from Firebase Auth — often equal to email; never use full email as public handle.
 */
function safeDisplayNameForHandle(
  displayName: string | null | undefined,
  email: string | null | undefined
): string | null {
  const d = displayName?.trim();
  if (!d) return null;
  const em = email?.trim();
  if (em && eqIgnoreCase(d, em)) return null;
  if (d.includes("@")) {
    const local = d.split("@")[0]?.trim();
    if (em && eqIgnoreCase(d, em)) return null;
    return local || null;
  }
  return d;
}

/** Handle used in comments, notifications, etc. (lowercase, max 60 chars). */
export function fanHubHandle(
  username: string | null | undefined,
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  const u = safeUsernameForHandle(username);
  if (u) return u;
  const dn = safeDisplayNameForHandle(displayName, email);
  if (dn) return dn.slice(0, 60);
  const local = emailLocalPart(email);
  return (local || "member").slice(0, 60);
}

/** Avatar initials: prefer username, then safe display name, then email local part. */
export function fanHubInitials(
  username: string | null | undefined,
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  const u = safeUsernameForHandle(username);
  if (u) {
    const alnum = u.replace(/[^a-z0-9]/gi, "");
    if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
    if (alnum.length === 1) return alnum[0].toUpperCase();
    return u.slice(0, 2).toUpperCase();
  }
  const dn = safeDisplayNameForHandle(displayName, email);
  if (dn) {
    const parts = dn.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0].length && parts[parts.length - 1].length) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
    }
    if (parts[0]?.length) return parts[0][0].toUpperCase().slice(0, 2);
  }
  const local = emailLocalPart(email);
  if (local) {
    const alnum = local.replace(/[^a-z0-9]/gi, "");
    if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
    if (alnum.length === 1) return alnum[0].toUpperCase();
    const c = local[0];
    if (c && /[A-Z0-9]/i.test(c)) return c.toUpperCase();
  }
  return "?";
}

/** Short label for lists (e.g. likers modal): @username, else safe name / email local part. */
export function fanHubListLabel(
  username: string | null | undefined,
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  const u = safeUsernameForHandle(username);
  if (u) return `@${u}`;
  const dn = safeDisplayNameForHandle(displayName, email);
  if (dn) return dn;
  const local = emailLocalPart(email);
  return local || "Member";
}

/**
 * Stored comment author string: if a full email was saved, show local part only.
 * (Does not add @; use for legacy comment rows.)
 */
export function fanHubCommentAuthorLabel(nameLike: string): string {
  const n = (nameLike || "").toString().trim();
  if (!n) return "user";
  if (n.includes("@")) {
    const local = n.split("@")[0]?.trim();
    return local ? local.slice(0, 100) : "user";
  }
  return n.slice(0, 100);
}
