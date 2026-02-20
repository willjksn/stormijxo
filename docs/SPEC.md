# Stormij_xo The Inner Circle — Product Specification

## Overview

**Stormij_xo The Inner Circle** is a subscription fan site for the creator Stormi J. Members pay a monthly subscription via Stripe, gain access to a private member app (feed, grid, posts), and can optionally purchase add-ons from a members-only store. Admins manage users, content, media, store, and view analytics.

---

## 1. User Accounts & Authentication

### Sign Up
- **Email + Password** with fields: email, password, name, username
- **Google Sign-In** as alternative
- Profile stored in Firestore after signup; linked to Stripe customer when they subscribe

### Sign In
- Email/password or **Google Sign-In**
- Persistent sessions; redirect unauthenticated members away from member-only routes

### Profile
- View/edit: name, username
- **Cancel subscription** — clear, visible button: "Cancel subscription"
  - Click → confirmation dialog → redirect to Stripe Customer Portal for cancellation
  - No dark patterns; one-click path to cancel

---

## 2. Add-ons & Store

### Availability
- **Add-ons** are available **only after** a user has an active paid membership
- **Store** is visible **only to members**; non-members see a prompt to subscribe
- No "girlfriend pack" or similar product in the store

### Store Management (Admin)
- Admin can **create, edit, delete** products/add-ons
- Editable fields per product:
  - Name
  - Price
  - Description
- Store products stored in Firestore; checkout via Stripe (one-time or payment link)

### Purchase Flow
- Member browses store → selects add-on → Stripe Checkout (one-time payment)
- Webhook records purchase; optional `purchases` or `orders` collection for analytics

---

## 3. Member App

### Core Features
- **Feed** — chronological posts (images, captions, etc.)
- **Grid** — gallery view of media
- **Posts** — individual post view
- **Comments** and **likes** on posts (optional; can be deferred)

### Access Control
- Member must be:
  1. Authenticated (Firebase Auth)
  2. Active subscriber (member record in Firestore with `status: "active"` and valid `access_ends_at` if applicable)
- Non-members see landing page; expired members see renewal prompt

---

## 4. Admin Dashboard (Full Redesign)

### Sections
| Section        | Purpose |
|----------------|---------|
| **Users**      | List members, search, status, Stripe link |
| **Media**      | Upload/manage hero, previews, content assets |
| **Content**    | Testimonial, social links, legal dates, preview toggles |
| **Store**      | Manage products/add-ons (name, price, description) |
| **Analytics**  | Who buys what, sales, revenue, top products |
| **Tips**       | Recent tips, amounts, emails |
| **Settings**   | Site-wide config, Stripe/Payment Link URLs |

### Design
- Consistent layout, navigation, and styling
- Mobile-friendly
- Clear hierarchy and labeling

---

## 5. Analytics

### Metrics
- **Sales** — subscriptions, add-on purchases, tips
- **Who buys what** — member email, product, amount, date
- **Revenue** — total and by product type
- **Top products** — best-selling add-ons

### Data Sources
- Firestore: `members`, `tips`, `purchases` (or `orders`)
- Stripe: webhook events for purchases; optional Stripe Dashboard sync

---

## 6. Legal Pages

### Terms of Service
- New, full Terms of Service page
- Covers: subscription terms, cancellation, content usage, liability, etc.

### Privacy Policy
- New, full Privacy Policy page
- Covers: data collected, Firebase, Stripe, cookies, user rights, etc.

---

## 7. Technical Stack (Current)

| Layer    | Technology |
|----------|------------|
| Hosting  | Vercel (static) |
| Auth     | Firebase Auth |
| Database | Firestore |
| Payments | Stripe (subscriptions, tips, one-time) |
| Functions| Firebase Cloud Functions |
| Storage  | Firebase Storage (media) |

---

## 8. Out of Scope (Explicitly Excluded)

- "Girlfriend pack" product
- Public store (store is members-only)
- Add-ons before membership (must subscribe first)

---

## 9. Glossary

| Term   | Meaning |
|--------|---------|
| Member | User with active paid subscription |
| Add-on | One-time purchasable product (members only) |
| Store  | Collection of add-ons, visible only to members |
| Tip    | One-time donation (no member record created) |
| Admin  | Creator/owner with full dashboard access |
