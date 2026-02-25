import Link from "next/link";
import { PrivacyContent } from "./PrivacyContent";

export const metadata = {
  title: "Privacy — Inner Circle",
  description: "Privacy Policy for Inner Circle.",
};

export default function PrivacyPage() {
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
        <h1>Privacy Policy</h1>
        <PrivacyContent />
        <p>
          <Link href="/" className="btn btn-primary">
            Back to home
          </Link>
        </p>
      </main>

      <footer className="site-footer">
        <p className="footer-legal">
          <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </footer>
    </>
  );
}
