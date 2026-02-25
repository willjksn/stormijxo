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
- **Member home ported**: `app/home/page.tsx` – `MemberHeader` + feed list using `demo-posts.ts`; post links use pretty URLs `/post/[id]`.
- **Other app routes**: `app/calendar/page.tsx`, `app/treats/page.tsx`, `app/admin/schedule/page.tsx`; `app/assets/[...path]/route.ts` for asset proxy.
- **Vercel**: `vercel.json` has redirects and rewrites to `.html`; with Next.js deployed on Vercel, App Router handles `/` and `/home` first. Rewrites may still apply to non-Next or static fallbacks.

### Pending / Next

- Add more features and UI/UX polish. ~~Optionally add pretty URLs for posts (`/post/[id]`).~~ **Done** (see 2026-02-22 session below). Continue Stripe wiring when ready.
- ~~Centralize auth/guards~~ Done: login at `/login`, `RequireAuth` on `/home`; config via `public/firebase-config.js` or `NEXT_PUBLIC_FIREBASE_*` (`.env.example`).
- High-priority migration complete: post, terms, privacy, success, signup. vercel.json Next-first. Admin nav seamless.
- ~~vercel.json Next-first~~ Done. “Next as primary” (e.g. remove or adjust rewrites that point at `.html` for routes already in the app).

---

## 2026-02-22 (later session)

### Completed

- **Pretty URLs for posts**: `/post/[id]` instead of `/post?id=...`. Added `app/(member)/post/[id]/page.tsx`; `/post` with `?id=` redirects to `/post/[id]`; feed and grid links updated to `/post/${id}` and `/post/${id}#comments`.
- **Member header (mobile)**: Fixed overflow/cutoff; logo/nav/Admin/avatar kept on one row where possible; Admin moved to profile dropdown on mobile/tablet (≤1024px); profile dropdown positioned (fixed) so not cut off; Treats no longer cut off; flex shrink so avatar stays visible; Admin hidden in dropdown on desktop (header only).
- **Landing/site header (mobile)**: Nav (Sign up / Log in) stays on same row as logo; smaller logo and padding.
- **Auth modal**: SJ_XO heart logo (`logo-auth.png`), size tweaks.
- **Feed/grid**: Removed “Home” and “Grid” titles from feed and grid views.
- **Logo behavior**: Member header logo → `/home`; landing logo → `/home` when logged in, `/` when not.
- **Sign out**: Full navigation to landing via `window.location.href = "/"` (avoids redirect to `/profile` or login).
- **Admin allowlist**: Correct admin email set to **stormij.xo@gmail.com** everywhere (`lib/auth-redirect.ts`, `public/admin/admin-auth.js`, `admin/admin-auth.js`, `member/member-header.js`).

### Current State

- Next.js app is primary; post URLs are pretty (`/post/demo-1`, etc.). Old `/post?id=x` still redirects to `/post/x`.
- Mobile headers (member + landing) are responsive; Admin in dropdown on small screens, in header on desktop.
- Stripe wiring deferred until desired features are in place.

### Pending / Next

- Continue adding features and UI/UX polish. Stripe when ready.


---

## 2026-02-25

### Completed

- **Admin Posts page** (Tools → Posts): Full create-post flow with:
  - Media: select from library (Firebase Storage `content/media/`) or upload from device; multiple images/videos per post.
  - Caption: textarea with emoji picker, “AI suggest” button (uses first image + profile bio; optional `OPENAI_API_KEY`).
  - Caption style: Static, Scroll up, Scroll across, Dissolve (displayed as overlay on media in feed and post detail).
  - Toggles: Hide comments, Hide likes per post.
  - Publish to Firestore `posts` (published, createdAt, mediaUrls, mediaTypes, captionStyle, hideComments, hideLikes).
- **Firebase Storage**: `getFirebaseStorage()` in `lib/firebase.ts`; `lib/media-library.ts` for list/upload to `content/media/`.
- **API**: `POST /api/caption-suggestion` (body: `imageUrl?`, `bio?`; returns `caption`; uses OpenAI when key set, else bio-based fallback).
- **Home feed**: Fetches published posts from Firestore; falls back to demo posts when none; caption overlay on media with animation by captionStyle; respects hideComments/hideLikes.
- **Post detail** (`/post/[id]`): Reads captionStyle, hideComments, hideLikes, mediaTypes; supports video; caption overlay with same styles; comments section hidden when hideComments.
- **Profile**: Edit display name, username, bio (unchanged; already saved to Firestore). **Change password** and **Change email** added: reauth with current password, then `updatePassword` / `updateEmail`.

### Current State

- Admin can create Instagram-style posts with multiple media, captions, overlay styles, and comment/like visibility.
- Members see Firestore posts on home (or demo); post page supports video and caption overlays.
- Profile supports display name, bio, and account security (password/email change with reauth).

### Pending / Next

- Optional: Wire grid view to Firestore posts. Optional: OPENAI_API_KEY for better AI captions.
- Stripe when ready.

### Risks / Notes

- Storage: `content/` is auth-only read/write; ensure admin is logged in when using Posts media.
- Profile password/email change requires email/password provider (not only Google).

---

## 2026-02-25 (later – media, tip, dashboard, docs)

### Completed

- **Media library**: Add folder writes to Firestore `mediaLibrary/config`; fixed doc path (`doc(db, "mediaLibrary", "config")`). Single view toggle button (Grid/List). List view shows item title; checkbox smaller in corner. Success message (e.g. “Folder added”) auto-dismisses after 3s. Firestore rules: `mediaLibrary` allow read/write when authenticated; rules deployed.
- **Post form**: Tip goal (enable, description, target $, progress bar, raised); Poll; Text overlay (on image) — each is expandable (“+ Add …” / “Cancel”). Cancel buttons use `btn btn-secondary`; tip goal Cancel wrapped in `admin-posts-poll-actions` for consistent size.
- **Tip page** (`/tip`): Title “Show Your Love”; subhead “No minimum — send what you like.” Removed duplicate “100%…” line. Footer: “Thank You!” + logo; logo uses `public/assets/sj-heart-icon.png` (or `assets/sj-heart-icon.png` via app route). Fallback text “SJ xo” if image fails. Script `scripts/make-white-transparent.js` makes white/light background transparent. Hero no negative margin; `isolation: isolate` on `.tip-page` to prevent pink bleed into header.
- **Member header**: Tip link with heart icon next to Treats; active for `/tip`. Admin tools nav order: **Calendar, Post, Media, Content**.
- **Feed**: Edit (pencil) icon for admins only (`isAdminEmail`), links to `/admin/posts?edit=<postId>`.
- **Admin dashboard – Content & engagement**: Three separate best-post cards in a grid:
  - **Most likes** – post this month with highest like count.
  - **Most comments** – post this month with highest comment count.
  - **Most tips** – post this month with highest `tipGoal.raisedCents`; card only shown when at least one post has tips. Demo placeholders for likes/comments when no posts; no tips card when no tip data. Smaller cards (`.best-post-card-sm`, `.best-posts-grid`).
- **Fixes**: AuthContext import in `app/(member)/home/page.tsx` uses `../../contexts/AuthContext` and `../../../lib/...` for root `lib/`. Firestore rules updated and deployed for `mediaLibrary`.

### Current State

- Media library folders work; tip page has logo and copy; dashboard shows three engagement cards (likes, comments, tips) with demo when empty.
- Post form has tip goal, poll, and text overlay as collapsible sections with consistent Cancel buttons.

### Next Steps

1. **Tip attribution**: When Stripe webhook receives a tip, attribute to post when `postId` present and increment that post's `tipGoal.raisedCents`. Show tip goal (description, progress bar) on feed/post detail and allow “Tip for this post” with attribution to `tipGoal.raisedCents`.
2. **Tip page hero image**: Optional configurable image (e.g. Firestore + admin upload).
3. **Stripe / webhooks**: Finish tip-checkout and success/cancel URLs when desired.

### 2026-02-25 (continuation)

- Logged-out redirect to landing (`/`) with `?redirect=...`; auth modal uses it after login.
- Calendar post image: SchedulePlanner normalizes `media` from Firestore; post card preview shows image.
- Poll/tip colors: pink gradient and pink/rose tip card.
- Tip goal on post detail: block + "Tip for this post" → `/tip?postId=<id>`; same link on feed cards with tip goal.

### What to Tell a New Agent

- Read **docs/AGENT_HANDOFF.md** first, then **docs/SESSION_NOTES.md**.
- Give a short, specific task list and say: “Keep pink-luxe style; don’t break routes or auth.”
- For handoff: “Continue from AGENT_HANDOFF.md; next steps are listed there and in SESSION_NOTES.md.”
