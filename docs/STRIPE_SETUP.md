# Stripe setup guide — Stormij_xo

## 1. Subscription ($19/mo) — step-by-step

The app uses **one** Stripe Price for membership. You create that price in Stripe and set its ID in your environment. No code changes needed when you switch from $12 to $19.

### Step 1: Create or use a product in Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Product catalog** → **Products**.
2. Either:
   - **Use existing:** Click your current membership product (e.g. “Inner Circle” or “Monthly membership”).
   - **Create new:** Click **+ Add product**. Name it (e.g. “Inner Circle membership”), leave price for the next step.

### Step 2: Add the $19/month price

1. On the product page, under **Pricing**, click **+ Add another price** (or **Add price** if there are none).
2. Set:
   - **Pricing model:** Standard pricing
   - **Price:** `19.00` **USD**
   - **Billing period:** Monthly
3. Optional: add a **Price description** (e.g. “Inner Circle monthly access”).
4. Click **Save price** (or **Add price**).
5. Copy the **Price ID** — it starts with `price_` (e.g. `price_1ABC123xyz`). You’ll need it in Step 4.

### Step 3: (Optional) Archive the old $12 price

1. On the same product, find the **$12.00/month** price.
2. Open it (click the price or the ⋮ menu) → **Archive**.
3. Existing subscribers on $12 keep that price until you change or cancel their subscription. New subscribers will use the $19 price from Step 2.

### Step 4: Set the price ID in your app

1. **Vercel:** Project → **Settings** → **Environment Variables**.
   - Add (or edit):
     - **Name:** `STRIPE_PRICE_ID_MONTHLY`
     - **Value:** the Price ID from Step 2 (e.g. `price_1ABC123xyz`)
   - Save and **redeploy** so the new value is used.
2. **Local:** In `.env.local` add:
   ```bash
   STRIPE_PRICE_ID_MONTHLY=price_xxxxxxxxxxxxx
   ```
   (Use your real Price ID.)

### Step 5: Confirm webhook and other Stripe env vars

- **Webhook:** Stripe → **Developers** → **Webhooks**. Your endpoint (e.g. `https://stormijxo.com/api/stripe-webhook`) should receive **checkout.session.completed** (and **customer.subscription.updated** / **deleted** if you use them). No change needed for the new price — the webhook already creates `members` from any subscription checkout.
- **Secrets:** Ensure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set in Vercel and locally.

That’s it. New “Join the Inner Circle” signups will charge $19/month using the price you added. The landing page copy is already set to $19.

---

## 2. Does this change tips or treats?

**No.** The new subscription price does not affect tips or the treats store.

- **Subscription:** Uses a **fixed Stripe Price ID** (`STRIPE_PRICE_ID_MONTHLY`) because Stripe needs a recurring price for subscriptions. You maintain that one price (e.g. $19/mo) in the Product catalog.
- **Tips:** One-time payments. The app creates a Checkout Session with **dynamic** `price_data` (amount in cents from the button or custom input). There are **no** Stripe products or prices to create for tips — the code builds the session each time.
- **Treats:** One-time payments. Same idea as tips: the app reads each treat from **Firestore** (name, price, description) and creates a Checkout Session with **dynamic** `price_data` for that treat. You do **not** create a Stripe product for each treat.

So:

| Feature    | Stripe setup per item? | Where you define price / products      |
|-----------|-------------------------|----------------------------------------|
| Subscription | One Price ID in env   | Stripe Product catalog → one Price ($19/mo) |
| Tips      | No                      | App (buttons / custom amount)          |
| Treats    | No                      | Firestore `treats` collection + Admin  |

When you open the treats store, you **do not** create products in Stripe for each treat. You add treats in **Admin → Treats** (name, price in dollars, description, quantity). The treat-checkout API uses that data to create a one-time Stripe Checkout session with `price_data`; the webhook then records the purchase and decrements quantity. So it works like the tip feature: no Stripe product catalog entries needed for individual tips or treats.

---

## 3. Quick reference — env vars

| Variable | Used for | Example |
|----------|----------|---------|
| `STRIPE_SECRET_KEY` | All Stripe API calls | `sk_live_xxx` or `sk_test_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | `whsec_xxx` |
| `STRIPE_PRICE_ID_MONTHLY` | Subscription checkout | `price_xxx` (your $19/mo price) |
| `PUBLIC_APP_URL` | Success/cancel URLs (optional) | `https://stormijxo.com` |

Tips and treats do not need extra Stripe env vars beyond `STRIPE_SECRET_KEY` (and the webhook secret for recording payments).
