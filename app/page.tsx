import Link from "next/link";
import Script from "next/script";
import { Suspense } from "react";
import { LandingHeaderWithAuth } from "./components/LandingHeaderWithAuth";
import { LandingCtaCount } from "./components/LandingContent";
import { LandingSocialLinks } from "./components/LandingSocialLinks";

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
                <span className="amount">$12.00</span>
              </p>
              <ul>
                <li>Keep it small.</li>
                <li>Cancel anytime.</li>
              </ul>
              <a href="https://buy.stripe.com/4gM4gB2LM5m4brQgHvds400" className="btn btn-primary btn-shine">
                Join the Inner Circle - $12/mo
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
              <button type="button" className="btn btn-tip" data-amount="300">$3</button>
              <button type="button" className="btn btn-tip" data-amount="500">$5</button>
              <button type="button" className="btn btn-tip" data-amount="1000">$10</button>
              <button type="button" className="btn btn-tip" data-amount="2000">$20</button>
            </div>
            <div className="tip-custom">
              <label htmlFor="tip-custom-amount" className="tip-custom-label">Or enter an amount (USD)</label>
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
            <p id="tip-error" className="tip-error" style={{ display: "none" }} />
          </div>
        </section>

        <section className="cta reveal landing-panel cta-panel visible">
          <LandingCtaCount />
          <p className="preview-sub">Join the Inner Circle</p>
          <p className="hero-promise">
            <span className="hero-promise-line">$12/month</span>
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

      <Script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js" strategy="afterInteractive" />
      <Script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js" strategy="afterInteractive" />
      <Script src="/firebase-config.js" strategy="afterInteractive" />
      <Script src="/landing-media.js" strategy="afterInteractive" />
      <Script id="landing-tip-checkout" strategy="afterInteractive">{`
        (function() {
          var tipUrl = "/api/tip-checkout";
          var cancelUrl = window.location.href;
          var base = window.location.origin;
          var successUrl = base + "/success?tip=1";
          var errEl = document.getElementById("tip-error");
          var tipHandleInput = document.getElementById("tip-instagram-handle");
          var customInput = document.getElementById("tip-custom-amount");
          var customBtn = document.getElementById("tip-custom-btn");
          function setError(msg) {
            if (!errEl) return;
            errEl.textContent = msg || "";
            errEl.style.display = msg ? "block" : "none";
          }
          function setLoading(isLoading) {
            document.querySelectorAll(".btn-tip").forEach(function(b) {
              b.disabled = isLoading;
              if (b.getAttribute("data-amount")) {
                var cents = Number(b.getAttribute("data-amount") || "0");
                b.textContent = isLoading ? "…" : "$" + Math.round(cents / 100);
              } else if (b.id === "tip-custom-btn") {
                b.textContent = isLoading ? "…" : "Tip";
              }
            });
          }
          function startTip(amountCents) {
            if (!amountCents || amountCents < 100 || amountCents > 100000) return;
            setError("");
            setLoading(true);
            var instagramHandle = tipHandleInput ? String(tipHandleInput.value || "").trim() : "";
            fetch(tipUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amountCents: amountCents,
                success_url: successUrl,
                cancel_url: cancelUrl,
                instagram_handle: instagramHandle
              })
            }).then(function(r) {
              return r.json().catch(function(){ return {}; }).then(function(d){ return { ok: r.ok, data: d }; });
            }).then(function(result) {
              if (result.ok && result.data && result.data.url) {
                window.location.href = result.data.url;
                return;
              }
              setLoading(false);
              setError((result.data && result.data.error) || "Could not start checkout.");
            }).catch(function() {
              setLoading(false);
              setError("Could not start checkout. Try again.");
            });
          }
          document.querySelectorAll(".btn-tip[data-amount]").forEach(function(btn) {
            btn.addEventListener("click", function() {
              var amount = parseInt(this.getAttribute("data-amount"), 10);
              if (!amount) return;
              startTip(amount);
            });
          });
          if (customBtn && customInput) {
            var customClick = function() {
              var val = parseFloat(customInput.value || "");
              if (isNaN(val) || val < 1 || val > 1000) {
                setError("Enter an amount between $1 and $1000.");
                return;
              }
              startTip(Math.round(val * 100));
            };
            customBtn.addEventListener("click", customClick);
            customInput.addEventListener("keydown", function(e) {
              if (e.key === "Enter") {
                e.preventDefault();
                customClick();
              }
            });
          }
        })();
      `}</Script>
    </>
  );
}
