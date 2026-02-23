"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { isAdminEmail } from "../../lib/auth-redirect";

type MemberHeaderProps = {
  active: "home" | "treats";
};

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const TreatsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);

function useInitials(displayName: string | null, email: string | null): string {
  if (displayName?.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      const init = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      if (/[A-Z0-9]/i.test(init)) return init.slice(0, 2);
    }
    const first = parts[0][0]?.toUpperCase();
    if (first) return first.slice(0, 2);
  }
  if (email?.trim()) {
    const c = email.trim()[0].toUpperCase();
    if (/[A-Z0-9]/i.test(c)) return c;
  }
  return "?";
}

export function MemberHeader({ active }: MemberHeaderProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const avatarStableRef = useRef<{ photoURL: string | null; initials: string }>({ photoURL: null, initials: "?" });

  const initials = useInitials(user?.displayName ?? null, user?.email ?? null);
  const photoURL = user?.photoURL ?? null;
  if (user) {
    avatarStableRef.current = { photoURL, initials };
  }

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut();
    window.location.href = "/";
  };

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropdownOpen((o) => !o);
    (e.currentTarget as HTMLButtonElement).blur();
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, []);

  const displayAvatar = avatarStableRef.current;
  const showAdmin = user ? isAdminEmail(user.email ?? null) : false;

  return (
    <header className="member-header">
      <div className="header-left">
        <Link href="/home" className="logo logo-pop">
          <img src="/assets/logo.svg" alt="My Inner circle" className="logo-img" />
        </Link>
        <nav className="member-nav-main">
          {pathname === "/home" ? (
            <span className="header-home-link active" title="Home" aria-current="page">
              <HomeIcon />
              <span>Home</span>
            </span>
          ) : (
            <Link href="/home" className="header-home-link" title="Home">
              <HomeIcon />
              <span>Home</span>
            </Link>
          )}
          {pathname === "/treats" ? (
            <span className="active" title="Treats" aria-current="page">
              <TreatsIcon />
              <span>Treats</span>
            </span>
          ) : (
            <Link href="/treats" className="" title="Treats">
              <TreatsIcon />
              <span>Treats</span>
            </Link>
          )}
        </nav>
      </div>
      <div className="header-right header-profile-wrap" ref={wrapRef}>
        {showAdmin && (
          <Link href="/admin/dashboard" className="header-admin-btn" prefetch>
            Admin
          </Link>
        )}
        <button
          type="button"
          className="profile-avatar-wrap"
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
          aria-label="Profile menu"
          title="Profile menu"
          onClick={handleAvatarClick}
        >
          {displayAvatar.photoURL ? (
            <img src={displayAvatar.photoURL} alt="" className="profile-avatar" />
          ) : (
            <span className="profile-avatar-initials">{displayAvatar.initials}</span>
          )}
        </button>
        <div className={`profile-dropdown${dropdownOpen ? " open" : ""}`}>
          {showAdmin && (
            <Link href="/admin/dashboard" className="profile-dropdown-admin" onClick={() => setDropdownOpen(false)} prefetch>
              Admin
            </Link>
          )}
          <Link href="/profile" onClick={() => setDropdownOpen(false)}>
            Your Profile
          </Link>
          <a href="mailto:stormijxo@gmail.com?subject=Report%20a%20problem" onClick={() => setDropdownOpen(false)}>
            Report a Problem
          </a>
          <button type="button" className="sign-out" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
