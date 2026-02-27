"use client";

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

type Props = {
  className?: string;
  children?: React.ReactNode;
  /** Override: if user is signed in we use their email/uid automatically */
  customerEmail?: string;
  uid?: string;
};

export function SubscriptionCheckoutButton({
  className = "btn btn-primary btn-shine",
  children = "Join the Inner Circle - $19/mo",
  customerEmail: customerEmailProp,
  uid: uidProp,
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customerEmail = customerEmailProp ?? user?.email ?? undefined;
  const uid = uidProp ?? user?.uid ?? undefined;

  const handleClick = async () => {
    setError(null);
    setLoading(true);
    try {
      const base =
        typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch("/api/subscription-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutType: "subscription",
          success_url: `${base}/success`,
          cancel_url: `${base}/#pricing`,
          ...(customerEmail ? { customer_email: customerEmail } : {}),
          ...(uid ? { uid } : {}),
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      if (res.status === 404) {
        setError("Checkout is unavailable. The page may need to be refreshed or try again later.");
        return;
      }
      setError(data.error || "Could not start checkout.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? "Taking you to checkout…" : children}
      </button>
      {error && (
        <p className="tip-error" role="alert" style={{ marginTop: "0.5rem" }}>
          {error}
        </p>
      )}
    </>
  );
}
