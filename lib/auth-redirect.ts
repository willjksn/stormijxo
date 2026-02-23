import type { Firestore } from "firebase/firestore";
import { collection, getDocs, limit, query, where } from "firebase/firestore";

/** Map Firebase Auth errors (e.g. 400 invalid-credential) to user-friendly messages. */
export function getAuthErrorMessage(err: unknown, fallback: string): string {
  const code = (err as { code?: string })?.code;
  const msg = String((err as Error)?.message ?? "");
  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
    return "Invalid email or password.";
  }
  if (code === "auth/invalid-email") return "Please enter a valid email address.";
  if (code === "auth/email-already-in-use") return "This email is already in use.";
  if (code === "auth/operation-not-allowed") {
    return "Email/password sign-in is not enabled. Check your Firebase Console.";
  }
  if (code === "auth/too-many-requests") return "Too many attempts. Try again later.";
  if (/400|Bad Request|invalid-credential|INVALID_LOGIN_CREDENTIALS/i.test(msg)) {
    return "Invalid email or password.";
  }
  if (msg && !msg.startsWith("Firebase:")) return msg;
  return fallback;
}

/** Same allowlist as admin-auth.js — admins go to dashboard after login. */
export const ALLOWED_ADMIN_EMAILS = ["will_jackson@icloud.com", "stormij.xo@gmail.com"];

export function isAdminEmail(email: string | null): boolean {
  return ALLOWED_ADMIN_EMAILS.includes((email ?? "").trim().toLowerCase());
}

export async function isAdminUser(db: Firestore, userEmail: string | null): Promise<boolean> {
  if (isAdminEmail(userEmail)) return true;
  const emailNorm = (userEmail || "").trim().toLowerCase();
  if (!emailNorm) return false;
  const q = query(
    collection(db, "admin_users"),
    where("email", "==", userEmail),
    where("role", "==", "admin")
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/** Number of admin_users docs with role "admin". */
export async function countAdmins(db: Firestore): Promise<number> {
  const q = query(
    collection(db, "admin_users"),
    where("role", "==", "admin"),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.size;
}

/** Can access admin: allowlist, or bootstrap (0 admins), or in admin_users. */
export async function canAccessAdmin(db: Firestore, userEmail: string | null): Promise<boolean> {
  if (isAdminEmail(userEmail)) return true;
  if (!userEmail?.trim()) return false;
  const n = await countAdmins(db);
  if (n === 0) return true;
  return isAdminUser(db, userEmail);
}

/** Returns /admin/dashboard for admins, otherwise /home (or custom defaultPath). */
export async function getPostLoginPath(
  db: Firestore | null,
  userEmail: string | null,
  defaultPath = "/home"
): Promise<string> {
  if (!db) return defaultPath;
  const admin = await isAdminUser(db, userEmail);
  return admin ? "/admin/dashboard" : defaultPath;
}
