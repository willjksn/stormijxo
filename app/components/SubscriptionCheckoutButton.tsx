"use client";

import { useRouter } from "next/navigation";
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
  customerEmail: _customerEmailProp,
  uid: _uidProp,
}: Props) {
  const { user } = useAuth();
  const router = useRouter();

  const handleClick = () => {
    if (user) {
      router.push("/home");
      return;
    }
    router.push("/?auth=signup&redirect=%2Fhome");
  };

  return (
    <button type="button" className={className} onClick={handleClick}>
      {children}
    </button>
  );
}
