# Echoflux – Updates & What to Tell the Agent

Use this doc to sync Echoflux with the latest Stormij XO behavior and to brief the Echoflux agent.

---

## 1. Updates (since last spec)

These changes should be applied in Echoflux so it matches Stormij XO.

### Creator name in chat (no admin identity to fans)

- **Rule:** The creator’s label in DMs must **never** be the admin’s personal name (e.g. “Will”). It must always be the **public creator name**: **`stormij_xo`**.
- **Implementation:**
  - Add a single constant, e.g. `CREATOR_DISPLAY_NAME = "stormij_xo"`.
  - **Admin DMs (creator view):** For messages sent by the creator, show the label **`stormij_xo`** (from the constant). For messages from the fan, show the **fan’s name** (`memberDisplayName` or `memberEmail` or fallback `"Fan"`).
  - **Member DMs (fan view):** For messages from the creator, show **`stormij_xo`**. For the fan’s own messages, show **"Fan"**.
- **Why:** Protects admin privacy; fans only ever see the brand name “stormij_xo”, not the person behind the account.

### Chat layout and identification (recap)

- **Admin side:** Treat “creator” as any message where `message.senderId !== selectedId` (conversation id = member uid). Use that for layout (right side, accent color) and for the label `stormij_xo`. Do **not** use the logged-in user’s displayName/email for the creator label.
- **Fan side:** Creator messages = other side, grey, label `stormij_xo`. Fan messages = “Fan”.

### Reference spec

- Full behavior (Stripe, notifications, DMs, delete rules, chat UI) is in **`docs/echoflux-stripe-and-messages.md`**. Section 5 there is updated with the creator-name rules above.

---

## 2. What to tell the Echoflux agent

Copy-paste or adapt the following when talking to the Echoflux agent.

---

**Prompt for the Echoflux agent:**

```
Sync our DMs/chat with Stormij XO behavior. Key points:

1) Creator display name
- Never show the admin’s real name (e.g. “Will”) to fans in chat.
- Use a single constant for the creator’s public name: CREATOR_DISPLAY_NAME = "stormij_xo".
- In chat UI, the creator’s messages are always labeled "stormij_xo" (both in admin view and in fan view). The fan’s messages are labeled with the fan’s name (admin view) or "Fan" (fan view).

2) Admin DMs page
- Creator messages: right side, accent color, label = CREATOR_DISPLAY_NAME ("stormij_xo").
- Fan messages: left side, grey, label = fan’s name (memberDisplayName or memberEmail or "Fan").
- Decide “creator” by: message.senderId !== conversationMemberId (selectedId). Don’t use the logged-in user’s displayName for the creator label.

3) Member DMs page (fan view)
- Creator messages: label = CREATOR_DISPLAY_NAME ("stormij_xo"), other side, grey.
- Fan’s own messages: label = "Fan".

4) Full spec
- Follow the full spec in docs/echoflux-stripe-and-messages.md for: Stripe webhook admin notification on new member, comment and DM admin notifications, notification document shape, and Firestore rules (only admin can delete DM messages). Chat UI details and creator-name rules are in Section 5 of that doc.
```

---

## 3. Quick checklist for Echoflux

- [ ] Constant `CREATOR_DISPLAY_NAME = "stormij_xo"` (or equivalent) exists and is used for all creator labels in chat.
- [ ] Admin DMs: creator messages show “stormij_xo”, fan messages show fan’s name (or “Fan”).
- [ ] Member DMs: creator messages show “stormij_xo”, fan messages show “Fan”.
- [ ] Creator vs fan is determined by `senderId !== selectedId` on admin side (not by current user’s name).
- [ ] Stripe, notifications, and delete rules match `docs/echoflux-stripe-and-messages.md`.
- [ ] No place in chat exposes the admin’s personal name to fans.
