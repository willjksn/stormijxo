/**
 * Backfill: cancelled members get access_ends_at from Stripe (period end / ended_at / canceled_at).
 *
 * Run from project root (loads .env.local):
 *   node scripts/backfill-member-access-ends-at.js
 *   node scripts/backfill-member-access-ends-at.js --dry-run
 *   node scripts/backfill-member-access-ends-at.js --force          # overwrite existing access_ends_at
 *   node scripts/backfill-member-access-ends-at.js --force --dry-run
 *
 * Safety: This script only calls Stripe retrieve/list (read-only) and updates Firestore.
 * It does NOT create charges, payment intents, or reactivate subscriptions.
 *
 * Requires: Stripe secret + Firebase Admin (same as backfill-subscription-payments).
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

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

const stripeSecret =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET ||
  process.env.Stripe_Secret_key;

if (!stripeSecret) {
  console.error("Missing Stripe secret. Set STRIPE_SECRET_KEY in .env.local");
  process.exit(1);
}

const stripe = new Stripe(stripeSecret);

function hasAccessEndsAt(data) {
  const v = data.access_ends_at ?? data.accessEndsAt ?? null;
  if (v == null) return false;
  if (typeof v.toDate === "function") return true;
  if (typeof v.seconds === "number") return true;
  if (typeof v._seconds === "number") return true;
  return true;
}

function periodEndSeconds(sub) {
  const cpe = sub.current_period_end;
  const ended = sub.ended_at;
  const canceled = sub.canceled_at;
  if (typeof cpe === "number" && cpe > 0) return cpe;
  if (typeof ended === "number" && ended > 0) return ended;
  if (typeof canceled === "number" && canceled > 0) return canceled;
  return null;
}

async function main() {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const membersRef = db.collection("members");

  const snap = await membersRef.where("status", "in", ["cancelled", "canceled", "Canceled"]).get();
  const docs = snap.docs;

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let skipped_no_change = 0;

  for (const doc of docs) {
    const data = doc.data() || {};
    if (!force && hasAccessEndsAt(data)) {
      skipped += 1;
      continue;
    }

    const subId = (data.stripeSubscriptionId || data.stripe_subscription_id || "").toString().trim();
    const customerId = (data.stripeCustomerId || data.stripe_customer_id || "").toString().trim();

    let endSec = null;

    if (subId) {
      try {
        const sub = await stripe.subscriptions.retrieve(subId);
        endSec = periodEndSeconds(sub);
      } catch (e) {
        console.warn(`  ${doc.id}: retrieve sub ${subId} failed:`, e.message || e);
      }
    }

    if (endSec == null && customerId) {
      try {
        const list = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
        for (const sub of list.data) {
          const sec = periodEndSeconds(sub);
          if (sec != null) {
            endSec = sec;
            break;
          }
        }
      } catch (e) {
        console.warn(`  ${doc.id}: list subs for customer failed:`, e.message || e);
      }
    }

    if (endSec == null) {
      console.warn(`  ${doc.id}: no period end from Stripe (email=${data.email || "?"})`);
      failed += 1;
      continue;
    }

    const ts = admin.firestore.Timestamp.fromMillis(endSec * 1000);
    const newIso = ts.toDate().toISOString();

    if (force && hasAccessEndsAt(data)) {
      const prev = data.access_ends_at ?? data.accessEndsAt;
      let prevIso = "?";
      try {
        if (prev && typeof prev.toDate === "function") prevIso = prev.toDate().toISOString();
        else if (prev && typeof prev.seconds === "number") prevIso = new Date(prev.seconds * 1000).toISOString();
      } catch (_) {}
      if (prevIso === newIso) {
        skipped_no_change += 1;
        continue;
      }
    }

    if (dryRun) {
      console.log(`  [dry-run] ${doc.id} would set access_ends_at=${newIso}`);
    } else {
      await doc.ref.update({
        access_ends_at: ts,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    updated += 1;
  }

  const forceNote = force ? " force=true" : "";
  console.log(
    `\nDone.${forceNote} ${dryRun ? "(dry-run) " : ""}updated=${updated} skipped_had_date=${skipped} skipped_same_as_stripe=${skipped_no_change} could_not_resolve=${failed} total_cancelled_scanned=${docs.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
