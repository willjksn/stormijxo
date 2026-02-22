import Link from "next/link";
import Script from "next/script";
import { LandingHeaderWithAuth } from "./components/LandingHeaderWithAuth";

function SocialLinksFallback({ idPrefix = "social" }: { idPrefix?: string }) {
  const igGradId = idPrefix + "-ig-grad";
  return (
    <>
      <a href="#" aria-label="instagram">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={igGradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: "#FED576" }} />
              <stop offset="25%" style={{ stopColor: "#F47133" }} />
              <stop offset="50%" style={{ stopColor: "#BC3081" }} />
              <stop offset="100%" style={{ stopColor: "#4C63D2" }} />
            </linearGradient>
          </defs>
          <path
            fill={`url(#${igGradId})`}
            d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.058 1.645-.07 4.849-.07zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm5.965-10.405a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
          />
        </svg>
      </a>
      <a href="#" aria-label="facebook">
        <svg viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </a>
      <a href="#" aria-label="x">
        <svg viewBox="0 0 24 24" fill="#0F1419" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
      <a href="#" aria-label="tiktok">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path fill="#000" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1.05-.08 6.33 6.33 0 00-6.33 6.34 6.33 6.33 0 0010.88 4.41 6.34 6.34 0 00.63-2.56V9.01a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
          <path fill="#25F4EE" d="M19.59 2v4.44a4.83 4.83 0 01-1-.1V2z" />
          <path fill="#25F4EE" d="M15.82 6.44v3.45a2.92 2.92 0 01-2.31-1.74 2.93 2.93 0 01-.88-.13v6.63a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 015.2-1.74v-6.63a2.93 2.93 0 01.88.13 2.89 2.89 0 002.31 1.74z" />
          <path fill="#FE2C55" d="M12.63 9.4v6.27a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 015.2-1.74V9.4z" />
        </svg>
      </a>
      <a href="#" aria-label="youtube">
        <svg viewBox="0 0 24 24" fill="#FF0000" xmlns="http://www.w3.org/2000/svg">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      </a>
    </>
  );
}

export default function LandingPage() {
  return (
    <>
      <LandingHeaderWithAuth />

      <main>
        <section className="hero reveal visible">
          <div className="hero-image-wrap" data-landing-slot="hero">
            <img
              src="/images/hero.png"
              alt="Creator"
              className="hero-image"
              data-landing-default
            />
          </div>
          <div className="hero-text">
            <h1 className="hero-name hero-stagger" style={{ ["--delay" as string]: "0.1s" }}>
              Not For Everyone
            </h1>
            <p className="hero-handle-line hero-stagger" style={{ ["--delay" as string]: "0.25s" }}>
              <span className="hero-social-links" id="hero-social-links" aria-label="Social links">
                <SocialLinksFallback idPrefix="hero" />
              </span>
            </p>
            <p className="hero-tagline hero-stagger" style={{ ["--delay" as string]: "0.4s" }}>
              Just for the ones who stay.
            </p>
            <p className="hero-promise hero-stagger" style={{ ["--delay" as string]: "0.55s" }}>
              <span className="hero-promise-line">Same me</span>
            </p>
            <p className="hero-tagline hero-stagger" style={{ ["--delay" as string]: "0.7s" }}>
              Closer access.
            </p>
          </div>
        </section>

        <div className="section-divider" aria-hidden="true" />

        <section className="perks reveal landing-panel visible">
          <h2 className="section-title">Why This Exists</h2>
          <div className="conversation-copy">
            <p>Social media is fun.</p>
            <p>But sometimes I want to talk without thousands of people watching.</p>
            <p>I have a 9-5. And I am building my way out of it.</p>
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
              <span className="tier-ribbon">Join the Inner Circle</span>
              <h3>Monthly membership</h3>
              <p className="price">
                <span className="amount">$19.00</span>
              </p>
              <ul>
                <li>Keep it small.</li>
                <li>Cancel anytime.</li>
              </ul>
              <a href="https://buy.stripe.com/4gM4gB2LM5m4brQgHvds400" className="btn btn-primary btn-shine">
                Join the Inner Circle - $19/mo
              </a>
            </article>
          </div>
          <p className="trust-line">
            <span className="trust-icon" aria-hidden="true">🔒</span> Secure payment via Stripe{" "}
            <span className="trust-sep">·</span>{" "}
            <span className="trust-icon" aria-hidden="true">✓</span> Cancel anytime
          </p>

          <div className="tip-section reveal visible">
            <p className="tip-heading">Want to show love?</p>
            <p className="tip-sub">One-time tip - no subscription.</p>
            <div className="tip-meta">
              <input
                type="text"
                id="tip-instagram-handle"
                className="tip-custom-input tip-handle-input"
                maxLength={64}
                placeholder="(optional) Who's showing love?"
                aria-label="Instagram handle (optional)"
              />
            </div>
            <div className="tip-buttons">
              <button type="button" className="btn btn-tip">$3</button>
              <button type="button" className="btn btn-tip">$5</button>
              <button type="button" className="btn btn-tip">$10</button>
              <button type="button" className="btn btn-tip">$20</button>
            </div>
            <div className="tip-custom">
              <label htmlFor="tip-custom-amount" className="tip-custom-label">Or enter an amount</label>
              <div className="tip-custom-row">
                <div className="tip-input-wrap">
                  <span className="tip-custom-prefix">$</span>
                  <input
                    type="number"
                    id="tip-custom-amount"
                    className="tip-custom-input"
                    min={1}
                    max={1000}
                    step={1}
                    placeholder="e.g. 25"
                    inputMode="decimal"
                    aria-label="Tip amount in dollars"
                  />
                </div>
                <button type="button" className="btn btn-tip btn-tip-custom" id="tip-custom-btn">Tip</button>
              </div>
            </div>
          </div>
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
          <SocialLinksFallback idPrefix="footer" />
        </div>
        <p className="footer-legal">
          <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </footer>

      <Script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js" strategy="afterInteractive" />
      <Script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js" strategy="afterInteractive" />
      <Script src="/firebase-config.js" strategy="afterInteractive" />
      <Script src="/landing-media.js" strategy="afterInteractive" />
    </>
  );
}
