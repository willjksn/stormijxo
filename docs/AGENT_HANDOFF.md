# Stormij_xo Agent Handoff

Use this file when starting a new chat so the next agent can continue without losing direction.

## Project Goal

Convert `Stormij_xo` from a multi-page static HTML app into a modern app experience:

- SPA-like UX (persistent shell/header, instant transitions)
- Vercel backend/API routes (Stripe now, AI features later)
- Keep current visual style (pink luxe) while improving consistency

## Current Status (What Is Done)

- App Router migration is fully active for member/admin/legal/checkout flows; the product now runs as a Next.js app-first experience.
- Landing page (`app/page.tsx`) is live with refreshed copy/styling and Stripe pricing CTA. **Subscription** uses Checkout Session API (not Payment Link): “Join” calls **POST /api/subscription-checkout** with optional customer_email/uid; set **STRIPE_PRICE_ID_MONTHLY** (or STRIPE_SUBSCRIPTION_PRICE_ID) to your recurring price ID.
- Member feed (`app/(member)/home/page.tsx`) now supports:
  - clickable likes per signed-in user (`likedBy` + `likeCount`)
  - comment modal (opens from comment icon) with inline composer
  - admin comment moderation in modal (hide/unhide/delete)
  - saved posts (`savedPostIds` on user doc), with `/saved` page and unsave action
- Post detail (`app/(member)/post/[id]/page.tsx`) supports member comments, admin replies, and full emoji picker flow.
- Emoji picker behavior has been normalized across profile/admin/posts and comment/reply inputs (search + categories + outside-click close).
- Member profile (`app/(member)/profile/page.tsx`) updates:
  - change-email section removed
  - manage subscription calls `/api/customer-portal`
  - customer-portal route hardened for mixed field names and email case; can recover Stripe customer ID from subscription ID.
- Stripe tip flow updates:
  - Landing tip buttons are wired again and keep labels visible during redirect.
  - In-app tip page keeps "select amount, then tap Tip" behavior.
  - API accepts `amountCents` and legacy `amount`.
  - Tip metadata carries `tip_post_id`; webhook increments `post.tipGoal.raisedCents` when applicable.
- Treats for members is intentionally disabled (visible nav item but non-clickable; member treats page returns "coming soon").
- Calendar/admin schedule polish:
  - calendar cards slightly smaller
  - media fill adjusted (no white edges)
  - preview cleaned: removed "X • Post" and "Export", delete moved into edit/reschedule controls
- Landing pricing copy currently reflects `$19` in key visible CTA text.
- Best-effort media protection guardrails were added for member routes (context menu/drag/save-print shortcut deterrents + video download control restrictions). Note: screenshot prevention cannot be guaranteed on web.

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
- `app/page.tsx`
- `app/(member)/home/page.tsx`
- `app/(member)/post/[id]/page.tsx`
- `app/(member)/profile/page.tsx`
- `app/(member)/tip/page.tsx`
- `app/(member)/saved/page.tsx`
- `app/components/MemberHeader.tsx`
- `app/api/customer-portal/route.ts`
- `app/api/tip-checkout/route.ts`
- `api/tip-checkout.js`
- `api/stripe-webhook.js`
- `app/calendar/page.tsx`
- `app/calendar/calendar.module.css`

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

1. **Roadmap:** See **docs/ROADMAP.md** for where to start: Stripe + members → Treats → DM / Go Live / Chat, and what’s still unwired.
2. **Subscription portal verification**: If users still fail to redirect, inspect prod member docs for `stripeCustomerId/stripeSubscriptionId` data quality and webhook history.
2. **Media protection hardening**: Consider signed/expiring media URLs and stricter delivery controls (UI-only protections are deterrents, not guarantees).
3. **Treats relaunch switch**: Re-enable member Treats nav/page once checkout/inventory flow is stable.
4. **Landing pricing consistency**: Ensure all legacy/static surfaces and Stripe product references match current offer copy.
5. **Operational polish**: Keep `docs/SESSION_NOTES.md` current for release-level changes and rollback context.

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

