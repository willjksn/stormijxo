# Feed visibility & admin overrides — spec for Echoflux

Use this spec to replicate Stormij_xo’s feed visibility (global + per-post) and admin-only overrides in Echoflux.

---

## 1. Data model

### 1.1 Site config (global flags)

Store in your site/config document (e.g. `site_config/content` or equivalent). Add three optional booleans:

| Field | Type | Meaning |
|-------|------|--------|
| `hideLikeCountsGlobally` | boolean | Fans can like but **don’t see the like count**. Admin still sees count. |
| `hideCommentsGlobally` | boolean | Comments are hidden for **fans** on all posts. Admin still sees comments. |
| `hideLikesGlobally` | boolean | Like button/row is hidden for **fans** on all posts. Admin still sees likes. |

- **Read:** anyone (or at least authenticated members) so the feed can apply the flags.
- **Write:** admin only (e.g. `isAdmin()` in security rules).

### 1.2 Post document (per-post flags)

Each post document should support (if not already):

| Field | Type | Meaning |
|-------|------|--------|
| `hideLikes` | boolean | Hide like button/row for this post (for fans). |
| `hideComments` | boolean | Hide comments for this post (for fans). |

Admin should always override these (see viewer logic below).

### 1.3 Posts: likes data

Ensure each post has:

- `likeCount` (number) — can be derived from `likedBy.length` on write.
- `likedBy` (array of user IDs) — source of truth for “who liked”; keep in sync with `likeCount`.

For display, use **display count = max(likeCount, likedBy.length)** so stale `likeCount` still matches the “who liked” list.

### 1.4 Users collection (for “who liked” modal)

Admin needs to read `users/{uid}` for each uid in `likedBy` to show profile. Each user doc should expose at least:

- `displayName` (string, optional)
- `photoURL` (string, optional) — set on Google sign-in (create + merge on login) so liker avatars show.
- `email` (string, optional) — fallback for display name and for showing in modal.

Security: only allow read for own doc + admin read all (e.g. for DMs and “who liked”).

---

## 2. Viewer logic (feed card)

Assume:

- `showAdminEdit` (or `isAdmin`) = current user is an admin.
- `post` = post document with `hideLikes`, `hideComments`, `likeCount`, `likedBy`, `comments`.
- Global flags from site config: `hideLikeCountsGlobally`, `hideCommentsGlobally`, `hideLikesGlobally`.

Compute:

```text
effectiveHideLikes    = post.hideLikes || hideLikesGlobally
effectiveHideComments = post.hideComments || hideCommentsGlobally

showLikeCount         = !effectiveHideLikes && !hideLikeCountsGlobally   // fans see count only when both are false
showLikeRow           = !effectiveHideLikes || showAdminEdit             // admin always sees like row
showLikeCountToViewer = showLikeCount || showAdminEdit                    // admin always sees count
showCommentsToViewer  = !effectiveHideComments || showAdminEdit          // admin always sees comments

displayLikeCount      = max(post.likeCount ?? 0, (post.likedBy ?? []).length)
```

- **Like row (heart + count):** render only when `showLikeRow`.
- **Like count number:** render only when `showLikeCountToViewer && displayLikeCount > 0` (never show 0).
- **Comments button + “View all X comments” + comments list:** render only when `showCommentsToViewer`.
- **Comment count (number next to comment icon):** render only when `showCommentsToViewer && commentsForViewer.length > 0` (never show 0).

So: **fans** respect both global and per-post; **admins** always see likes, like count, and comments (and who liked/commented).

---

## 3. Feed header (admin toggles)

In the same area as “Switch to grid view” (or equivalent), **for admin only** show three checkboxes (or toggles) that update the site config document:

- **Hide like counts** — sets `hideLikeCountsGlobally`.
- **Hide comments** — sets `hideCommentsGlobally`.
- **Hide likes** — sets `hideLikesGlobally`.

On toggle: merge-update the site config doc (e.g. `updateDoc(doc(db, "site_config", "content"), { hideLikeCountsGlobally: true })`) and update local state so the feed reflects the change without a full reload.

---

## 4. Admin “who liked” modal

- **Trigger:** When admin and `displayLikeCount > 0`, the like count is **clickable** (e.g. `<span role="button">` or button styled like the normal count — no underline, same look as fans).
- **On click:** Open a modal titled e.g. “Who liked this”.
- **Content:** For each uid in `post.likedBy`, fetch `users/{uid}` and show:
  - Avatar: `photoURL` if present, else initial from display name or email.
  - Name: `displayName` or email local part or “Member”.
  - Optionally email (e.g. small text) when different from name.
- **Flashing fix:** Render the modal in a **portal** (e.g. `createPortal(modal, document.body)`). On the backdrop, use **mousedown** (not click) to close, and **ignore backdrop close for ~400–450 ms** after open (ref with timestamp) so the same gesture that opened the modal doesn’t immediately close it.
- **Close:** Backdrop mousedown (after grace period), close button, Escape key.
- **Escape:** Add a keydown listener when modal is open; on Escape, set modal closed.

---

## 5. Single post page (comments)

Apply the same visibility rules:

- **Fans:** Show comments section only when `!post.hideComments && !hideCommentsGlobally`.
- **Admins:** Always show comments section, e.g.  
  `showComments = (!post.hideComments && !hideCommentsGlobally) || isAdmin(user)`.

Use the same `hideCommentsGlobally` from site config as on the feed.

---

## 6. Don’t show zero

- **Like count:** Only render the number when `displayLikeCount > 0` (both for fans and admin).
- **Comment count:** Only render the number when `commentsForViewer.length > 0`. The comment icon/button can still show so admins can open the comments modal even when count would be 0.

---

## 7. Optional: Google photoURL for liker avatars

On **Google sign-in** (and optionally on each Google login):

- **New user:** When creating `users/{uid}`, set `photoURL: firebaseUser.photoURL ?? null` (and displayName, email, etc.).
- **Existing user:** Merge `photoURL` (and optionally `displayName`) into `users/{uid}` so profile pics stay up to date for the “who liked” modal.

---

## 8. Checklist for Echoflux

- [ ] Site config: add `hideLikeCountsGlobally`, `hideCommentsGlobally`, `hideLikesGlobally`; load on home/feed and single post page.
- [ ] Posts: support `hideLikes`, `hideComments`; ensure `likeCount` and `likedBy` exist and stay in sync.
- [ ] Feed card: compute `effectiveHideLikes`, `effectiveHideComments`, `showLikeRow`, `showLikeCountToViewer`, `showCommentsToViewer`, `displayLikeCount`.
- [ ] Feed card: show like row only when `showLikeRow`; like count only when `showLikeCountToViewer && displayLikeCount > 0`; comments UI only when `showCommentsToViewer`; comment count only when `> 0`.
- [ ] Feed header: admin-only toggles that update site config for the three global flags.
- [ ] Admin: like count is clickable; opens “who liked” modal; modal fetches `users/{uid}` for each `likedBy`; show avatar, name, optional email; portal + backdrop grace period + Escape to avoid flash and accidental close.
- [ ] Single post page: show comments when `(!post.hideComments && !hideCommentsGlobally) || isAdmin`.
- [ ] Optional: set/merge `photoURL` (and displayName) on Google sign-in in `users/{uid}`.

---

## 9. Summary

| Who    | Likes row      | Like count   | Comments      | Who liked / who commented |
|--------|----------------|--------------|---------------|---------------------------|
| Fan    | If not hidden (global + per-post) | If not hidden and not “hide counts”, and only if > 0 | If not hidden (global + per-post) | N/A (no modal) |
| Admin  | Always         | Always (when > 0); clickable → “who liked” modal | Always (button, list, full modal) | Can see all; modal shows who liked with avatar/name |

All “hide” settings apply only to fans; admins always see likes, counts, and comments and can open the likers modal.
