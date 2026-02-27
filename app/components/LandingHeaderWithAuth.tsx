"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { AuthModal } from "./AuthModal";

export function LandingHeaderWithAuth() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"login" | "signup">("signup");
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const authIntent = searchParams.get("auth");

  useEffect(() => {
    if (user) return;
    if (authIntent === "signup" || authIntent === "login") {
      setModalTab(authIntent);
      setModalOpen(true);
    }
  }, [authIntent, user]);

  const openSignup = () => {
    setModalTab("signup");
    setModalOpen(true);
  };

  const openLogin = () => {
    setModalTab("login");
    setModalOpen(true);
  };

  return (
    <>
      <header className="site-header">
        <Link href={user ? "/home" : "/"} className="logo logo-pop">
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
          {user ? (
            <Link href="/home" className="header-link">
              Home
            </Link>
          ) : (
            <button type="button" className="header-link" onClick={openSignup}>
              Sign up
            </button>
          )}
          {user ? (
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
        onClose={() => setModalOpen(false)}
        initialTab={modalTab}
        redirectPath={redirect}
      />
    </>
  );
}
