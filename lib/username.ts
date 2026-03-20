/**
 * Member usernames: unique via `usernames/{lowercase}` docs; stored on `users/{uid}.username`.
 */

import { doc, getDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Returns null if valid, otherwise a short error message for UI.
 */
export function validateUsernameFormat(username: string): string | null {
  const u = normalizeUsername(username);
  if (!u) return "Username is required.";
  if (u.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters.`;
  }
  if (u.length > USERNAME_MAX_LENGTH) {
    return `Username must be at most ${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!/^[a-z0-9_]+$/.test(u)) {
    return "Use only lowercase letters, numbers, and underscores.";
  }
  return null;
}

/** True if this handle is not taken in `usernames/{username}`. */
export async function isUsernameAvailable(db: Firestore, username: string): Promise<boolean> {
  const formatErr = validateUsernameFormat(username);
  if (formatErr) return false;
  const u = normalizeUsername(username);
  const snap = await getDoc(doc(db, "usernames", u));
  return !snap.exists();
}
