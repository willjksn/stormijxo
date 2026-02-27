# My Inner circle — Private IG Close Friends

## Runtime source of truth

- The canonical frontend is the Next.js App Router in `app/`.
- Run locally with `npm run dev` and deploy with your Next.js workflow.
- Legacy static HTML files (`index.html`, `admin/*.html`, `member/*.html`) are kept only for archival/fallback reference and should not be treated as the active app.

A landing page that sells monthly membership to your Instagram Close Friends via Stripe, with an **admin area** (Firebase Auth) to see who joined and who cancelled so you can manage your Close Friends list.

## How it works

1. **Landing page** (`index.html`) — hero, perks, preview, pricing, FAQ, CTA.
2. **Join** — visitor clicks “Join” and goes to your **Stripe Payment Link** (subscription).
3. **Success** — Stripe redirects to `success.html`. They can optionally submit their email (saved to Firebase); they also follow you and DM.
4. **Admin** — you log in at `admin/login.html`, see all members in the dashboard, add members when they DM, mark as cancelled when they unsubscribe, and remove them from the list (then remove from Instagram Close Friends).

## Setup

### 1. Stripe (no code)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Product catalog** → **Add product**.
2. Create a product, e.g. “Close Friends — $12/month”.
3. Add a **recurring price** (monthly).
4. Click **Create payment link** (or use **Payment links** in the sidebar).
5. Set:
   - **After payment** → “Redirect to a webpage” → your success URL, e.g. `https://yoursite.com/success.html`
   - Optionally add a **Customer portal** link so they can cancel (Stripe can email this).
6. Copy the Payment Link URL and paste it into `index.html` where it says `YOUR_STRIPE_PAYMENT_LINK_HERE`.
7. Repeat for VIP if you use the second tier (`YOUR_STRIPE_VIP_PAYMENT_LINK_HERE`).

### 2. Firebase (admin + members list + optional success-page signup)

1. Go to [Firebase Console](https://console.firebase.google.com) and create a project (or use existing).
2. **Authentication:** Enable **Email/Password** sign-in. Create one user (your admin email + password).
3. **Firestore:** Create a database (start in test mode if you want, then deploy rules). Collection `members` will store: `email`, `note`, `status` (active/cancelled), `joinedAt`, `cancelledAt`.
4. **Storage:** Enable Storage if you want to store content; use the same project.
5. **Project settings → Your apps:** Add a web app, copy the config object.
6. In the project root, edit **`firebase-config.js`** and replace the placeholder values with your config.
7. **Firestore rules:** Deploy rules so only logged-in admin can read/update/delete members; anyone can create (success-page form). From project root:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use YOUR_PROJECT_ID
   firebase deploy --only firestore
   ```
8. **Storage rules:** `firebase deploy --only storage` (optional).

**Admin:** Open `admin/login.html` (e.g. `https://yoursite.com/admin/login.html`), log in with the email/password you created. From the dashboard you can add members, mark as cancelled, or remove. Use this list to know who to add to or remove from Instagram Close Friends.

### 3. Your content

- **Photo:** Replace the `hero-image` `src` in `index.html` with your image URL (or put an image in a folder and use `./images/hero.jpg`).
- **Name / tagline:** Edit `.hero-name`, `.hero-tagline`, `.hero-promise` in `index.html`.
- **Instagram:** In `success.html`, replace `YOUR_HANDLE` and `https://instagram.com/YOUR_HANDLE` with your real handle.
- **Preview thumbnails:** Replace the `.preview-blur` placeholders with real (blurred or cropped) screenshot images if you like.

### 4. Optional tweaks

- **One tier only:** Remove the second `.tier-card` (VIP) in `index.html` and keep a single “Join Close Friends” button.
- **Prices:** Change the amounts in the tier cards and in the button text to match your Stripe products.
- **Testimonials:** Add a short “What members say” section with 2–3 quotes above or below the FAQ.
- **Video:** Add an `<iframe>` or `<video>` in a new section for a 10–20 second intro.

## Run locally (Next.js app)

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Deploy

- Deploy as a Next.js app (Vercel or equivalent Node runtime).
- Use route-based URLs like `/success`, `/terms`, `/privacy` instead of `.html` paths.

## File overview

| File / folder   | Purpose |
|-----------------|--------|
| `index.html`   | Main landing + pricing + FAQ |
| `success.html` | Post-purchase steps + optional email submit (saved to Firestore) |
| `styles.css`   | All styles |
| `script.js`    | Smooth scroll |
| `firebase-config.js` | Your Firebase config (edit with your project values) |
| `firestore.rules`    | Firestore security rules |
| `storage.rules`      | Storage security rules |
| `admin/login.html`   | Admin login (email/password) |
| `admin/dashboard.html` | Admin dashboard: list members, add, mark cancelled, remove |

You stay in control: use the admin list to see who to add to or remove from Instagram Close Friends.
