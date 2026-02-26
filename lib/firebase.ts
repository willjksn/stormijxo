/**
 * Firebase client init for the Next.js app.
 * Config (pick one):
 * - NEXT_PUBLIC_FIREBASE_CONFIG: JSON string of full config.
 * - Or individual vars. In Vercel use these names (no KEY/AUTH to avoid warnings):
 *   NEXT_PUBLIC_FIREBASE_WEB_API, NEXT_PUBLIC_FIREBASE_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, etc.
 * - Or NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN in .env.local.
 */
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";
import { getStorage, type FirebaseStorage } from "firebase/storage";

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

function getConfig(): FirebaseConfig | null {
  if (typeof window !== "undefined" && (window as unknown as { FIREBASE_CONFIG?: FirebaseConfig }).FIREBASE_CONFIG) {
    return (window as unknown as { FIREBASE_CONFIG: FirebaseConfig }).FIREBASE_CONFIG;
  }
  const configJson = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (configJson && configJson.trim()) {
    try {
      const parsed = JSON.parse(configJson) as Record<string, unknown>;
      const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey : "";
      const projectId = typeof parsed.projectId === "string" ? parsed.projectId : "";
      const appId = typeof parsed.appId === "string" ? parsed.appId : "";
      if (apiKey && apiKey !== "YOUR_API_KEY" && projectId && appId) {
        return {
          apiKey,
          authDomain: typeof parsed.authDomain === "string" ? parsed.authDomain : "",
          projectId,
          storageBucket: typeof parsed.storageBucket === "string" ? parsed.storageBucket : "",
          messagingSenderId: typeof parsed.messagingSenderId === "string" ? parsed.messagingSenderId : "",
          appId,
          measurementId: typeof parsed.measurementId === "string" ? parsed.measurementId : undefined,
        };
      }
    } catch {
      // invalid JSON, fall through to individual vars
    }
  }
  const apiKey =
    process.env.NEXT_PUBLIC_FIREBASE_WEB_API ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || apiKey === "YOUR_API_KEY") return null;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "";
  if (!projectId || !appId) return null;
  return {
    apiKey,
    authDomain:
      process.env.NEXT_PUBLIC_FIREBASE_DOMAIN ??
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
      "",
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let fbFunctions: Functions | null = null;
let storage: FirebaseStorage | null = null;

function getApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (app) return app;
  const config = getConfig();
  if (!config) return null;
  app = getApps().length ? (getApps()[0] as FirebaseApp) : initializeApp(config);
  return app;
}

export function getFirebaseAuth(): Auth | null {
  if (typeof window === "undefined") return null;
  if (auth) return auth;
  const a = getApp();
  if (!a) return null;
  auth = getAuth(a);
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  return auth;
}

export function getFirebaseDb(): Firestore | null {
  if (typeof window === "undefined") return null;
  if (db) return db;
  const a = getApp();
  if (!a) return null;
  db = getFirestore(a);
  return db;
}

export function getFirebaseFunctions(): Functions | null {
  if (typeof window === "undefined") return null;
  if (fbFunctions) return fbFunctions;
  const a = getApp();
  if (!a) return null;
  fbFunctions = getFunctions(a);
  return fbFunctions;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  if (typeof window === "undefined") return null;
  if (storage) return storage;
  const a = getApp();
  if (!a) return null;
  storage = getStorage(a);
  return storage;
}

export function isFirebaseConfigured(): boolean {
  return getConfig() !== null;
}
