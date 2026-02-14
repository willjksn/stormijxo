# Stripe Webhook Setup — Do This In Order

When a fan pays via your Stripe Payment Link, Stripe calls a Firebase Cloud Function, which creates a **members** document in Firestore. The member then appears in your admin dashboard.

Do the steps below **in this order**. If something doesn’t work, use the “Check it’s working” section at the end.

---

## Step 1: Install dependencies and deploy the function

From your project root (e.g. `c:\Projects\Stormij_xo`):

```bash
firebase use stormij
cd functions
npm install
cd ..
firebase deploy --only functions
```

When it finishes, the terminal will show something like:

```
Function URL (stripeWebhook): https://us-central1-stormij.cloudfunctions.net/stripeWebhook
```

**Copy that full URL** — you need it for Stripe in Step 3.

---

## Step 2: Set Stripe keys in Firebase (not in a file)

Your **Stripe secret key** and **webhook signing secret** must be in Firebase’s config, not in `firebase-config.js`.

**2a. Get your Stripe secret key**

- [Stripe Dashboard → Developers → API keys](https://dashboard.stripe.com/apikeys)
- Copy the **Secret key** (starts with `sk_live_` or `sk_test_`)

**2b. You’ll get the webhook secret in Step 3** (after you create the webhook in Stripe).  
Then run **both** at once:

```bash
firebase functions:config:set stripe.secret="sk_live_YOUR_SECRET_KEY" stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"
```

Replace the placeholders with your real values. No quotes inside the value. Then redeploy:

```bash
firebase deploy --only functions
```

---

## Step 3: Create the webhook in Stripe

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks).
2. Click **Add endpoint**.
3. **Endpoint URL:** paste the URL from Step 1, e.g.  
   `https://us-central1-stormij.cloudfunctions.net/stripeWebhook`
4. **Description (optional):** e.g. `My Inner circle – add member to Firestore`.
5. **Events to send:** click **Select events** and choose **`checkout.session.completed`** only.
6. Click **Add endpoint**.
7. On the new endpoint’s page, under **Signing secret**, click **Reveal** and copy the value (starts with `whsec_`).
8. Set it in Firebase (if you didn’t in Step 2b):

   ```bash
  
   firebase deploy --only functions
   ```

---

## Step 4: Make sure your Payment Link uses the right success URL

- In Stripe: **Payment links** → your link → **Edit**.
- Under **After payment**, set the success URL to your site’s success page, e.g.  
  `https://yoursite.com/success.html`  
  (so the customer is sent to your success page after paying).

The webhook runs in the background; you don’t need to change the success page for the webhook to work.

---

## Check it’s working

**1. Confirm the function is reachable**

- Open the function URL in the browser:  
  `https://REGION-stormij.cloudfunctions.net/stripeWebhook`  
- You should get **Method Not Allowed** or **Missing Stripe-Signature** (that’s normal — Stripe will send POST with the right headers).

**2. Confirm config is set**

```bash
firebase functions:config:get
```

You should see something like:

```json firebase functions:config:set stripe.webhook_secret="whsec_PASTE_HERE"
{
  "stripe": {
    "secret": "sk_live_...",
    "webhook_secret": "whsec_..."
  }
}
```

If `stripe` or either key is missing, run the `firebase functions:config:set` command from Step 2 again, then redeploy.

**3. Test with a real payment (test mode)**

- Use **test** API key and **test** webhook (create a separate endpoint in Stripe for test mode, or switch your endpoint to test).
- Complete a test purchase with a test card (e.g. `4242 4242 4242 4242`).
- In Stripe: **Developers → Webhooks → your endpoint → Recent deliveries**. The last event should be **200**.
- In Firebase: **Firestore → `members`** — a new document with the customer email should appear.
- In your app: **Admin dashboard** — the new member should show in the list.

**4. If the webhook returns 400 “Invalid signature”**

- The **webhook signing secret** must be the one for **this** endpoint (test vs live) and must match what you set in Firebase.
- Make sure you didn’t set `stripe.secret` and `stripe.webhook_secret` with extra spaces or quotes inside the value.

**5. If the webhook returns 500 “Webhook not configured”**

- Run `firebase functions:config:get` and confirm both `stripe.secret` and `stripe.webhook_secret` are set.
- Redeploy: `firebase deploy --only functions`.

**6. If the webhook returns 500 “Failed to create member”**

- Check **Firebase Console → Firestore** — your **members** collection rules allow **create** (your rules do: `allow create: if true`).
- Check **Firebase Console → Functions → Logs** for the exact error.

---

## Quick reference

| What | Where |
|------|--------|
| Function URL | From `firebase deploy --only functions` (e.g. `https://us-central1-stormij.cloudfunctions.net/stripeWebhook`) |
| Stripe secret key | Stripe Dashboard → Developers → API keys |
| Webhook signing secret | Stripe Dashboard → Developers → Webhooks → your endpoint → Reveal signing secret |
| Set both in Firebase | `firebase functions:config:set stripe.secret="sk_..." stripe.webhook_secret="whsec_..."` then `firebase deploy --only functions` |
| Event to listen to | `checkout.session.completed` |

Do these in order and use “Check it’s working” if something doesn’t behave as expected.
