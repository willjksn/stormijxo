import Link from "next/link";
import { Suspense } from "react";
import { SuccessContent } from "./SuccessContent";

export const metadata = {
  title: "You're in — Next steps",
  description: "Next steps after subscribing to Inner Circle.",
};

export default function SuccessPage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" className="logo logo-pop">
          <img src="/assets/logo.svg" alt="My Inner circle" className="logo-img" />
        </Link>
        <nav className="header-nav">
          <Link href="/admin/login" className="header-login">
            Log in
          </Link>
        </nav>
      </header>

      <main className="success-page">
        <Suspense fallback={<section className="success-content"><p>Loading…</p></section>}>
          <SuccessContent />
        </Suspense>
      </main>

      <footer className="site-footer">
        <p>
          <Link href="/">Home</Link> · <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
        </p>
        <p className="footer-legal">Thanks for joining.</p>
      </footer>
    </>
  );
}
