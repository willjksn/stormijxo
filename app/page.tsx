import Link from "next/link";
import { Suspense } from "react";
import { LandingHeaderWithAuth } from "./components/LandingHeaderWithAuth";
import { LandingTestimonial } from "./components/LandingContent";
import { LandingHeroMedia } from "./components/LandingHeroMedia";
import { LandingSocialLinks } from "./components/LandingSocialLinks";
import { LandingTipCheckout } from "./components/LandingTipCheckout";
import { SubscriptionCheckoutButton } from "./components/SubscriptionCheckoutButton";

export default function LandingPage() {
  return (
    <>
      <Suspense fallback={
        <header className="site-header">
          <Link href="/" className="logo logo-pop">
            <img src="/assets/logo.svg" alt="My Inner circle" className="logo-img" />
          </Link>
          <nav className="header-nav">
            <button type="button" className="header-link">Sign up</button>
            <button type="button" className="header-login">Log in</button>
          </nav>
        </header>
      }>
        <LandingHeaderWithAuth />
      </Suspense>

      <main>
        <section className="hero reveal visible">
          <div className="hero-image-wrap" data-landing-slot="hero">
            <LandingHeroMedia />
          </div>
          <div className="hero-text">
            <h1 className="hero-name hero-stagger" style={{ ["--delay" as string]: "0.1s" }}>
              Not For Everyone
            </h1>
            <p className="hero-tagline hero-stagger" style={{ ["--delay" as string]: "0.25s" }}>
              Just for the ones who stay.
            </p>
            <p className="hero-promise hero-stagger" style={{ ["--delay" as string]: "0.4s" }}>
              <span className="hero-promise-line">Same me</span>
            </p>
            <p className="hero-tagline hero-stagger" style={{ ["--delay" as string]: "0.55s" }}>
              Closer access.
            </p>
            <p className="hero-handle-line hero-stagger" style={{ ["--delay" as string]: "0.7s" }}>
              <span className="hero-social-links" id="hero-social-links" aria-label="Social links">
                <LandingSocialLinks idPrefix="hero" />
              </span>
            </p>
          </div>
        </section>

        <div className="section-divider" aria-hidden="true" />

        <section className="perks reveal landing-panel visible">
          <h2 className="section-title">Why This Exists</h2>
          <div className="conversation-copy">
            <p>Social media is fun.</p>
            <p>But sometimes I want to talk without thousands of people watching.</p>
            <p>I have a 9-5 and I am building my way out.</p>
            <p>This space is part of that.</p>
            <p>If you are here, you are early. And I do not forget who was early.</p>
          </div>
        </section>

        <section className="preview reveal landing-panel visible" id="preview-section">
          <h2 className="section-title flirty">What You Get</h2>
          <p className="preview-sub">Inside the Inner Circle:</p>
          <ul className="perks-list flirty-list">
            <li>3 drops every week</li>
            <li>Car talks I do not post publicly</li>
            <li>Poolside thoughts</li>
            <li>At-home "I just grabbed my phone" moments</li>
            <li>Direct-to-camera videos</li>
            <li>Access to personal add-ons ("Treats")</li>
          </ul>
          <div className="conversation-copy preview-boundary">
            <p>Nothing explicit.</p>
            <p>Nothing fake.</p>
            <p>Nothing forced.</p>
          </div>
        </section>

        <section className="testimonial reveal landing-panel visible">
          <h2 className="section-title">The Energy</h2>
          <div className="energy-copy">
            <p className="energy-line">I am not performing vulnerability.</p>
            <p className="energy-line">I am not escalating into something weird.</p>
            <p className="energy-line">I am not going to pretend I am deeper than I am.</p>
            <p className="energy-line">But I will talk to you directly.</p>
            <p className="energy-line energy-line-accent">And that is different.</p>
          </div>
        </section>

        <section className="faq reveal landing-panel visible">
          <h2 className="section-title">The Boundary</h2>
          <div className="conversation-copy boundary-copy">
            <p>Do not screenshot.</p>
            <p>Do not make it weird.</p>
            <p>Stay chill.</p>
          </div>
        </section>

        <section className="pricing reveal landing-panel visible" id="pricing">
          <div className="tiers">
            <article className="tier-card tier-featured">
              <h3>Monthly membership</h3>
              <p className="price">
                <span className="amount">$19.00</span>
              </p>
              <ul>
                <li>Keep it small.</li>
                <li>Cancel anytime.</li>
              </ul>
              <SubscriptionCheckoutButton />
            </article>
          </div>
          <p className="trust-line">
            <span className="trust-icon" aria-hidden="true">🔒</span> Secure payment via Stripe{" "}
            <span className="trust-sep">·</span>{" "}
            <span className="trust-icon" aria-hidden="true">✓</span> Cancel anytime
          </p>

          <LandingTipCheckout />
        </section>

        <section className="cta reveal landing-panel cta-panel visible">
          <p className="preview-sub">Join the Inner Circle</p>
          <p className="hero-promise">
            <span className="hero-promise-line">$19/month</span>
          </p>
          <p className="preview-sub">Keep it small.</p>
          <a href="#pricing" className="btn btn-primary btn-shine">
            Join the Inner Circle
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <div className="social-links" aria-label="Social links">
          <LandingSocialLinks idPrefix="footer" />
        </div>
        <p className="footer-legal">
          <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </footer>

      {/* Firebase: config comes from NEXT_PUBLIC_FIREBASE_* env at build time (lib/firebase.ts) */}
    </>
  );
}
