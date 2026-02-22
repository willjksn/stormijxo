"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getFirebaseAuth, getFirebaseDb } from "../../../lib/firebase";
import { canAccessAdmin, getAuthErrorMessage } from "../../../lib/auth-redirect";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useAuth } from "../../contexts/AuthContext";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const reason = searchParams.get("reason");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>(
    reason === "noaccess" ? "You don't have admin access." : ""
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    const db = getFirebaseDb();
    if (!db) return;
    canAccessAdmin(db, user.email ?? null)
      .then((ok) => { if (ok) router.replace("/admin/dashboard"); })
      .catch(() => {});
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <main className="login-page" style={{ maxWidth: 360, margin: "4rem auto", padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
        Loading…
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
      if (!db) {
        router.replace("/admin/dashboard");
        return;
      }
      const allowed = await canAccessAdmin(db, cred.user.email ?? null);
      if (allowed) {
        router.replace("/admin/dashboard");
        return;
      }
      await auth.signOut();
      setError("You don't have admin access. Your email must be in User Management with role Admin.");
    } catch (err) {
      setError(getAuthErrorMessage(err, "Login failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="login-header" style={{ display: "flex", justifyContent: "center", alignItems: "center", borderBottom: "1px solid var(--border)", padding: "1rem" }}>
        <Link href="/" className="logo logo-pop">
          <img src="/assets/logo.svg" alt="My Inner circle" className="logo-img" style={{ width: 240, height: 64, objectFit: "contain" }} />
        </Link>
      </header>
      <main className="login-page" style={{ maxWidth: 360, margin: "4rem auto", padding: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>My Inner circle — Admin</h1>
        {error && <p className="login-error visible" style={{ color: "#c53030", fontSize: "0.9rem", marginBottom: "1rem" }}>{error}</p>}
        <form onSubmit={handleSubmit} className="login-form" style={{ marginBottom: "1rem" }}>
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ width: "100%", padding: "0.65rem", marginBottom: "1rem", border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <label htmlFor="admin-password">Password</label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{ flex: 1, padding: "0.65rem", border: "1px solid var(--border)", borderRadius: 8 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--text-muted)", borderRadius: 8, padding: "0.65rem 0.75rem", cursor: "pointer", fontSize: "0.85rem" }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", marginTop: "0.5rem" }}>
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
        <Link href="/" style={{ display: "inline-block", marginTop: "1rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
          ← Back to site
        </Link>
      </main>
    </>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <main className="login-page" style={{ maxWidth: 360, margin: "4rem auto", padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
        Loading…
      </main>
    }>
      <AdminLoginForm />
    </Suspense>
  );
}
