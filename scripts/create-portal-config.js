/**
 * One-time setup: create a Stripe Customer Portal configuration that enforces
 * "cancel at end of billing period" and no prorations/refunds.
 *
 * Run from project root (loads .env.local):
 *   node scripts/create-portal-config.js
 *
 * Add the printed configuration ID to .env / Vercel as STRIPE_PORTAL_CONFIGURATION_ID.
 * Then "Manage subscription" will use this config so members cancel at period end with no refund.
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
          const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = value;
        }
      }
    });
  } catch {
    // ignore
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const Stripe = require("stripe");
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
  const config = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: "Manage your subscription",
    },
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ["email"],
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        proration_behavior: "none",
        // Required by Stripe API (e.g. 2026-01-28+): `options` must be present even when
        // `enabled` is false — otherwise POST /v1/billing_portal/configurations returns 400.
        cancellation_reason: {
          enabled: false,
          options: [
            "customer_service",
            "low_quality",
            "missing_features",
            "other",
            "switched_service",
            "too_complex",
            "too_expensive",
            "unused",
          ],
        },
      },
      subscription_update: { enabled: false },
    },
  });

  console.log("\nStripe Customer Portal configuration created.");
  console.log("Add this to your .env / Vercel env:\n");
  console.log("STRIPE_PORTAL_CONFIGURATION_ID=" + config.id);
  console.log("\nMembers will then cancel at end of billing period with no refunds.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
