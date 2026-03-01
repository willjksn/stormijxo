"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { StudioShell } from "./components/StudioShell";
import { SextingSessionPanel } from "./components/SextingSessionPanel";
import { fetchUsage } from "./api/client";

export function PremiumStudioPage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState({ aiSuggestionsRemaining: 200 });

  const getToken = useCallback(() => (user ? user.getIdToken(true) : Promise.resolve("")), [user]);

  useEffect(() => {
    if (!user) return;
    getToken()
      .then((token) => (token ? fetchUsage(token) : null))
      .then((data) => data && setUsage(data))
      .catch(() => {});
  }, [user, getToken]);

  if (!user) {
    return (
      <StudioShell>
        <p className="admin-posts-message admin-posts-message-error">Please sign in to use the chat session.</p>
        <Link href="/admin/login" className="btn btn-primary" style={{ marginTop: "1rem" }}>Sign in</Link>
      </StudioShell>
    );
  }

  return (
    <StudioShell>
      <SextingSessionPanel
        getToken={getToken}
        adminUid={user.uid}
        adminEmail={user.email ?? null}
        usageRemaining={usage.aiSuggestionsRemaining}
      />
    </StudioShell>
  );
}
