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

export function TermsContent() {
  const [lastUpdated, setLastUpdated] = useState<string>("—");
  const db = getFirebaseDb();

  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, "site_config", "landing"))
      .then((snap) => {
        const date = snap.exists() ? snap.get("termsLastUpdated") : null;
        setLastUpdated(formatDate(date ?? null));
      })
      .catch(() => {});
  }, [db]);

  return (
    <>
      <p className="legal-updated">Last updated: {lastUpdated}</p>
      <p>By subscribing to Inner Circle, you agree to the following:</p>
      <h2>Subscription</h2>
      <p>Membership is a recurring monthly subscription. You will be charged each month until you cancel. You can cancel anytime via the link in your receipt email (Stripe customer portal).</p>
      <h2>Access</h2>
      <p>After payment, you must follow the creator on Instagram and send a direct message with your email or receipt details so your membership can be matched. Access to Inner Circle is granted at the creator&apos;s discretion and is typically provided within 24 hours.</p>
      <h2>Removal and cancellation</h2>
      <p>The creator may remove you from Inner Circle or cancel your access at any time, for any reason. If you are removed, you will keep access until the end of the period you have already paid for (your access end date). You will not be charged again after that.</p>
      <h2>Behavior</h2>
      <p>You are expected to be respectful in your interactions with the creator and the community. Rude, abusive, harassing, or otherwise inappropriate behavior may result in immediate removal from Inner Circle and cancellation of your membership. No refund will be given for the current period in such cases.</p>
      <h2>Use</h2>
      <p>Content shared in Inner Circle is for your personal use only. You may not screenshot, share, or redistribute it without permission.</p>
      <h2>Changes</h2>
      <p>These terms may be updated. Continued use of the membership after changes constitutes acceptance.</p>
    </>
  );
}
