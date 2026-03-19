# Stripe & Messages – Spec for Echoflux Parity

Use this doc to keep Echoflux in sync with Stormij XO behavior for **Stripe webhooks**, **admin notifications**, and **DMs/messages** (including chat UI and security).

---

## 1. Notifications (in-app)

- **Collection:** `notifications`
- **Admin view:** Query where `forAdmin == true`. Shown in header NotificationBell; links and types below.
- **Member view:** Query where `forMemberEmail == member's email` (for member-facing notifications).

### Notification document shape

| Field            | Type    | Notes                                      |
|-----------------|---------|--------------------------------------------|
| `forAdmin`      | boolean | `true` = admin notification                |
| `forMemberEmail`| string \| null | `null` for admin-only notifications |
| `type`          | string  | See types below                            |
| `title`         | string  | Short title                                |
| `body`          | string  | Body text                                  |
| `link`          | string \| null | Relative path, e.g. `/admin/users`   |
| `read`          | boolean | Default `false`                            |
| `createdAt`     | timestamp | Server timestamp                          |

### Admin notification types

| type            | title        | body / link | when created |
|-----------------|-------------|-------------|--------------|
| `member_joined` | "New member" | `${email} joined.` | Stripe `checkout.session.completed`: after creating member doc from subscription |
|                 |             | `link: "/admin/users"` | |
| `comment`      | "New comment" | `${username}: ${textSnippet}` (max 80 chars + "…") | When a **non-admin** submits a comment on feed or single post |
|                 |             | `link: "/post/${postId}"` (feed) or `/post/${id}` (post page) | Skip if commenter is admin (`isAdminEmail(currentUser.email)`). |
| `dm`            | "New message" | See DM bodies below | When a **member** sends a DM (text, attachment, or voice). |

### DM notification bodies (for admin)

- **Text only:** `(displayName || email || "A member") + ": " + text.slice(0, 60) + (text.length > 60 ? "…" : "")`
- **Voice:** `"New voice message from member."`
- **Attachment only (no text):** `"New attachment from member."`
- **Attachment with caption:** Same as text only, using the caption as `text`.

All DM admin notifications: `type: "dm"`, `link: "/admin/dms"`.

---

## 2. Stripe webhook – new member notification

- **Event:** `checkout.session.completed`
- **When:** After successfully creating a **new** member document (e.g. in `members` collection) from the subscription session (e.g. reading `session.customer_email` as `email`).
- **Action:** Add one document to `notifications`:

```js
{
  forAdmin: true,
  forMemberEmail: null,
  type: "member_joined",
  title: "New member",
  body: `${email} joined.`,
  link: "/admin/users",
  read: false,
  createdAt: serverTimestamp(),
}
```

- **Important:** Only create this notification when a **new** member is added (e.g. `membersRef.add(...)`), not when updating an existing member.

---

## 3. Comments – admin notification

- **When:** A user submits a comment on:
  - **Feed:** comments modal on a post (`app/(member)/home`).
  - **Post page:** comment form on single post (`app/(member)/post/[id]`).
- **Condition:** Do **not** create the notification if the commenter is an admin (`isAdminEmail(commenterEmail)`).
- **Payload:**

```js
{
  forAdmin: true,
  forMemberEmail: null,
  type: "comment",
  title: "New comment",
  body: `${username}: ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}`,
  link: `/post/${post.id}`,  // or post page: `/post/${id}`
  read: false,
  createdAt: serverTimestamp(),
}
```

---

## 4. DMs – admin notification (member sends message)

- **When:** A **member** sends a direct message (text, attachment, or voice) from the member Messages/DMs page.
- **Payload:** Same document shape as above; `type: "dm"`, `title: "New message"`, `link: "/admin/dms"`. `body` as in “DM notification bodies” table above.

---

## 5. DMs – chat UI (fan vs creator)

- **Creator display name (important):** Never show the admin’s personal name to fans. Use a single **creator public name** everywhere: **`stormij_xo`**. Define a constant (e.g. `CREATOR_DISPLAY_NAME = "stormij_xo"`) and use it for the creator’s label in both admin and member chat views.
- **Member DMs page (fan view):**
  - **Fan messages:** One side (e.g. right), label **"Fan"**.
  - **Creator messages:** Other side (e.g. left), label **`stormij_xo`** (the creator constant), distinct style (e.g. grey background).
- **Admin DMs page (creator view):**
  - **Creator messages:** Right side, label **`stormij_xo`** (same constant, not “You” and not the admin’s real name), **creator/accent color** (e.g. `var(--accent)` with fallback `#6366f1`).
  - **Fan messages:** Left side, label = **fan’s name** (`memberDisplayName` or `memberEmail` or `"Fan"`), grey/secondary style.
- **Identification:** On admin, treat “creator” as sender **not** equal to the conversation’s member id (`selectedId`). So: `isCreator = (selectedId != null && message.senderId !== selectedId)`. Do not rely only on `user.uid`.
- **Row layout:** Each message in a row; row class `row-them` (left) or `row-me` (right). Bubble classes `chat-bubble them` (left, grey) and `chat-bubble me` (right, accent). Role label: `chat-bubble-role` with text = creator constant for creator messages, fan name or "Fan" for fan messages.

---

## 6. DMs – delete permission

- **Fan (member):** Cannot delete messages. No delete UI on member DMs page; Firestore rules deny delete for non-admin.
- **Creator (admin):** Can delete messages. Delete button only on admin DMs page; Firestore allows delete only for admin.

### Firestore rules (conversations/messages)

- **Read, create:** Authenticated user can read/create if they are the conversation member (`convId == request.auth.uid`) or an admin (`isAdmin()`).
- **Update:** Same as read/create (in case you add edit later).
- **Delete:** **Only** `isAdmin()`.

```text
match /conversations/{convId}/messages/{msgId} {
  allow read, create: if request.auth != null && (
    convId == request.auth.uid ||
    isAdmin()
  );
  allow update: if request.auth != null && (
    convId == request.auth.uid ||
    isAdmin()
  );
  allow delete: if isAdmin();
}
```

---

## 7. Quick reference – admin notification triggers

| Trigger              | type           | title        | link           |
|----------------------|----------------|-------------|----------------|
| New member (Stripe)   | `member_joined`| New member  | `/admin/users` |
| New comment (feed/post)| `comment`     | New comment | `/post/{id}`   |
| New DM from member    | `dm`           | New message | `/admin/dms`   |

All use `forAdmin: true`, `forMemberEmail: null`, `read: false`, `createdAt: serverTimestamp()`, and the `body`/`title`/`link` as specified above.
