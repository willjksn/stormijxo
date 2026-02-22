# Session Notes

Use this file as a chronological log for continuity across chat windows.

## 2026-02-20

### Completed

- Polished landing page structure and copy:
  - conversational tone updates for "Why This Exists", "What You Get", and "The Energy"
  - removed unwanted bullets/images/buttons where requested
  - adjusted section order (Boundary above pricing)
- Tuned hero text treatment repeatedly per visual feedback:
  - headline/font/casing/spacing/color refinements
  - matched bright pink emphasis across key text
- Replaced decorative wave divider with a cleaner minimal divider.
- Applied broad cross-app visual harmonization in `styles.css`:
  - admin/member/header/card/button styling aligned closer to landing page system
  - added admin typography refinement pass
  - added cross-app button consistency pass
- Created handoff guide:
  - `docs/AGENT_HANDOFF.md`

### Current State

- UI direction is strongly toward a consistent pink-luxe theme.
- App still uses multi-page HTML architecture with shared CSS and page scripts.
- User intent is to move to a true app architecture (SPA-like UX + Vercel APIs).

### Pending / Next

- Begin incremental app migration:
  1. scaffold Next.js + TypeScript app shell
  2. port landing and `/home` first
  3. centralize auth/route guards
  4. continue route-by-route migration
- Continue visual parity checks while migrating components.

### Risks / Notes

- Many admin pages still contain large inline `<style>` blocks that may partially override shared theme behavior.
- Stripe wiring is intentionally de-prioritized while UI/UX and app structure are stabilized first.

---

## 2026-02-22

### Current State (verified)

- **Next.js app shell is in place**: `app/layout.tsx`, `app/globals.css`, `next.config.ts`, `tsconfig.json`. `globals.css` imports root `styles.css`, `member/member-header.css`, and `member/member-feed.css` so the pink-luxe theme carries into the app.
- **Landing ported**: `app/page.tsx` – hero, perks, pricing, CTA, footer; still uses some `.html` links (e.g. signup, login, terms, privacy) and external scripts (Firebase, landing-media.js).
- **Member home ported**: `app/home/page.tsx` – `MemberHeader` + feed list using `demo-posts.ts`; post links still use `href="/post?id=..."` (could be Next `Link` later).
- **Other app routes**: `app/calendar/page.tsx`, `app/treats/page.tsx`, `app/admin/schedule/page.tsx`; `app/assets/[...path]/route.ts` for asset proxy.
- **Vercel**: `vercel.json` has redirects and rewrites to `.html`; with Next.js deployed on Vercel, App Router handles `/` and `/home` first. Rewrites may still apply to non-Next or static fallbacks.

### Pending / Next

- Replace remaining `.html` links in the app with Next.js routes (e.g. `/signup`, `/login`, `/terms`, `/privacy`) when those pages are ported, or keep linking to existing HTML until then.
- ~~Centralize auth/guards~~ Done: login at `/login`, `RequireAuth` on `/home`; config via `public/firebase-config.js` or `NEXT_PUBLIC_FIREBASE_*` (`.env.example`).
- Continue route-by-route migration (e.g. post, grid, profile, admin) with parity checks.
- Optionally align `vercel.json` with “Next as primary” (e.g. remove or adjust rewrites that point at `.html` for routes already in the app).

