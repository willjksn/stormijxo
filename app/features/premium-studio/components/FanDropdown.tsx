"use client";

import React, { useState, useRef, useEffect } from "react";
import type { FanOption } from "../types";

function getDisplay(fan: FanOption): string {
  if (fan.displayName?.trim()) return fan.displayName.trim();
  if (fan.email?.trim()) return fan.email.trim();
  return fan.uid.slice(0, 8);
}

function matchFan(fan: FanOption, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.trim().toLowerCase();
  const display = getDisplay(fan).toLowerCase();
  const email = (fan.email ?? "").toLowerCase();
  const uid = fan.uid.toLowerCase();
  return display.includes(lower) || email.includes(lower) || uid.includes(lower);
}

function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

interface FanDropdownProps {
  fans: FanOption[];
  selectedUid: string | null;
  onSelect: (uid: string | null) => void;
  loading?: boolean;
  placeholder?: string;
}

export function FanDropdown({ fans, selectedUid, onSelect, loading, placeholder = "Select Fan" }: FanDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setSearchQuery("");
      searchInputRef.current?.focus();
    }
  }, [open]);

  const filteredFans = searchQuery.trim() ? fans.filter((f) => matchFan(f, searchQuery)) : fans;
  const selectedFan = fans.find((f) => f.uid === selectedUid);
  const displayValue = selectedFan ? getDisplay(selectedFan) : "";

  return (
    <div className="chat-session-fan-dropdown" ref={ref}>
      <button
        type="button"
        className="chat-session-fan-trigger"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="chat-session-fan-trigger-icon">
          <UsersIcon />
        </span>
        <span className="chat-session-fan-trigger-text">
          {loading ? "Loading…" : displayValue || placeholder}
        </span>
        <span className="chat-session-fan-trigger-chevron">
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div className="chat-session-fan-list-wrap">
          <div className="chat-session-fan-search">
            <span className="chat-session-fan-search-icon" aria-hidden>
              <SearchIcon />
            </span>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="chat-session-fan-search-input"
              aria-label="Search fans"
              autoComplete="off"
            />
          </div>
          <ul className="chat-session-fan-list" role="listbox">
            <li role="option">
              <button
                type="button"
                className={`chat-session-role-btn ${selectedUid === null ? "active" : ""}`}
                onClick={() => { onSelect(null); setOpen(false); }}
              >
                No fan selected
              </button>
            </li>
            {filteredFans.map((fan) => (
              <li key={fan.uid} role="option">
                <button
                  type="button"
                  className={`chat-session-role-btn ${selectedUid === fan.uid ? "active" : ""}`}
                  onClick={() => { onSelect(fan.uid); setOpen(false); }}
                >
                  {getDisplay(fan)}
                </button>
              </li>
            ))}
            {searchQuery.trim() && filteredFans.length === 0 && (
              <li className="chat-session-fan-list-empty" role="option">
                No fans match “{searchQuery.trim()}”
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
