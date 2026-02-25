# Stormij_xo Agent Handoff

Use this file when starting a new chat so the next agent can continue without losing direction.

## Project Goal

Convert `Stormij_xo` from a multi-page static HTML app into a modern app experience:

- SPA-like UX (persistent shell/header, instant transitions)
- Vercel backend/API routes (Stripe now, AI features later)
- Keep current visual style (pink luxe) while improving consistency

## Current Status (What Is Done)

- Landing page has been heavily refreshed (copy + style polish).
- Landing headline/body tone updated to a conversational, premium/flirty feel.
- Member/admin header flicker issues were reduced with caching/layout-stability fixes.
- Stripe backend migration to Vercel API routes was started:
  - `api/tip-checkout.js`
  - `api/stripe-webhook.js`
  - `api/_lib/firebase-admin.js`
- Clean URL support and redirect fixes were added in `vercel.json`.
- Global styling in `styles.css` was expanded to align landing/admin/member visual language.
- **Next.js app shell scaffolded** (Next 16, React 19, TypeScript): `app/layout.tsx`, `app/globals.css` (imports `styles.css`, member-header.css, member-feed.css), `next.config.ts`, `tsconfig.json`.
- **Landing ported** to `app/page.tsx` (hero, perks, pricing, CTA, footer; pink-luxe preserved).
- **Member home ported** to `app/home/page.tsx` with `MemberHeader` and demo feed; `app/components/MemberHeader.tsx`, `app/home/demo-posts.ts`.
- Additional app routes: `app/calendar/page.tsx`, `app/treats/page.tsx`, `app/admin/schedule/page.tsx`; `app/assets/[...path]/route.ts` for asset proxy.
- **Full route migration complete**: `app/post/` (member), `app/terms/`, `app/privacy/`, `app/success/`, `app/signup/`. All `.html` links replaced with Next `Link`. `vercel.json` Next-first (no rewrites to static HTML).
- **404/build fixes**: `generate-firebase-config` writes to `public/firebase-config.js`; build script runs it before `next build`.
- **Admin nav**: Same-tab navigation, RequireAdmin shows header during auth check for seamless transition.
- **Pretty URLs for posts**: `/post/[id]` (e.g. `/post/demo-1`); `app/(member)/post/[id]/page.tsx`; `/post?id=x` redirects to `/post/x`.
- **Recent UX/auth/admin fixes** (see `docs/SESSION_NOTES.md` for details):
  - Member header mobile: overflow/cutoff fixed; Admin in profile dropdown on small screens (≤1024px), in header on desktop; profile dropdown positioned so not cut off; Admin hidden in dropdown on desktop.
  - Landing header mobile: nav on same row as logo.
  - Auth modal: SJ_XO logo; feed/grid titles removed.
  - Logo: `/home` when logged in, `/` when not (landing); member logo → `/home`.
  - Sign out: `window.location.href = "/"` so user lands on landing page.
  - Admin allowlist: `stormij.xo@gmail.com` in `lib/auth-redirect.ts` and legacy admin-auth/member-header scripts.
- **Admin Posts (Tools → Posts)**: create feed posts with media library/upload, captions, AI suggest, caption overlay styles, hide comments/likes; profile: edit display name/bio, change password/email (reauth).
- **Media library** (Admin → Media): Folders stored in Firestore `mediaLibrary/config`; single Grid/List toggle; list view shows item title with smaller corner checkbox; add folder works (Firestore rules allow `mediaLibrary` read/write when authenticated). Success messages auto-dismiss after 3s.
- **Post form sections**: Poll, Tip goal, and Text overlay (on image) are expandable: “+ Add …” opens the section, “Cancel” (secondary button) closes it. Tip goal: enable, description, target $, progress bar, raised amount. Text overlay: animation, overlay text, color, format (highlight/underline/italic).
- **Tip page** (`/tip`): “Show Your Love” hero; copy “No minimum — send what you like.”; footer “Thank You!” + SJ xo logo (`/assets/sj-heart-icon.png` in `public/assets/`). Logo can have transparent background via `node scripts/make-white-transparent.js assets/sj-heart-icon.png`. Card uses `isolation: isolate` so pink doesn’t bleed into header.
- **Member header**: Tip link (heart icon) next to Treats; active state for `/tip`. Admin nav order: **Calendar, Post, Media, Content**.
- **Feed**: Admins see a pencil (edit) icon on each post linking to `/admin/posts?edit=<postId>`. Uses `isAdminEmail()` from `lib/auth-redirect.ts`; edit icon only when `showAdminEdit` is true.
- **Admin dashboard – Content & engagement**: Two stat cards (Posts this month, Total likes) plus **three best-post cards** in a responsive grid:
  - **Most likes**: Post this month with highest like count (preview image, caption snippet, “X likes”, Edit post).
  - **Most comments**: Post this month with highest comment count (same layout).
  - **Most tips**: Post this month with highest tip goal raised (`tipGoal.raisedCents`); card only shown when at least one post has tips. Smaller card layout (`.best-post-card-sm`, `.best-posts-grid`). Demo placeholders when no data (likes/comments); no demo for tips.
- **Auth/imports**: Member home uses `../../contexts/AuthContext` and `../../../lib/...` for root `lib/`. Firestore rules: `mediaLibrary/{docId}` allow read, write when `request.auth != null`; deploy with `firebase deploy --only firestore:rules`.

## Important Context

- The user wants this to become a real app, not just static HTML pages.
- They want strong UX/UI first, then wire Stripe/AI details.
- They want design consistency across landing, member, and admin.
- They prefer pink tones and an elevated visual style.
- They are highly iterative and visual: expect many micro-adjustments.

## Recommended Architecture (Target)

- Frontend: `Next.js` + `React` + `TypeScript`
- Styling: Tailwind or CSS Modules (keep current tokens/look either way)
- Data/Auth: Firebase client SDK
- Backend: Vercel API routes for payments/webhooks/future AI endpoints

## Migration Plan (Incremental, Non-Breaking)

1. **Scaffold app shell**
   - Add Next.js app alongside existing HTML.
   - Create persistent layout/header.
2. **Port key routes first**
   - `/` (landing), `/home` (member feed) first.
3. **Centralize auth/guards**
   - Replace per-page auth scripts with shared guard logic.
4. **Componentize UI**
   - Header, buttons, cards, modals, stat blocks.
5. **Move data logic into hooks/services**
   - Firestore reads/writes and caching in one layer.
6. **Keep existing pages as fallback**
   - Cut over route-by-route; remove old pages only after parity.

## Files to Review First

- `styles.css`
- `index.html`
- `member/member-header.js`
- `member/member-header.css`
- `admin/admin-auth.js`
- `api/tip-checkout.js`
- `api/stripe-webhook.js`
- `vercel.json`
- `serve.json`

## Next Chat Prompt Template (Copy/Paste)

```text
Read docs/AGENT_HANDOFF.md first, then continue from there.

Goal for this session:
1) [exact outcome]
2) [exact outcome]

Constraints:
- Keep current visual style (pink luxe).
- Do not break existing routes.
- Make incremental, non-breaking changes only.

Before editing:
- Briefly list files you will change and why.
```

## Next Steps (Suggested)

1. **Tip goal on member side**: Posts store `tipGoal`; member feed and post detail don’t yet show the goal (description, progress bar) or a “Tip for this post” action. Optionally attribute tips to a post (e.g. `postId` in checkout/webhook and update `tipGoal.raisedCents`).
2. **Tip page image**: Optional admin-configurable hero image (e.g. Firestore `siteConfig/tipPage.imageUrl` + upload in admin) instead of gradient-only hero.
3. **Grid view**: Optionally wire grid view to Firestore posts if not already.
4. **Stripe / payments**: Continue wiring when ready (tip-checkout, webhooks, success/cancel URLs).
5. **OPENAI_API_KEY**: Set for better AI caption suggestions on Posts.

## What to Say to a New Chat Agent

Copy/paste something like this when starting a new chat:

```text
Read docs/AGENT_HANDOFF.md first, then docs/SESSION_NOTES.md for recent session details.

Goal for this session:
- [Your specific goal, e.g. "Show tip goal on the post detail page and let fans tip toward it"]
- [Any other goals]

Constraints:
- Keep current visual style (pink luxe).
- Don’t break existing routes or auth (admin allowlist, member routes).
- Make incremental, non-breaking changes.

Before editing: briefly list the files you’ll change and why.
```

Or shorter:

```text
Read docs/AGENT_HANDOFF.md. Then [describe your task]. Keep pink-luxe style and don’t break existing routes.
```

## Best Method for New Chat Windows

- Keep this file updated at the end of each major session.
- In each new chat, start with:
  1) “Read `docs/AGENT_HANDOFF.md` first”
  2) a short, specific task list
  3) constraints (design, routing, non-breaking)
- If a session makes major decisions, append them to this file immediately.

## Optional Add-On (Recommended)

Create a second file `docs/SESSION_NOTES.md` for quick chronological logs:

- Date
- What changed
- What is pending
- Risks/open questions

This makes continuity even better when context windows reset.

