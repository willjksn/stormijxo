# Stormij_xo — Roadmap & Where to Start

Use this with **docs/AGENT_HANDOFF.md** and **docs/SESSION_NOTES.md**. Goal: get Stripe and core flows working, then Treats, then new features (DM, Go Live, Chat).

---

## Where to Start (Recommended Order)

### Phase 1: Stripe & members (do this first)

1. **Subscription checkout → member creation**
   - **Now using Checkout Session API (not Payment Link):** Landing “Join” button calls **POST /api/subscription-checkout**, which creates a Stripe Checkout Session with your existing **Stripe Price ID** (env: `STRIPE_PRICE_ID_MONTHLY` or `STRIPE_SUBSCRIPTION_PRICE_ID`). Same pattern as EchoFlux and your tip flow.
   - **Set env:** In Vercel (and .env.local), set `STRIPE_PRICE_ID_MONTHLY` (or `STRIPE_SUBSCRIPTION_PRICE_ID`) to your recurring price ID (e.g. `price_xxx` from Stripe Dashboard → Products → [Your product] → Price).
   - **Success URL:** Checkout success goes to `/success`; cancel goes to `/#pricing`.
   - **Webhook:** Point Stripe to `https://your-domain.com/api/stripe-webhook` (Vercel) or your Firebase webhook URL. On `checkout.session.completed` (subscription), the webhook creates a `members` doc. If the customer went through the app while signed in, we pass `uid` in metadata and the webhook stores it on the member so “Manage subscription” works by uid.
   - **Optional:** When user is signed in on the landing page, the Join button sends their `customer_email` and `uid` so Stripe prefills email and the webhook links the new member to that Firebase user.

2. **Manage subscription (customer portal)**
   - **Current:** Profile → “Manage subscription” calls **/api/customer-portal** (and **api/customer-portal.js** as fallback). We added uid/email fallback and member lookup by uid so it should work if the user has a `members` doc with stripeCustomerId.
   - **If it still 400s:** Confirm in Firestore that the signed-in user has a `members` document whose `email` (or linked `uid`) matches the auth user, and that the doc has `stripeCustomerId` or `stripeSubscriptionId`. If members are created only by webhook after Payment Link checkout, users who never completed that flow won’t have a member doc.

3. **New users “added correctly” after signup**
   - **Current:** **Signup** (app/signup) creates only Firebase Auth + **users/{uid}** (email, displayName, username). It does **not** create a `members` doc or run Stripe.
   - **Two flows:**
     - **A – Subscribe first (Payment Link):** User pays on Stripe → webhook creates `members` by email. They may never create a Firebase account; member area is then gated by your member-access (e.g. email allowlist or manual add).
     - **B – Sign up first:** User signs up → has `users` doc only. To become a “member” they must complete subscription checkout (e.g. from landing “Join” link). After payment, webhook creates `members` by email. To link the two, you can add a step that matches `members.email` to `users` and sets `members.uid = user.uid` (e.g. on first sign-in after payment, or via a small “Link account” flow).
   - **Recommendation:** Keep signup as-is for account creation. Ensure subscription checkout (Payment Link or a future in-app checkout) is the single place that creates/updates `members`. Then add optional “link member to user” when someone signs in with an email that exists in `members` (e.g. set `members.uid` or `members.userId` so customer portal and gating work by uid as well).

4. **Optional: Gate member area by membership**
   - **Current:** **RequireAuth** only checks Firebase Auth; it does not check `members` or subscription status. So anyone with an account can open /home, /profile, etc.
   - To restrict to paying members only: after auth, look up `members` by email or uid; if missing or status !== 'active', redirect to landing or a “Renew” page. This depends on Phase 1.1–1.3 being solid so every subscriber has a member doc.

---

### Phase 2: Treats store

5. **Enable Treats**
   - **Current:** Member **Treats** page has `STORE_ENABLED = false` and shows “Coming soon.” **app/api/treat-checkout/route.ts** and **api/stripe-webhook.js** already handle treat purchases (one-time payment, decrement `treats.quantityLeft`, write to `purchases`).
   - **Steps:**  
     (1) Set `STORE_ENABLED = true` in **app/(member)/treats/page.tsx**.  
     (2) Ensure Firestore **treats** collection exists and is readable by members (and admin can write).  
     (3) Ensure Stripe webhook receives `checkout.session.completed` for mode `payment` with `metadata.type === 'treat'` (already handled in webhook).  
     (4) Optionally make the Treats nav link clickable everywhere (it’s already there; removing any “coming soon” guard in the header if present).
   - **Admin:** Admin Treats page already exists to manage treats (CRUD). No change needed for basic enablement.

---

### Phase 3: New features (after Stripe + Treats are solid)

6. **Direct Message (DM) system**
   - New feature: creator ↔ member (and possibly member ↔ member) private messages.
   - Needs: Firestore collection(s) for threads/messages, auth rules, UI (inbox, thread view, composer), and optionally notifications.

7. **Go Live + live stream comments**
   - In-app “go live” (e.g. video stream) with members commenting in real time.
   - Needs: streaming (e.g. LiveKit, Mux, or browser WebRTC), a “live” state, and a real-time comment channel (Firestore or same provider). Larger scope; can start with “live” badge + link to external stream plus a simple live-chat channel.

8. **Live chat / async chat**
   - Could be the same as “live stream comments” or a separate always-on room.
   - Needs: real-time messages (Firestore `onSnapshot` or a dedicated chat service), UI, and moderation.

---

## What’s still not wired / to consider

| Area | Status / note |
|------|----------------|
| Subscription checkout | Payment Link works externally; confirm webhook URL (Vercel vs Firebase) and that `members` are created. |
| Customer portal | API and fallback route updated; confirm in prod that member doc exists and has Stripe IDs. |
| Signup → member | Signup does not create `members`. Members come from Stripe webhook. Optionally link `users` ↔ `members` by email/uid. |
| Member gating | Member routes require only Auth, not `members` or status. Add check in RequireAuth or layout if you want only subscribers in. |
| Success page | Optional “confirm email” form adds a `members` doc manually; webhook should already create one for subscription. Avoid duplicate members (e.g. by using setDoc with email as id or merge). |
| Treats | Disabled by flag; backend and webhook ready. Enable when you want store live. |
| Landing pricing | Copy says $19; ensure Stripe product/price matches. |

---

## Suggested first steps (concrete)

1. **Confirm webhook endpoint:** In Stripe Dashboard, note which URL receives `checkout.session.completed`. If it’s a Firebase function URL, either keep it and ensure the function creates `members` with the same shape as **api/stripe-webhook.js**, or add a Vercel webhook and point Stripe to it (e.g. `https://stormijxo.com/api/stripe-webhook`) so one place handles all events.
2. **Test subscription flow:** Use Stripe test mode: complete a subscription payment via the Payment Link, then check Firestore for a new `members` doc with email, stripeCustomerId, stripeSubscriptionId. Then sign in with that email (or link the member to a test user) and try “Manage subscription” from the profile.
3. **Document the flow:** In AGENT_HANDOFF or SESSION_NOTES, write: “Subscription: Payment Link → success URL /success; webhook: [URL]; webhook creates members in Firestore.”
4. **Then:** Enable Treats (set `STORE_ENABLED = true` and test one treat purchase end-to-end).
5. **Then:** Plan DM and Go Live / Chat (data model, auth rules, then UI).

---

## Files to touch by phase

- **Phase 1:**  
  - Webhook: **api/stripe-webhook.js** (or Firebase **functions/index.js** if you use that).  
  - Portal: **app/api/customer-portal/route.ts**, **api/customer-portal.js**, **app/(member)/profile/page.tsx** (already updated).  
  - Optional link member↔user: e.g. **app/(member)/layout.tsx** or a small **lib/link-member.ts** called after login.  
  - Optional member gating: **app/components/RequireAuth.tsx** or **app/(member)/layout.tsx**.
- **Phase 2:**  
  - **app/(member)/treats/page.tsx** (`STORE_ENABLED`), **app/components/MemberHeader.tsx** (if Treats nav is still disabled), Firestore rules for **treats** and **purchases**.
- **Phase 3:**  
  - New collections, rules, and components (DM, live, chat).

Keeping **docs/SESSION_NOTES.md** updated after each change will help the next session continue from here.
