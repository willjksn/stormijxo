import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "./SignupForm";

export const metadata = {
  title: "Sign up — Inner Circle",
  description: "Create an account for Inner Circle.",
};

export default function SignupPage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" className="logo logo-pop">
          <img src="/assets/logo.svg" alt="My Inner circle" className="logo-img" />
        </Link>
        <nav className="header-nav">
          <Link href="/signup" className="header-link">
            Sign up
          </Link>
          <Link href="/login" className="header-login">
            Log in
          </Link>
        </nav>
      </header>
      <Suspense fallback={<main className="auth-page"><p className="subtitle">Loading…</p></main>}>
        <SignupForm />
      </Suspense>
    </>
  );
}
