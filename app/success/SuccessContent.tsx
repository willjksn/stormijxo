"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { getFirebaseDb } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export function SuccessContent() {
  const searchParams = useSearchParams();
  const isTip = searchParams.get("tip") === "1";
  const [submitted, setSubmitted] = useState(false);
  const db = getFirebaseDb();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.querySelector('input[type="email"]') as HTMLInputElement)?.value?.trim();
    if (!email || !db) return;
    try {
      await addDoc(collection(db, "members"), {
        email,
        status: "active",
        joinedAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch {
      // ignore
    }
  };

  if (isTip) {
    return (
      <section className="success-content" id="success-tip">
        <h1>Thank you for your tip!</h1>
        <p className="success-lead">Your support means a lot.</p>
        <Link href="/" className="btn btn-primary">
          Back to home
        </Link>
      </section>
    );
  }

  return (
    <section className="success-content" id="success-subscription">
      <h1>You&apos;re in.</h1>
      <p className="success-lead">Do these two steps so I can add you to Close Friends:</p>
      <ol className="steps">
        <li>
          <strong>Follow me on Instagram</strong>
          <br />
          <a href="https://instagram.com/stormij_xo" className="link-ig" target="_blank" rel="noopener noreferrer">
            @stormij_xo
          </a>
        </li>
        <li>
          <strong>Request access</strong>
          <br />
          DM me your <strong>email</strong> (the one you used to pay) or a screenshot of your receipt. Or tap the button below to open Instagram and send a quick &quot;I just subscribed&quot; message.
        </li>
      </ol>
      <a href="https://instagram.com/stormij_xo" className="btn btn-primary" target="_blank" rel="noopener noreferrer">
        Open Instagram & DM me
      </a>
      <p className="success-note">
        I add new members in batches — you&apos;ll be in Close Friends within 24 hours. Check your email for the receipt and customer portal link (cancel anytime there).
      </p>
      <div className="success-confirm">
        <p className="success-confirm-title">Confirm your email (optional)</p>
        <p className="success-confirm-sub">Enter the email you used to pay so we can add you faster.</p>
        {!submitted ? (
          <form id="success-email-form" onSubmit={handleSubmit}>
            <input type="email" id="success-email" placeholder="your@email.com" required />
            <button type="submit" className="btn btn-primary">
              Submit
            </button>
          </form>
        ) : (
          <p className="success-email-done">Thanks — we&apos;ll add you soon.</p>
        )}
      </div>
    </section>
  );
}
