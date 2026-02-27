"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { getFirebaseDb } from "../../lib/firebase";
import { hasActiveMembership, isAdminEmail } from "../../lib/auth-redirect";

type RequireAuthProps = {
  children: React.ReactNode;
};

/**
 * Redirects to / (landing page) if not authenticated.
 * Shows nothing (or a brief loading state) while auth is resolving.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [membershipChecked, setMembershipChecked] = useState(false);
  const [hasMembership, setHasMembership] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    if (loading || !user) {
      setMembershipChecked(false);
      setHasMembership(false);
      return () => {
        active = false;
      };
    }
    if (isAdminEmail(user.email ?? null)) {
      setMembershipChecked(true);
      setHasMembership(true);
      return () => {
        active = false;
      };
    }
    const db = getFirebaseDb();
    if (!db) {
      setMembershipChecked(true);
      setHasMembership(false);
      return () => {
        active = false;
      };
    }
    setMembershipChecked(false);
    hasActiveMembership(db, user.email ?? null, user.uid)
      .then((ok) => {
        if (!active) return;
        setHasMembership(ok);
      })
      .catch(() => {
        if (!active) return;
        setHasMembership(false);
      })
      .finally(() => {
        if (!active) return;
        setMembershipChecked(true);
      });
    return () => {
      active = false;
    };
  }, [user, loading]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const redirect = pathname && pathname !== "/" ? pathname : "home";
      router.replace("/?auth=login&redirect=" + encodeURIComponent(redirect));
      return;
    }
    if (!membershipChecked) return;
    if (!hasMembership) {
      const redirect = pathname && pathname !== "/" ? pathname : "/home";
      router.replace("/?auth=signup&redirect=" + encodeURIComponent(redirect) + "&pay=required");
    }
  }, [user, loading, membershipChecked, hasMembership, router, pathname]);

  if (loading || (user && !membershipChecked)) {
    return (
      <main className="member-main member-feed-main">
        <div className="feed-header">
          <p className="subtitle">Loading…</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }
  if (!hasMembership) return null;

  return <>{children}</>;
}
