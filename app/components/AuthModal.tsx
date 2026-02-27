"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "../../lib/firebase";
import { getAuthErrorMessage, getPostLoginPath } from "../../lib/auth-redirect";

const PASSWORD_REQUIREMENTS = [
  { id: "len", test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { id: "lower", test: (p: string) => /[a-z]/.test(p), label: "One lowercase letter" },
  { id: "upper", test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { id: "num", test: (p: string) => /\d/.test(p), label: "One number" },
  { id: "special", test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p), label: "One special character (!@#$%^&* etc.)" },
];

const GOOGLE_ICON = (
  <svg className="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialTab: "login" | "signup";
  /** After login, redirect here (e.g. from landing ?redirect=/home). */
  redirectPath?: string | null;
};

async function checkUsernameAvailable(db: ReturnType<typeof getFirebaseDb>, username: string): Promise<boolean> {
  const u = username.trim().toLowerCase();
  if (!u) return false;
  const snap = await getDoc(doc(db!, "usernames", u));
  return !snap.exists();
}

async function createUserProfile(
  db: NonNullable<ReturnType<typeof getFirebaseDb>>,
  uid: string,
  email: string | null,
  displayName: string | null,
  username: string
) {
  const u = username.trim().toLowerCase();
  if (!u) throw new Error("Username is required.");
  const userRef = doc(db, "users", uid);
  const usernameRef = doc(db, "usernames", u);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(usernameRef);
    if (snap.exists()) throw new Error("Username already in use.");
    transaction.set(usernameRef, { uid, createdAt: serverTimestamp() });
    transaction.set(userRef, {
      email,
      displayName,
      username: u,
      createdAt: serverTimestamp(),
    });
  });
}

export function AuthModal({ isOpen, onClose, initialTab, redirectPath }: AuthModalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "signup">(initialTab);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Signup form
  const [signupName, setSignupName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupTerms, setSignupTerms] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const auth = getFirebaseAuth();
  const db = getFirebaseDb();

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setError("");
      document.body.style.overflow = "";
    } else {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const showError = useCallback((msg: string) => {
    setError(msg);
  }, []);

  const startMembershipCheckout = useCallback(
    async (opts: { email?: string | null; uid?: string | null; successUrl?: string; cancelUrl?: string }) => {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch("/api/landing-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: base,
          success_url: opts.successUrl || `${base}/success`,
          cancel_url: opts.cancelUrl || `${base}/?auth=signup&redirect=%2Fhome`,
          ...(opts.email ? { customer_email: opts.email } : {}),
          ...(opts.uid ? { uid: opts.uid } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data.error || "Could not start checkout.");
    },
    []
  );

  const goAfterLoginOrCheckout = useCallback(
    async (user: { email: string | null; uid?: string | null }) => {
      const defaultPath = redirectPath && /^\/[a-z0-9/_-]*$/i.test(redirectPath) ? redirectPath : "/home";
      const path = await getPostLoginPath(db, user.email ?? null, user.uid ?? null, defaultPath);
      if (path.includes("pay=required")) {
        await startMembershipCheckout({ email: user.email, uid: user.uid ?? null });
        return;
      }
      router.replace(path);
    },
    [db, redirectPath, router, startMembershipCheckout]
  );

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) {
      showError("Firebase is not configured.");
      return;
    }
    setError("");
    if (!signupTerms) {
      showError("You must agree to the Terms and Privacy Policy.");
      return;
    }
    if (signupPassword !== signupConfirm) {
      showError("Passwords do not match.");
      return;
    }
    const allMet = PASSWORD_REQUIREMENTS.every((r) => r.test(signupPassword));
    if (!allMet) {
      showError("Password does not meet all requirements.");
      return;
    }
    const available = await checkUsernameAvailable(db, signupUsername);
    if (!available) {
      showError("Username already in use.");
      return;
    }
    setLoading(true);
    try {
      const email = signupEmail.trim().toLowerCase();
      sessionStorage.setItem(
        "pendingSignup",
        JSON.stringify({
          name: signupName.trim(),
          username: signupUsername.trim(),
          email,
          password: signupPassword,
          createdAt: Date.now(),
        })
      );
      const base = typeof window !== "undefined" ? window.location.origin : "";
      await startMembershipCheckout({
        email,
        successUrl: `${base}/success?signup=1&email=${encodeURIComponent(email)}`,
        cancelUrl: `${base}/?auth=signup&redirect=%2Fhome`,
      });
    } catch (err) {
      showError(getAuthErrorMessage(err, "Sign up failed."));
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      showError("Firebase is not configured.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      await goAfterLoginOrCheckout(cred.user);
    } catch (err) {
      showError(getAuthErrorMessage(err, "Log in failed."));
    } finally {
      setLoading(false);
    }
  };

  const handleSignupGoogle = async () => {
    if (!auth || !db) {
      showError("Firebase is not configured.");
      return;
    }
    if (!signupTerms) {
      showError("You must agree to the Terms and Privacy Policy.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      let isNewUser = false;
      if (!snap.exists()) {
        isNewUser = true;
        let username = (user.displayName || "").replace(/\s+/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) || "user";
        const available = await checkUsernameAvailable(db, username);
        if (!available) username = "user_" + user.uid.slice(0, 10);
        await createUserProfile(db, user.uid, user.email ?? null, user.displayName ?? null, username);
      }
      if (isNewUser) {
        await startMembershipCheckout({ email: user.email, uid: user.uid });
      } else {
        await goAfterLoginOrCheckout(user);
      }
    } catch (err) {
      showError(getAuthErrorMessage(err, "Sign in with Google failed."));
    } finally {
      setLoading(false);
    }
  };

  const handleLoginGoogle = async () => {
    if (!auth || !db) {
      showError("Firebase is not configured.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        let username = (user.displayName || "").replace(/\s+/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) || "user";
        const available = await checkUsernameAvailable(db, username);
        if (!available) username = "user_" + user.uid.slice(0, 10);
        await createUserProfile(db, user.uid, user.email ?? null, user.displayName ?? null, username);
      }
      await goAfterLoginOrCheckout(user);
    } catch (err) {
      showError(getAuthErrorMessage(err, "Sign in with Google failed."));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const title = tab === "signup" ? "Create your account" : "Welcome back";
  const subtitle = tab === "signup" ? "Start using Inner Circle." : "Log in to Inner Circle.";

  const modalContent = (
    <div
      className="auth-modal-overlay open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={handleOverlayClick}
    >
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <div className="auth-modal-brand">
            <img
              src="/assets/logo-auth.png"
              alt="Stormij XO"
              className="auth-modal-logo"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src && !target.src.endsWith("/assets/logo.svg")) {
                  target.src = "/assets/logo.svg";
                }
              }}
            />
          </div>
          <button type="button" className="auth-modal-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="auth-modal-title">
          <h2 id="auth-modal-title">{title}</h2>
          <p className="subtitle">{subtitle}</p>
        </div>
        <div className="auth-modal-tabs">
          <button
            type="button"
            className={"auth-modal-tab" + (tab === "login" ? " active" : "")}
            data-tab="login"
            onClick={() => setTab("login")}
          >
            Log In
          </button>
          <button
            type="button"
            className={"auth-modal-tab" + (tab === "signup" ? " active" : "")}
            data-tab="signup"
            onClick={() => setTab("signup")}
          >
            Sign Up
          </button>
        </div>
        <div className="auth-modal-body">
          {error && (
            <p className="auth-modal-error visible" role="alert">
              {error}
            </p>
          )}

          <div className={"auth-modal-panel" + (tab === "signup" ? " active" : "")} data-panel="signup">
            <form className="auth-modal-form" onSubmit={handleSignupSubmit}>
              <label htmlFor="auth-signup-name">Full Name</label>
              <input
                type="text"
                id="auth-signup-name"
                required
                autoComplete="name"
                placeholder="Your name"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
              />
              <label htmlFor="auth-signup-username">Username</label>
              <input
                type="text"
                id="auth-signup-username"
                required
                autoComplete="username"
                placeholder="username"
                value={signupUsername}
                onChange={(e) => setSignupUsername(e.target.value)}
              />
              <label htmlFor="auth-signup-email">Email</label>
              <input
                type="email"
                id="auth-signup-email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
              />
              <label htmlFor="auth-signup-password">Password</label>
              <div className="input-row">
                <input
                  type={showSignupPassword ? "text" : "password"}
                  id="auth-signup-password"
                  required
                  minLength={8}
                  placeholder="Password"
                  aria-describedby="auth-password-reqs"
                  autoComplete="new-password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-show"
                  aria-controls="auth-signup-password"
                  aria-label={showSignupPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowSignupPassword((s) => !s)}
                >
                  {showSignupPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div id="auth-password-reqs" className={"auth-password-reqs" + (signupPassword ? " visible" : "")}>
                <ul>
                  {PASSWORD_REQUIREMENTS.map((r) => (
                    <li key={r.id} id={"auth-req-" + r.id} className={r.test(signupPassword) ? "met" : ""}>
                      <span className="req-icon" />
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>
              <label htmlFor="auth-signup-confirm">Confirm Password</label>
              <div className="input-row">
                <input
                  type={showSignupConfirm ? "text" : "password"}
                  id="auth-signup-confirm"
                  required
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  value={signupConfirm}
                  onChange={(e) => setSignupConfirm(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-show"
                  aria-controls="auth-signup-confirm"
                  aria-label={showSignupConfirm ? "Hide password" : "Show password"}
                  onClick={() => setShowSignupConfirm((s) => !s)}
                >
                  {showSignupConfirm ? "Hide" : "Show"}
                </button>
              </div>
              <div className="terms-row">
                <input
                  type="checkbox"
                  id="auth-signup-terms"
                  required
                  checked={signupTerms}
                  onChange={(e) => setSignupTerms(e.target.checked)}
                />
                <label htmlFor="auth-signup-terms">
                  I agree to the <Link href="/terms" target="_blank">Terms of Service</Link> and{" "}
                  <Link href="/privacy" target="_blank">Privacy Policy</Link>
                </label>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Opening checkout…" : "Continue"}
              </button>
              <div className="auth-modal-divider">or</div>
              <button type="button" className="btn-google" onClick={handleSignupGoogle} disabled={loading}>
                {GOOGLE_ICON}
                Continue with Google
              </button>
            </form>
          </div>

          <div className={"auth-modal-panel" + (tab === "login" ? " active" : "")} data-panel="login">
            <form className="auth-modal-form" onSubmit={handleLoginSubmit}>
              <label htmlFor="auth-login-email">Email</label>
              <input
                type="email"
                id="auth-login-email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
              <label htmlFor="auth-login-password">Password</label>
              <div className="input-row">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  id="auth-login-password"
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-show"
                  aria-controls="auth-login-password"
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowLoginPassword((s) => !s)}
                >
                  {showLoginPassword ? "Hide" : "Show"}
                </button>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Logging in…" : "Log In"}
              </button>
              <div className="auth-modal-divider">or</div>
              <button type="button" className="btn-google" onClick={handleLoginGoogle} disabled={loading}>
                {GOOGLE_ICON}
                Continue with Google
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return null;
}
