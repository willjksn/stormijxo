"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../contexts/AuthContext";
import { AuthModal } from "./AuthModal";

export function LandingHeaderWithAuth() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"login" | "signup">("signup");
  const { user } = useAuth();

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
        <Link href="/" className="logo logo-pop">
          <img src="/assets/logo.svg" alt="My Inner circle" className="logo-img" />
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
      />
    </>
  );
}
