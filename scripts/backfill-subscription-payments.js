/**
 * One-time backfill: fetch paid subscription invoices from Stripe and write
 * any missing docs to Firestore subscriptionPayments so dashboard revenue matches Stripe.
 *
 * Use when: Stripe shows payments (e.g. Feb 25 $12) but dashboard doesn't, because
 * the webhook that ran at that time (e.g. Firebase Function) didn't write to subscriptionPayments.
 *
 * Run from project root (loads .env.local for Stripe + Firebase):
 *   node scripts/backfill-subscription-payments.js
 *
 * Requires: STRIPE_SECRET_KEY (or STRIPE_SECRET) and Firebase Admin env vars in .env.local
 */
const path = require("path");
const fs = require("fs");

const projectRoot = path.join(__dirname, "..");
function loadEnvFile(filename) {
  const filePath = path.join(projectRoot, filename);
  try {
    const content = fs.readFileSync(filePath, "utf8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
            val = val.slice(1, -1);
          process.env[key] = val;
        }
      }
    });
  } catch (_) {}
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const Stripe = require("stripe");
const { getFirebaseAdmin } = require("../api/_lib/firebase-admin");

const stripeSecret =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET ||
  process.env.Stripe_Secret_key;

if (!stripeSecret) {
  console.error("Missing Stripe secret. Set STRIPE_SECRET_KEY or STRIPE_SECRET in .env.local");
  process.exit(1);
}

const stripe = new Stripe(stripeSecret);

async function main() {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const subscriptionPaymentsRef = db.collection("subscriptionPayments");
  const membersRef = db.collection("members");

  let hasMore = true;
  let startingAfter = undefined;
  const created = [];
  const skipped = [];

  while (hasMore) {
    const list = await stripe.invoices.list({
      status: "paid",
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const invoice of list.data) {
      if (!invoice.subscription) continue;
      const amountPaid = typeof invoice.amount_paid === "number" ? invoice.amount_paid : 0;
      if (amountPaid <= 0) continue;

      const invoiceId = (invoice.id || "").toString();
      if (!invoiceId) continue;

      const docId = `invoice_${invoiceId}`;
      const existing = await subscriptionPaymentsRef.doc(docId).get();
      if (existing.exists) {
        skipped.push({ id: invoiceId, amount: amountPaid / 100, reason: "already in Firestore" });
        continue;
      }

      let email =
        (invoice.customer_email || "").toString().trim() ||
        null;
      if (!email && invoice.customer) {
        try {
          const cust = await stripe.customers.retrieve(invoice.customer);
          if (cust && !cust.deleted) email = (cust.email || "").toString().trim() || null;
        } catch (_) {}
      }
      if (!email && invoice.subscription) {
        const bySub = await membersRef
          .where("stripeSubscriptionId", "==", invoice.subscription)
          .limit(1)
          .get();
        if (!bySub.empty) email = (bySub.docs[0].data().email || "").toString().trim() || null;
      }

      const paidAt =
        typeof invoice.created === "number"
          ? admin.firestore.Timestamp.fromMillis(invoice.created * 1000)
          : admin.firestore.FieldValue.serverTimestamp();

      await subscriptionPaymentsRef.doc(docId).set({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        paidAt,
        amountCents: amountPaid,
        currency: invoice.currency || "usd",
        email: email || null,
        stripeCustomerId: invoice.customer || null,
        stripeSubscriptionId: invoice.subscription || null,
        stripeInvoiceId: invoiceId,
        source: "stripe_backfill",
        billingReason: invoice.billing_reason || null,
      });

      const dateStr = new Date(invoice.created * 1000).toISOString().slice(0, 10);
      created.push({ id: invoiceId, amount: amountPaid / 100, date: dateStr, email: email || "(no email)" });
    }

    hasMore = list.has_more;
    if (list.data.length) startingAfter = list.data[list.data.length - 1].id;
  }

  console.log("Backfill complete.");
  if (created.length) {
    console.log("\nCreated", created.length, "subscriptionPayment doc(s):");
    created.forEach((c) => console.log("  ", c.date, "$" + c.amount.toFixed(2), c.email));
  }
  if (skipped.length) {
    console.log("\nSkipped (already present):", skipped.length);
  }
  if (!created.length && !skipped.length) {
    console.log("No paid subscription invoices found in Stripe.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
