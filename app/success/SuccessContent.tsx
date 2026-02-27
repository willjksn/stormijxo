"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "../../lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";

type PendingSignup = {
  name: string;
  username: string;
  email: string;
  password: string;
  createdAt: number;
};

async function createUserProfile(
  db: NonNullable<ReturnType<typeof getFirebaseDb>>,
  uid: string,
  email: string | null,
  displayName: string | null,
  username: string
) {
  const u = username.trim().toLowerCase();
  if (!u) throw new Error("Username is required.");
  const userRef = doc(db, "users", uid);
  const usernameRef = doc(db, "usernames", u);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(usernameRef);
    if (snap.exists()) throw new Error("Username already in use.");
    transaction.set(usernameRef, { uid, createdAt: serverTimestamp() });
    transaction.set(userRef, {
      email,
      displayName,
      username: u,
      createdAt: serverTimestamp(),
    });
  });
}

export function SuccessContent() {
  const searchParams = useSearchParams();
  const isTip = searchParams.get("tip") === "1";
  const isSignupFlow = searchParams.get("signup") === "1";
  const signupEmail = (searchParams.get("email") || "").trim().toLowerCase();
  const [submitted, setSubmitted] = useState(false);
  const [accountStatus, setAccountStatus] = useState<"idle" | "creating" | "done" | "error">("idle");
  const [accountError, setAccountError] = useState("");
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();

  useEffect(() => {
    if (!isSignupFlow) return;
    if (!db || !auth) {
      setAccountStatus("error");
      setAccountError("Could not initialize signup. Please return to landing and try again.");
      return;
    }

    let active = true;
    const finalizeAccount = async () => {
      setAccountStatus("creating");
      setAccountError("");
      try {
        const raw = sessionStorage.getItem("pendingSignup");
        if (!raw) throw new Error("Signup session expired. Please sign up again.");
        const pending = JSON.parse(raw) as PendingSignup;
        if (!pending?.email || !pending?.password || !pending?.username || !pending?.name) {
          throw new Error("Signup data is incomplete. Please sign up again.");
        }
        const pendingEmail = pending.email.trim().toLowerCase();
        if (signupEmail && pendingEmail !== signupEmail) {
          throw new Error("This payment does not match your signup details. Please try again.");
        }
        const freshnessMs = Date.now() - (pending.createdAt || 0);
        if (freshnessMs > 1000 * 60 * 60) {
          throw new Error("Signup session expired. Please sign up again.");
        }

        let uid = "";
        try {
          const cred = await createUserWithEmailAndPassword(auth, pendingEmail, pending.password);
          uid = cred.user.uid;
          await updateProfile(cred.user, { displayName: pending.name.trim() });
          await createUserProfile(db, cred.user.uid, cred.user.email ?? null, pending.name.trim(), pending.username.trim());
        } catch (e) {
          const code = (e as { code?: string })?.code || "";
          if (code !== "auth/email-already-in-use") throw e;
          const existing = await signInWithEmailAndPassword(auth, pendingEmail, pending.password);
          uid = existing.user.uid;
        }

        const existingMembership = await getDocs(
          query(collection(db, "members"), where("email", "==", pendingEmail), limit(1))
        );
        if (existingMembership.empty) {
          await addDoc(collection(db, "members"), {
            email: pendingEmail,
            status: "active",
            joinedAt: serverTimestamp(),
            uid: uid || null,
            userId: uid || null,
            source: "stripe_signup_success",
          });
        }

        sessionStorage.removeItem("pendingSignup");
        if (!active) return;
        setAccountStatus("done");
        window.location.href = "/home";
      } catch (e) {
        if (!active) return;
        setAccountStatus("error");
        setAccountError((e as Error)?.message || "Could not finish account setup.");
      }
    };

    finalizeAccount();
    return () => {
      active = false;
    };
  }, [isSignupFlow, signupEmail, db, auth]);

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

  if (isSignupFlow) {
    return (
      <section className="success-content" id="success-signup-finalize">
        <h1>Payment received.</h1>
        <p className="success-lead">
          {accountStatus === "creating" && "Finishing your account..."}
          {accountStatus === "done" && "Account created. Taking you to the app..."}
          {accountStatus === "error" && "Could not finish account setup."}
          {accountStatus === "idle" && "Preparing your account..."}
        </p>
        {accountStatus === "error" && (
          <>
            <p className="success-note">{accountError}</p>
            <Link href="/?auth=signup&redirect=%2Fhome" className="btn btn-primary">
              Back to signup
            </Link>
          </>
        )}
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
