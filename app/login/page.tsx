import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Log in — Inner Circle",
  description: "Log in to your Inner Circle account.",
};

export default function LoginPage() {
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
        <LoginForm />
      </Suspense>
    </>
  );
}
