import Link from "next/link";
import { TermsContent } from "./TermsContent";

export const metadata = {
  title: "Terms — Inner Circle",
  description: "Terms of Service for Inner Circle membership.",
};

export default function TermsPage() {
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

      <main className="legal-page">
        <h1>Terms of Service</h1>
        <TermsContent />
        <p>
          <Link href="/" className="btn btn-primary">
            Back to home
          </Link>
        </p>
      </main>

      <footer className="site-footer">
        <p>
          <a href="https://instagram.com/stormij_xo" target="_blank" rel="noopener" className="footer-ig">
            Follow on Instagram
          </a>
        </p>
        <p className="footer-legal">
          <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </footer>
    </>
  );
}
