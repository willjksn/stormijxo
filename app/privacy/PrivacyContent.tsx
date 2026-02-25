"use client";

import { useEffect, useRef, useState } from "react";
import { getFirebaseDb } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { DEFAULT_PRIVACY_HTML } from "../../lib/legal-defaults";
import { prepareLegalHtml } from "../../lib/legal-display";

function formatDate(str: string | null | undefined): string {
  if (!str) return "—";
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return str;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const d = parseInt(m[3], 10);
  return `${months[parseInt(m[2], 10) - 1]} ${d}, ${m[1]}`;
}

export function PrivacyContent() {
  const [lastUpdated, setLastUpdated] = useState<string>("—");
  const [html, setHtml] = useState<string>("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const db = getFirebaseDb();

  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, "site_config", "content"))
      .then((snap) => {
        if (snap.exists()) {
          const date = snap.get("privacyPolicyLastUpdated");
          const body = snap.get("privacyPolicyHtml");
          setLastUpdated(formatDate(date ?? null));
          setHtml(typeof body === "string" ? body : "");
        } else {
          setHtml("");
        }
      })
      .catch(() => {});
  }, [db]);

  useEffect(() => {
    if (!bodyRef.current) return;
    const raw = html.trim() || DEFAULT_PRIVACY_HTML;
    bodyRef.current.innerHTML = prepareLegalHtml(raw);
  }, [html]);

  return (
    <>
      <p className="legal-updated">Last updated: {lastUpdated}</p>
      <div ref={bodyRef} className="legal-body" />
    </>
  );
}
