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
- Additional app routes: `app/calendar/page.tsx`, `app/treats/page.tsx`, `app/admin/schedule/page.tsx`; `app/assets/[...path]/route.ts` for assets.

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

