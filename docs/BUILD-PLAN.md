# Stormij_xo — Implementation Plan

Concrete build plan: pages, Firestore collections, admin routes, and priorities. Use this alongside [SPEC.md](./SPEC.md) for implementation.

---

## 1. Firestore Collections

| Collection    | Purpose | Key Fields |
|---------------|---------|------------|
| `members`    | Subscribers (existing) | email, status, stripeCustomerId, stripeSubscriptionId, joinedAt, access_ends_at, tier |
| `users`     | **New** — Firebase Auth profiles | uid, email, displayName, username, createdAt, stripeCustomerId (optional) |
| `site_config` | Landing/config (existing) | testimonial, social links, legal dates, previews, hero/preview media URLs |
| `tips`      | One-time tips (existing) | amountCents, email, instagram_handle, createdAt, source |
| `products`  | **New** — store add-ons | name, priceCents, description, stripePriceId, active, createdAt |
| `orders`    | **New** — add-on purchases | memberId/email, productId, amountCents, stripeSessionId, createdAt |
| `posts`     | **New** — member feed posts | title, body, mediaUrls, createdAt, published |
| `media`     | **Optional** — media assets (if not in site_config) | url, slot, type, createdAt |

### Indexes
- `members`: `stripeSubscriptionId` (single-field)
- `members`: `stripeCustomerId` (single-field)
- `users`: `uid` (document ID)
- `orders`: `memberId` + `createdAt`, `productId` + `createdAt` (composite for analytics)
- `posts`: `published` + `createdAt` (for feed)

---

## 2. Public Pages & Routes

| Route/File          | Purpose | Auth Required |
|---------------------|---------|---------------|
| `/` `index.html`    | Landing page (existing) | No |
| `/success.html`     | Post-checkout success (existing) | No |
| `/terms.html`       | Terms of Service | No |
| `/privacy.html`     | Privacy Policy | No |
| `/signup.html`      | Member signup (email/password + Google) | No |
| `/login.html`       | Member login (email/password + Google) | No |
| `/member/index.html`| Member app shell (feed, grid, profile) | **Yes** |
| `/member/feed.html` | Feed view (default) | **Yes** |
| `/member/grid.html` | Grid gallery | **Yes** |
| `/member/post.html` | Single post view | **Yes** |
| `/member/store.html`| Members-only store | **Yes** |
| `/member/profile.html` | Profile + cancel subscription | **Yes** |

---

## 3. Admin Routes

| Route/File              | Purpose |
|-------------------------|---------|
| `/admin/login.html`     | Admin login (existing) |
| `/admin/index.html`     | **New** — redirect to dashboard |
| `/admin/dashboard.html` | **Redesigned** — Users section (keep members table) |
| `/admin/media.html`     | Media upload (existing, may restyle) |
| `/admin/content.html`   | Content (existing, may restyle) |
| `/admin/store.html`     | **New** — product management (CRUD) |
| `/admin/analytics.html` | **New** — sales, who buys what |
| `/admin/tips.html`      | **New** or merged — tips table (currently in dashboard) |
| `/admin/settings.html`  | **New** — Stripe URLs, site config |

### Admin Nav (redesigned)
- Users | Media | Content | Store | Analytics | Tips | Settings | Log out

---

## 4. Cloud Functions (existing + new)

| Function | Purpose |
|----------|---------|
| `createTipCheckoutPublic` | One-time tip checkout (existing) |
| `stripeWebhook` | Handles subscriptions, tips, add-on purchases (existing, extend for add-ons) |
| `createAddonCheckout` | **New** — create Stripe Checkout for add-on purchase (members only) |
| `createCustomerPortalSession` | **New** — return Stripe Customer Portal URL for cancel/subscription management |

---

## 5. Implementation Phases

### Phase 1 — Legal & Auth (Foundation)
- [ ] New Terms of Service page (`terms.html`)
- [ ] New Privacy Policy page (`privacy.html`)
- [ ] Member signup (`signup.html`) — email/password + Google, name, username
- [ ] Member login (`login.html`) — email/password + Google
- [ ] Firestore: `users` collection + rules
- [ ] Link Stripe checkout to create/update `users` (email match or custom claims)

### Phase 2 — Member Profile & Cancel
- [ ] Member profile page (`member/profile.html`)
- [ ] Stripe Customer Portal integration for cancel subscription
- [ ] Cloud Function: `createCustomerPortalSession`

### Phase 3 — Member App (Feed/Grid)
- [ ] Member app shell (`member/index.html`) with nav
- [ ] Firestore: `posts` collection
- [ ] Feed view (`member/feed.html`)
- [ ] Grid view (`member/grid.html`)
- [ ] Single post view (`member/post.html`)
- [ ] Access control: require auth + active member

### Phase 4 — Store & Add-ons
- [ ] Firestore: `products`, `orders` collections
- [ ] Admin store management (`admin/store.html`) — CRUD products
- [ ] Cloud Function: `createAddonCheckout`
- [ ] Extend `stripeWebhook` for add-on purchases → write to `orders`
- [ ] Member store page (`member/store.html`) — visible only to members

### Phase 5 — Admin Redesign & Analytics
- [ ] Redesign admin layout/nav
- [ ] Analytics page (`admin/analytics.html`) — sales, who buys what, revenue
- [ ] Tips page (dedicated or merged into Analytics)
- [ ] Settings page (`admin/settings.html`)

### Phase 6 — Polish
- [ ] Comments/likes on posts (optional)
- [ ] SEO, performance, error handling

---

## 6. Firestore Security Rules (additions)

```javascript
// users: read/write own doc for auth'd users
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
  allow create: if true;  // signup
}

// products: public read for members; admin write
match /products/{productId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null;  // admin-only via custom claims or allowlist
}

// orders: member can read own; admin read all
match /orders/{orderId} {
  allow read: if request.auth != null;
  allow create: if false;  // only via Cloud Function
  allow update, delete: if false;
}

// posts: read for auth'd members; admin write
match /posts/{postId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null;  // admin-only
}
```

---

## 7. Key Integration Points

| Integration | Details |
|-------------|---------|
| Stripe subscription checkout | Existing Payment Link; webhook creates `members` |
| Stripe add-on checkout | New Cloud Function creates session; webhook writes `orders` |
| Stripe Customer Portal | New Cloud Function returns portal URL |
| Firebase Auth | Admin: existing; Member: new signup/login pages |
| Member ↔ Stripe | Link `users.uid` or email to `members` via `stripeCustomerId` / email |

---

## 8. Suggested File Layout

```
/
├── index.html
├── success.html
├── terms.html
├── privacy.html
├── signup.html
├── login.html
├── member/
│   ├── index.html      (app shell / feed)
│   ├── feed.html
│   ├── grid.html
│   ├── post.html
│   ├── store.html
│   └── profile.html
├── admin/
│   ├── login.html
│   ├── index.html
│   ├── dashboard.html  (Users)
│   ├── media.html
│   ├── content.html
│   ├── store.html
│   ├── analytics.html
│   ├── tips.html
│   └── settings.html
├── docs/
│   ├── SPEC.md
│   └── BUILD-PLAN.md
├── functions/
│   └── index.js
├── styles.css
├── firebase-config.js
├── auth-header.js
└── firestore.rules
```

---

## 9. Priorities Summary

1. **Legal** — Terms + Privacy (required for compliance)
2. **Auth** — Member signup/login (unblocks everything else)
3. **Profile + Cancel** — Core member experience
4. **Member app** — Feed, grid, posts (core value)
5. **Store** — Add-ons + admin CRUD
6. **Analytics** — Who buys what, sales
7. **Admin redesign** — UX polish
