"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";

function useInitial(displayName: string | null, email: string | null): string {
  const name = (displayName ?? "").toString().trim();
  if (name) return name.charAt(0).toUpperCase();
  const em = (email ?? "").toString().trim();
  return em ? em.charAt(0).toUpperCase() : "?";
}

export function AdminHeader() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const initial = useInitial(user?.displayName ?? null, user?.email ?? null);
  const photoURL = user?.photoURL ?? null;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, []);

  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropdownOpen((o) => !o);
    (e.currentTarget as HTMLButtonElement).blur();
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    await signOut();
    router.replace("/");
  };

  return (
    <header className="admin-header">
      <Link href="/admin/dashboard" className="admin-header-title">
        Admin Dashboard
      </Link>
      <div className="admin-header-right">
        <Link href="/home" className="header-link" title="Home">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </Link>
        <Link href="/treats" className="header-link" title="Treats">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 12 20 22 4 22 4 12" />
            <rect x="2" y="7" width="20" height="5" />
            <line x1="12" y1="22" x2="12" y2="7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
          <span>Treats</span>
        </Link>
        <div className={`admin-header-profile${dropdownOpen ? " open" : ""}`} ref={wrapRef}>
          <button
            type="button"
            className="profile-btn"
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            title="Profile menu"
            onClick={handleProfileClick}
          >
            {photoURL ? (
              <img src={photoURL} alt="" />
            ) : (
              <span className="profile-btn-default">{initial}</span>
            )}
          </button>
          <div className="profile-dropdown">
            <Link href="/profile" onClick={() => setDropdownOpen(false)}>
              Your profile
            </Link>
            <a href="mailto:stormijxo@gmail.com?subject=Report%20a%20problem" onClick={() => setDropdownOpen(false)}>
              Send a problem
            </a>
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
