"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { AuthModal } from "./AuthModal";
import { getFirebaseDb } from "../../lib/firebase";
import { hasActiveMembership, isAdminEmail } from "../../lib/auth-redirect";

export function LandingHeaderWithAuth() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"login" | "signup">("signup");
  const { user, loading } = useAuth();
  const [showMemberNav, setShowMemberNav] = useState(false);
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const authIntent = searchParams.get("auth");

  useEffect(() => {
    if (showMemberNav) return;
    if (authIntent === "signup" || authIntent === "login") {
      setModalTab(authIntent);
      setModalOpen(true);
    }
  }, [authIntent, showMemberNav]);

  useEffect(() => {
    let active = true;
    if (loading || !user) {
      setShowMemberNav(false);
      return () => {
        active = false;
      };
    }
    if (isAdminEmail(user.email ?? null)) {
      setShowMemberNav(true);
      return () => {
        active = false;
      };
    }
    const db = getFirebaseDb();
    if (!db) {
      setShowMemberNav(false);
      return () => {
        active = false;
      };
    }
    hasActiveMembership(db, user.email ?? null, user.uid)
      .then((ok) => {
        if (!active) return;
        setShowMemberNav(ok);
      })
      .catch(() => {
        if (!active) return;
        setShowMemberNav(false);
      });
    return () => {
      active = false;
    };
  }, [user, loading]);

  const openSignup = () => {
    setModalTab("signup");
    setModalOpen(true);
  };

  const openLogin = () => {
    setModalTab("login");
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const hadAuthParams = url.searchParams.has("auth") || url.searchParams.has("pay");
    if (!hadAuthParams) return;
    url.searchParams.delete("auth");
    url.searchParams.delete("pay");
    window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams.toString()}` : "") + url.hash);
  };

  return (
    <>
      <header className="site-header">
        <Link href={showMemberNav ? "/home" : "/"} className="logo logo-pop">
          <img
            src="/assets/logo.svg"
            alt="Inner Circle"
            className="logo-img"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const fallback = target.nextElementSibling;
              if (fallback) (fallback as HTMLElement).style.display = "inline";
            }}
          />
          <span className="logo-fallback" style={{ display: "none", fontWeight: 600, fontSize: "1.1rem", color: "var(--text)" }} aria-hidden>Inner Circle</span>
        </Link>
        <nav className="header-nav">
          {showMemberNav ? (
            <Link href="/home" className="header-link">
              Home
            </Link>
          ) : (
            <button type="button" className="header-link" onClick={openSignup}>
              Sign up
            </button>
          )}
          {showMemberNav ? (
            <Link href="/profile" className="header-login">
              Profile
            </Link>
          ) : (
            <button type="button" className="header-login" onClick={openLogin}>
              Log in
            </button>
          )}
        </nav>
      </header>
      <AuthModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        initialTab={modalTab}
        redirectPath={redirect}
      />
    </>
  );
}
