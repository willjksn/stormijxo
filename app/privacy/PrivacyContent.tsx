"use client";

import { useEffect, useState } from "react";
import { getFirebaseDb } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

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
  const db = getFirebaseDb();

  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, "site_config", "landing"))
      .then((snap) => {
        const date = snap.exists() ? snap.get("privacyPolicyLastUpdated") : null;
        setLastUpdated(formatDate(date ?? null));
      })
      .catch(() => {});
  }, [db]);

  return (
    <>
      <p className="legal-updated">Last updated: {lastUpdated}</p>
      <p>This page describes how your information is used in connection with Inner Circle.</p>
      <h2>Payment</h2>
      <p>Payments are processed by Stripe. Your payment details are handled by Stripe and are not stored by this site. Stripe&apos;s privacy policy applies to payment data: <a href="https://stripe.com/privacy" target="_blank" rel="noopener">stripe.com/privacy</a>.</p>
      <h2>Information we use</h2>
      <p>When you subscribe, we receive your email address (from Stripe) so we can add you to Inner Circle and contact you about your membership. Your username will be used to match your request when you DM the creator.</p>
      <h2>Instagram</h2>
      <p>Access to Inner Circle is via Instagram. Your use of Instagram is subject to Instagram&apos;s terms and privacy policy. We do not receive or store your Instagram login or password.</p>
      <h2>Sharing</h2>
      <p>We do not sell or share your personal information with third parties for marketing. Data is used only to provide and manage your membership.</p>
      <h2>Contact</h2>
      <p>For privacy questions, contact the creator via Instagram DM <a href="https://instagram.com/stormij_xo" target="_blank" rel="noopener">@stormij_xo</a>.</p>
    </>
  );
}
