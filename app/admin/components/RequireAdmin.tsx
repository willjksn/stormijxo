"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { getFirebaseDb } from "../../../lib/firebase";
import { getFirebaseAuth } from "../../../lib/firebase";
import { canAccessAdmin } from "../../../lib/auth-redirect";
import { doc, setDoc } from "firebase/firestore";

type RequireAdminProps = {
  children: React.ReactNode;
  /** Rendered during auth check so the shell appears immediately and only content area shows loading */
  header?: React.ReactNode;
};

export function RequireAdmin({ children, header }: RequireAdminProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [adminDocEnsured, setAdminDocEnsured] = useState(false);

  useEffect(() => {
    if (!user) {
      if (!authLoading) router.replace("/");
      return;
    }
    const db = getFirebaseDb();
    if (!db) {
      setAllowed(false);
      return;
    }
    canAccessAdmin(db, user.email ?? null)
      .then((ok) => setAllowed(ok))
      .catch(() => setAllowed(false));
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || allowed !== true) return;
    let cancelled = false;
    const db = getFirebaseDb();
    if (!db || !user.uid) {
      setAdminDocEnsured(true);
      return;
    }
    const setDone = () => {
      if (!cancelled) setAdminDocEnsured(true);
    };
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const ensureByClientWrite = async () => {
      for (let i = 0; i < 4; i++) {
        try {
          await setDoc(
            doc(db, "admin_users", user.uid),
            { email: user.email ?? null, role: "admin" },
            { merge: true }
          );
          return true;
        } catch {
          await wait(300 * (i + 1));
        }
      }
      return false;
    };
    const ensureByApi = async () => {
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) return false;
      try {
        const token = await auth.currentUser.getIdToken(true);
        const res = await fetch("/api/admin/ensure-admin-doc", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: "{}",
        });
        return res.ok;
      } catch {
        return false;
      }
    };
    (async () => {
      const clientOk = await ensureByClientWrite();
      if (cancelled) return;
      if (clientOk) {
        setDone();
        return;
      }
      const apiOk = await ensureByApi();
      if (cancelled) return;
      if (apiOk) setDone();
    })();
    const t = setTimeout(setDone, 9000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [user, allowed]);

  useEffect(() => {
    if (authLoading || (user && allowed === null)) return;
    if (!user || allowed === false) {
      router.replace("/");
    }
  }, [authLoading, user, allowed, router]);

  const loading = authLoading || (user && allowed === null) || (allowed === true && !adminDocEnsured);
  if (!user || allowed === false) {
    return null;
  }

  if (loading && header) {
    return (
      <>
        {header}
        <main className="admin-main" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh", color: "var(--text-muted)" }}>
          Loading…
        </main>
      </>
    );
  }
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--text-muted)" }}>
        Loading…
      </div>
    );
  }
  return <>{children}</>;
}
