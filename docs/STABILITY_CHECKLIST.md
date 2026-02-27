# Stability checklist — App Router migration

Use this before and after any migration work so we don't break the live app.

## Quick smoke check

Run before committing or deploying:

```bash
npm run verify:smoke
```

This runs a full Next.js build (including Firebase config generation). If it passes, TypeScript compiles and the app bundle is valid.

**Note:** The build needs Firebase env vars (e.g. from `.env.local`) for `generate-firebase-config`. Run `verify:smoke` in an environment where those are set (or the generate script will exit before `next build`).

---

## What must keep working

### Routes & access

- [ ] **Landing** — `/` loads; hero, pricing, tip section, auth modal (Join / Sign up / Log in).
- [ ] **Member** — `/home`, `/post/[id]`, `/profile`, `/tip`, `/saved` require auth + active membership (or admin); redirect to `/?auth=signup&pay=required` when not paid.
- [ ] **Admin** — `/admin/*` requires admin email; dashboard, posts, media, calendar work.
- [ ] **Success** — `/success` handles `?tip=1` and `?signup=1&email=...` (post-payment account creation).

### Auth & payments

- [ ] **Signup** — Landing "Join" / "Sign up" → auth modal → Continue → Stripe Checkout (no Firebase user until after payment).
- [ ] **Login** — Existing paid member can log in and land on `/home`; unpaid logged-in user gets `?pay=required` and checkout.
- [ ] **Landing tip** — Anonymous; no login; calls `/api/landing-tip`; buttons work after closing modal and after browser back from Stripe.
- [ ] **In-app tip** — From feed post or `/tip` page; uses `/api/tip-checkout`; modal presets + custom amount; no "post not locked" for tips.
- [ ] **Unlock** — Locked post "Unlock" uses `/api/unlock-checkout` only (not tip).
- [ ] **Manage subscription** — Profile "Manage subscription" opens Stripe portal; disabled for admins without a Stripe membership link.

### Visuals & UX

- [ ] **Global styles** — `styles.css`, `member/*.css`, `auth-modal.css` applied (currently via `app/globals.css`); pink luxe look intact.
- [ ] **Landing** — Hero media (Firestore `site_config/landing`), social links, testimonial/CTA content load.
- [ ] **Feed** — Posts, Send Tip button (when `showTipButton !== false`), comments, likes, save.

### Data & APIs

- [ ] **Stripe webhook** — `api/stripe-webhook.js` handles `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.paid`; writes to `members`, `tips`, `subscriptionPayments`, etc.
- [ ] **Admin dashboard** — Total revenue includes tips + subscriptions + store; top spenders; "Last 12 months" show/hide works.

---

## Before making migration changes

1. Run `npm run verify:smoke`.
2. Do a quick manual pass: land on `/`, open auth modal, go to `/home` (if you have a test member), open a post, try tip flow.
3. Note which files you're about to change.

---

## After making migration changes

1. Run `npm run verify:smoke` again.
2. Re-check the "What must keep working" items that your change could affect.
3. If you moved or renamed CSS/scripts, confirm no missing imports or 404s.

---

## Migration progress (high level)

| Area              | Status | Notes |
|-------------------|--------|--------|
| App Router routes | Done   | Landing, member, admin, success, tip, unlock, customer-portal. |
| Landing React     | Done   | Hero media, tip checkout, auth modal, social links, content from Firestore. |
| Global CSS        | Reverted | Scoping attempt reverted; all CSS still in `globals.css`. |
| Legacy HTML       | Deprecated | `serve.json` rewrites disabled; `index.html` etc. archival only. |
| Stability script  | Done   | `npm run verify:smoke` = build. |

**Next safe steps**

- Add more automated checks to `verify:smoke` (e.g. lint, or a minimal route list) if desired.
- When touching CSS again: change one layout/route at a time and run smoke + visual check; prefer CSS modules or scoped styles for new components only.
- Replace remaining legacy scripts or static sections with React components incrementally; one PR per area.

---

## If something breaks

1. Run `npm run verify:smoke` to see if it's a build error.
2. Check the "What must keep working" list for the broken flow.
3. Revert the last change and re-apply in smaller steps.
4. Update this checklist if a new "must work" flow is added.
