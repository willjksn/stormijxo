/**
 * Firebase client init for the Next.js app.
 * Set NEXT_PUBLIC_FIREBASE_* in .env.local (or use the same FIREBASE_* vars
 * and add NEXT_PUBLIC_ prefixed copies for client exposure).
 */
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, httpsCallable, type Functions } from "firebase/functions";

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
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || apiKey === "YOUR_API_KEY") return null;
  return {
    apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let fbFunctions: Functions | null = null;

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

export function isFirebaseConfigured(): boolean {
  return getConfig() !== null;
}
