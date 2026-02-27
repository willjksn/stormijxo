# React / App Router migration status

Goal: everything runs as React in the Next.js App Router; no reliance on legacy HTML or script-injected behavior.

---

## Done (already React)

| Area | What |
|------|------|
| **Landing** | `app/page.tsx` — header, hero, pricing, tip, CTA, footer are React components (`LandingHeaderWithAuth`, `LandingHeroMedia`, `LandingSocialLinks`, `LandingTipCheckout`, `SubscriptionCheckoutButton`, `LandingCtaCount`). |
| **Member** | All member routes are App Router React: `/home`, `/post/[id]`, `/profile`, `/tip`, `/saved`, etc. |
| **Admin** | All admin routes are App Router React: dashboard, posts, media, content, users, etc. |
| **Auth** | Login/signup via `AuthModal` and React; success/post-payment flow in `app/success`. |
| **APIs** | All checkout and portal APIs are Next.js route handlers or Vercel functions. |
| **Legacy HTML** | Deprecated: `serve.json` has no rewrites; `.html` files are archival only. |

---

## Still not fully “React-native”

| Item | Current state | Target |
|------|----------------|--------|
| **Firebase config** | Loaded via `<Script src="/firebase-config.js">` and (on landing) compat scripts. `lib/firebase.ts` reads `window.FIREBASE_CONFIG` or env. | Use only `NEXT_PUBLIC_FIREBASE_*` from env at build time; remove Script tags and compat scripts so no runtime script injection. |
| **Legacy .html files** | ~20 files in repo (`index.html`, `member/*.html`, `admin/*.html`, etc.). Not served by Next in production. | Keep as reference or remove; document that App Router is the only live frontend. |
| **Global CSS** | All styles in `globals.css` (styles.css, member/*.css, auth-modal.css). A previous attempt to scope per-route broke the look. | Leave as-is for now. Later: move to CSS modules only for **new** components; refactor existing CSS incrementally. |

---

## Next steps to finish the React migration

1. **Firebase without Scripts**
   - Ensure `lib/firebase.ts` uses `NEXT_PUBLIC_FIREBASE_*` when available (already does).
   - Remove from landing page:
     - `<Script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js" />`
     - `<Script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js" />`
     - `<Script src="/firebase-config.js" />` (at least from `app/page.tsx`; layout may still need it until we confirm env is used everywhere).
   - In root layout: remove or replace `firebase-config.js` Script with env-based config so the client bundle gets config from build-time env only.
   - Optional: make `generate-firebase-config` optional (e.g. only run if env not set) or drop it once env is the single source.

2. **Legacy HTML**
   - Add a short `docs/LEGACY_HTML.md` that says these files are not the running app and list the App Router equivalents.
   - Optionally move them to e.g. `legacy-html/` or delete if you no longer need reference.

3. **Stability**
   - After each change: run `npm run verify:smoke` and do a quick manual test (landing, auth, member home, tip, profile).

---

## Order of work

1. Do **Firebase without Scripts** (step 1 above) so the app uses only React + env for Firebase config.
2. Then **document or relocate legacy HTML** (step 2).
3. Leave **global CSS** as-is until you’re ready for incremental CSS modules on new components only.
