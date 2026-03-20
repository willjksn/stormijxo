# EchoFlux Fan Hub — parity handoff (Stormij_xo changes)

Use this document to replicate the same behaviors in **EchoFlux Fan Hub**. Assumptions mirror Stormij: **Next.js + Firebase (Firestore client)**, **Stripe**, **1:1 DMs** under `conversations/{memberUid}/messages`, **members** collection for subscriptions.

---

## 1. Member subscription access end (cancelled / period end)

### Problem
- `access_ends_at` could be wrong (e.g. cancel time) while `current_period_end` on the same doc still had the real billing end.
- Using **first non-null** field (`access_ends_at ?? …`) picked the wrong date → UI showed **Expired** too early.

### Solution
1. **`parseDateLike(value)`** — Parse Firestore `Timestamp`, `Date`, unix sec/ms, ISO strings, `{ seconds }` / `{ toDate() }`.
2. **`pickLatestMemberAccessEnd(doc)`** — Parse **all** of these fields and take the **latest** valid date:
   - `access_ends_at`, `accessEndsAt`, `current_period_end`, `currentPeriodEnd`
3. Use that single date everywhere you compute “access until” or gate membership for **cancelled** users.

### Files (Stormij reference)
- `lib/member-access-end.ts` — `parseDateLike`, `pickLatestMemberAccessEnd`
- `lib/auth-redirect.ts` — `isMembershipDocActive`: for `status === "cancelled"`, use `pickLatestMemberAccessEnd(docData)` instead of only `access_ends_at`
- `app/admin/(authenticated)/users/page.tsx` — When building member rows from Firestore, set `accessEndsAt = pickLatestMemberAccessEnd(d)` (not `??` chain)
- `app/(member)/profile/page.tsx` — `pickPlanFromDoc`: `accessEndsAt: pickLatestMemberAccessEnd(data)`; optional `useMemo` for `cancelledAccessDaysLeft`

### Admin UI copy (“Remaining access”)
- Short date: `toLocaleDateString` with `{ month: "short", day: "numeric", year: "numeric" }` (no weekday).
- If end **in the past** → show **`Expired`**.
- If end **in the future** → show **`until Apr 18, 2026 (30 days left)`** (lowercase **until**, include day count for 1 or N days).

### Backfill script (optional ops tool)
- `scripts/backfill-member-access-ends-at.js` — For cancelled members, set `access_ends_at` from Stripe (`current_period_end` preferred, then `ended_at`, then `canceled_at`).
- Flags: `--dry-run`, **`--force`** (re-fetch from Stripe even if `access_ends_at` already exists; skip write if Stripe date equals existing).
- **Safe:** only `subscriptions.retrieve` / `subscriptions.list` + Firestore `update` — **no charges**.
- `package.json` scripts:
  - `backfill:member-access-ends-at`
  - `backfill:member-access-ends-at:force` → `node scripts/backfill-member-access-ends-at.js --force`

### Profile UX (cancelled, still in paid period)
- One line: **`until {date} ({N} days left)`** (same date format as admin).
- Optional short note: e.g. no further charges (policy copy).

---

## 2. DM read receipts (creator sees fan “Read” / “Unread”)

### Data model
- On each message doc in `conversations/{convId}/messages/{msgId}` add optional **`readAt`** (Firestore `Timestamp`).
- Meaning: **fan** has opened the thread and this receipt ran; only meaningful on **creator → fan** messages (`senderId != convId` where `convId` === fan’s uid).

### Client helper (Stormij)
- `lib/dms.ts`:
  - Extend message type with `readAt: Date | null`.
  - `messageFromDoc` — read `readAt` via `.toDate()` if present.
  - **`markCreatorMessagesReadByFan(db, conversationId, fanUid, messages)`** — `writeBatch` `update` each message where `senderId && senderId !== fanUid && !readAt`, set `{ readAt: serverTimestamp() }` (chunk ≤ 400 per batch).

### When to call (fan app)
- **Member Messages page** (`/dms`): after subscribing to messages, **debounce ~500ms** and on **`visibilitychange`** (when tab visible), call `markCreatorMessagesReadByFan(db, user.uid, user.uid, messages)`.
- **Chat session page** (if same thread as `conversationId === user.uid`): same pattern, gated on `activeSession?.conversationId === user.uid`.

### Creator / admin UI
- For bubbles where **`senderId !== selectedConversationId`** (message from creator):
  - If **`readAt`** → show **`· Read`** (optional `title` with full seen datetime).
  - Else → show **`· Unread`** (muted).

### Firestore security rules (required)
Replace broad “fan can update any message” with:

- **Admin:** full `update` on messages (unchanged).
- **Fan (`convId == request.auth.uid`):** `update` **only** if:
  - `resource.data.senderId != convId` (not their own outbound message),
  - `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['readAt'])`,
  - `request.resource.data.readAt is timestamp`.

Example (adapt names to your rules file):

```text
function isDmFanReadReceiptOnly(convId) {
  return convId == request.auth.uid
    && resource.data.senderId != convId
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['readAt'])
    && request.resource.data.readAt is timestamp;
}

match /conversations/{convId}/messages/{msgId} {
  allow update: if request.auth != null && (
    isAdmin() ||
    isDmFanReadReceiptOnly(convId)
  );
}
```

Deploy rules after editing: `firebase deploy --only firestore:rules`.

### Semantics
- “Read” ≈ **fan had the thread open** (tab visible) after messages arrived — not pixel-perfect scroll read receipts.

---

## 3. Mobile DM composer (textarea + autosize + scroll)

### Problem
- Single-line `<input type="text">` on mobile: long text doesn’t scroll; user can’t see what they’re typing.

### Solution
1. Hook **`useAutosizeTextarea(value, maxHeightPx = 140)`** (`useLayoutEffect`: set `height` to `min(scrollHeight, maxHeightPx)`).
2. Replace composer **input** with **`<textarea>`**:
   - `ref={useAutosizeTextarea(text)}`
   - `rows={1}`, `className` shared with previous field (e.g. `chat-input-field`)
   - **Enter** → send (`preventDefault`); **Shift+Enter** → new line
   - `enterKeyHint="send"` (mobile keyboards)
   - `aria-label="Message"`

### CSS (global chat styles)
- `.chat-input-bar`: `align-items: flex-end` (icons align to bottom when multi-line).
- `textarea.chat-input-field`:
  - `resize: none`, `min-height: ~2.5rem`, `max-height: 140px`, `overflow-y: auto`, `-webkit-overflow-scrolling: touch`, `word-break: break-word`, `line-height: 1.4`, `box-sizing: border-box`
- **≤768px:** `font-size: max(16px, 0.95rem)` on `textarea.chat-input-field` (and `input.chat-input-field` if any) to reduce iOS zoom-on-focus.

### Apply in Stormij
- `app/(member)/dms/page.tsx`
- `app/admin/(authenticated)/dms/page.tsx`
- `app/(member)/chat-session/page.tsx` (composer in form; keep `flex: 1; minWidth: 0`)

---

## 4. Quick checklist for EchoFlux

| Area | Action |
|------|--------|
| Access end | Add `pickLatestMemberAccessEnd` + wire admin users, profile, auth gate for cancelled |
| Admin copy | `until MMM d, yyyy (N days left)` / `Expired` |
| Backfill | Port script + `--force` + npm scripts if you use same ops flow |
| DM `readAt` | Type + `messageFromDoc` + `markCreatorMessagesReadByFan` + fan pages + admin labels |
| Rules | Fan update-only-`readAt` on creator messages; deploy rules |
| Composer | `useAutosizeTextarea` + textarea + CSS + Enter/Shift+Enter |

---

## 5. Stormij repo references (commits on `main`)

Recent related work includes (not exhaustive): `lib/member-access-end.ts`, `lib/auth-redirect.ts`, admin users + profile, `scripts/backfill-member-access-ends-at.js`, `firestore.rules` DM `readAt` rule, `lib/dms.ts` read receipts, `lib/use-autosize-textarea.ts`, `chat.css`, DM/chat-session pages.

*Generated for handoff to EchoFlux Fan Hub — align collection paths and admin detection with your app if they differ.*
