"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { isAdminEmail } from "../../lib/auth-redirect";

type MemberHeaderProps = {
  active: "home" | "treats";
};

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
  const router = useRouter();
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
    router.replace("/");
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
        <Link href="/" className="logo logo-pop">
          <img src="/assets/logo.svg" alt="My Inner circle" className="logo-img" />
        </Link>
        <nav className="member-nav-main">
          {pathname === "/home" ? (
            <span className="header-home-link active" title="Home" aria-current="page">
              <span>Home</span>
            </span>
          ) : (
            <Link href="/home" className="header-home-link" title="Home">
              <span>Home</span>
            </Link>
          )}
          {pathname === "/treats" ? (
            <span className="active" title="Treats" aria-current="page">
              <span>Treats</span>
            </span>
          ) : (
            <Link href="/treats" className="" title="Treats">
              <span>Treats</span>
            </Link>
          )}
        </nav>
      </div>
      <div className="header-right header-profile-wrap" ref={wrapRef}>
        {showAdmin && (
          <Link href="/admin/dashboard" className="header-admin-btn" target="_blank" rel="noopener noreferrer">
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
