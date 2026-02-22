"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

type RequireAuthProps = {
  children: React.ReactNode;
};

/**
 * Redirects to /login?redirect=currentPath if not authenticated.
 * Shows nothing (or a brief loading state) while auth is resolving.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const redirect = pathname && pathname !== "/" ? pathname.replace(/^\//, "") : "home";
      router.replace("/login?redirect=" + encodeURIComponent(redirect));
    }
  }, [user, loading, router, pathname]);

  if (loading) {
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

  return <>{children}</>;
}
