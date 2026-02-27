"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "../../lib/firebase";
import { getAuthErrorMessage, getPostLoginPath } from "../../lib/auth-redirect";
import { useAuth } from "../contexts/AuthContext";

function safeRedirect(redirect: string | null): string {
  if (!redirect || !/^[a-z0-9/_-]+$/i.test(redirect)) return "/home";
  return redirect.startsWith("/") ? redirect : "/" + redirect;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirect = safeRedirect(searchParams.get("redirect"));

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      getPostLoginPath(getFirebaseDb(), user.email ?? null, user.uid, redirect).then((path) =>
        router.replace(path)
      );
    }
  }, [user, authLoading, router, redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    if (!auth) {
      setError("Firebase is not configured.");
      setLoading(false);
      return;
    }
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (db) {
        const userRef = doc(db, "users", cred.user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            email: cred.user.email ?? null,
            displayName: cred.user.displayName ?? null,
            username: (cred.user.email ?? "").split("@")[0]?.toLowerCase().slice(0, 32) || cred.user.uid.slice(0, 12),
            createdAt: serverTimestamp(),
          });
        }
      }
      const path = await getPostLoginPath(db, cred.user.email ?? null, cred.user.uid, redirect);
      router.replace(path);
    } catch (err) {
      setError(getAuthErrorMessage(err, "Log in failed."));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    if (!auth) {
      setError("Firebase is not configured.");
      setLoading(false);
      return;
    }
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const firebaseUser = result.user;
      if (db) {
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const username =
            (firebaseUser.displayName || "")
              .replace(/\s+/g, "")
              .toLowerCase()
              .slice(0, 32) || firebaseUser.uid.slice(0, 12);
          await setDoc(userRef, {
            email: firebaseUser.email ?? null,
            displayName: firebaseUser.displayName ?? null,
            username,
            createdAt: serverTimestamp(),
          });
        }
      }
      const path = await getPostLoginPath(db, firebaseUser.email ?? null, firebaseUser.uid, redirect);
      router.replace(path);
    } catch (err) {
      setError(getAuthErrorMessage(err, "Sign in with Google failed."));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <main className="auth-page">
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    return (
      <main className="auth-page">
        <h1>Firebase not configured</h1>
        <p>
          Add <code>NEXT_PUBLIC_FIREBASE_*</code> to <code>.env.local</code> or
          load <code>/firebase-config.js</code>.
        </p>
        <Link href="/">← Back to home</Link>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <h1>Log in</h1>
      <p className="subtitle">Welcome back to Inner Circle.</p>
      {error && (
        <p id="auth-error" className="auth-error visible" role="alert">
          {error}
        </p>
      )}
      <form id="login-form" className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="password">Password</label>
        <div className="password-row">
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            id="toggle-password"
            className="btn-password-toggle"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((s) => !s)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <div className="auth-divider">or</div>
      <button
        type="button"
        id="btn-google"
        className="btn-google"
        onClick={handleGoogle}
        disabled={loading}
      >
        <svg
          className="google-icon"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </button>
      <p className="auth-footer">
        Don’t have an account? <Link href="/signup">Sign up</Link>
      </p>
    </main>
  );
}
