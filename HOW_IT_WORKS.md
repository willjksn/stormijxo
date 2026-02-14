# How My Innercircle Works

## The big picture

You have an **Instagram Close Friends** list. Only people on that list see your Close Friends posts (images/videos). Fans pay **$12/month** through this app to get access. When they pay, they’re added to your **fan database** in the admin panel. When they cancel, you see when their access ends so you know when to remove them from Close Friends on Instagram.

---

## Step-by-step process

### 1. Fan pays $12 on the app

- Fan goes to **stormijxo.com** and clicks **“Yes, add me — $12/mo”**.
- They’re sent to **Stripe Checkout** (your Payment Link).
- At checkout they enter:
  - **Email** (required by Stripe)
  - **Instagram handle** (you add this as a **custom field** on the Payment Link in Stripe so it’s collected at checkout)
- They complete payment. Stripe creates a **subscription** (recurring monthly).

### 2. Stripe tells the app (webhook)

- Stripe sends a **webhook** to your Firebase Cloud Function when:
  - **checkout.session.completed** — fan just paid → create a new fan in the database.
  - **customer.subscription.updated** — fan cancelled (access until period end) → update fan with cancel date and “access until” date.
  - **customer.subscription.deleted** — subscription ended → update fan so you know to remove them from Close Friends.
- The function reads:
  - Email, Instagram handle (from checkout custom field), Stripe customer ID, **subscription ID**.
  - On cancel events: **cancel date** and **current_period_end** (when access ends).

### 3. Fan database in Firestore

- Each fan is one document in the **members** collection with:
  - **Email**
  - **Instagram handle** (from Stripe checkout custom field)
  - **Signup date** (when they first paid)
  - **Status:** `active` or `cancelled`
  - **Cancel date** (when they cancelled, if they did)
  - **Access until** (end of the billing period after cancel — fan keeps access until this date)
  - Stripe customer ID and subscription ID (for matching webhook events)

### 4. Admin panel (you)

- You log in at **stormijxo.com/admin** and see the **Members** list.
- For each fan you see:
  - **Instagram handle** — so you can find them on Instagram and add them to Close Friends.
  - **Email**
  - **Signup date**
  - **Cancel date** (if they cancelled)
  - **Countdown** — for cancelled fans: “Access until [date]” and a countdown (e.g. “5 days left”) so you know when to **manually remove them from Close Friends** on Instagram.
- You can still **add members manually** (e.g. if someone pays another way) and **mark cancelled** / **remove** as needed.

### 5. You add them to Close Friends on Instagram

- When a new fan appears in the admin list, you **add their Instagram handle to your Close Friends list** in the Instagram app.
- When the countdown for a cancelled fan reaches **0** (access until date has passed), you **remove them from Close Friends** in the Instagram app.

### 6. When a fan cancels

- They cancel in Stripe (customer portal or you cancel for them).
- Stripe sends **customer.subscription.updated** (or **deleted** when the period ends).
- The app updates the fan: status = cancelled, cancel date = now, **access until** = end of current billing period.
- They **keep access until that date** (Stripe’s normal behavior).
- The admin panel shows the **countdown** to that date so you know when to remove them from Close Friends.

---

## Summary

| Step | What happens |
|------|----------------|
| 1 | Fan pays $12 via app → Stripe Checkout (email + Instagram handle). |
| 2 | Stripe webhook → Cloud Function creates/updates fan in Firestore (email, IG handle, signup, cancel date, access until). |
| 3 | Admin panel shows fan list with IG handle, email, signup date, cancel date, and countdown for cancelled fans. |
| 4 | You add new fans to Close Friends on Instagram; when countdown hits 0 for a cancelled fan, you remove them. |

---

## What you need to set up in Stripe

1. **Payment Link** — already done; add a **custom field** so Stripe collects **Instagram handle** at checkout:
   - Stripe Dashboard → **Payment links** → your $12 link → **Edit**.
   - Under **Custom fields**, add a field: label **“Instagram handle”** (e.g. placeholder “@username”).
   - Save. New checkouts will collect it and the webhook will store it.

2. **Webhook** — already points to your Cloud Function; add these events (in addition to `checkout.session.completed`):
   - **customer.subscription.updated**
   - **customer.subscription.deleted**

After that, the process runs as above: pay → Stripe adds/updates the “collection” (fan database) with Instagram handle and email, and the admin panel shows signup date, cancel date, and countdown so you know when to remove people from Close Friends.
