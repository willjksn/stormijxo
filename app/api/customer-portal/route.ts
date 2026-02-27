import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { cert, getApps, initializeApp, type App as AdminApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp(): AdminApp {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
        throw new Error("Service account JSON missing required fields.");
      }
      return initializeApp({
        credential: cert({
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, "\n"),
        }),
      });
    } catch {
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON/FIREBASE_SERVICE_ACCOUNT.");
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin credentials.");
  }
  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const stripeSecret =
      process.env.Stripe_Secret_key ||
      process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET;
    if (!stripeSecret) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { returnUrl?: string; email?: string; uid?: string };
    const returnUrl = body.returnUrl && body.returnUrl.trim() ? body.returnUrl.trim() : "https://stormijxo.com/profile";

    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(token);
    const uid = (decoded.uid || body.uid || "").trim();
    const rawEmailFromToken = (decoded.email || "").trim();
    const rawEmailFromBody = (body.email || "").trim();
    let rawEmail = rawEmailFromToken || rawEmailFromBody;
    let email = rawEmail.toLowerCase();

    const db = getFirestore(app);
    const membersRef = db.collection("members");
    let membersSnap = await membersRef.limit(0).get();

    // Some records are keyed by auth uid instead of email; try uid fields first.
    if (uid) {
      const uidFields = ["uid", "userId", "user_id", "firebaseUid", "firebase_uid"];
      for (const field of uidFields) {
        // eslint-disable-next-line no-await-in-loop
        const byUid = await membersRef.where(field, "==", uid).limit(1).get();
        if (!byUid.empty) {
          membersSnap = byUid;
          break;
        }
      }
      if (membersSnap.empty) {
        const byDocId = await membersRef.doc(uid).get();
        if (byDocId.exists) {
          membersSnap = {
            empty: false,
            docs: [byDocId],
          } as typeof membersSnap;
        }
      }
    }

    // If token/body had no email claim, attempt to recover it from users/{uid}.
    if (membersSnap.empty && !email && uid) {
      const userDoc = await db.collection("users").doc(uid).get();
      const userEmail = ((userDoc.data()?.email as string) || "").trim();
      if (userEmail) {
        rawEmail = userEmail;
        email = userEmail.toLowerCase();
      }
    }

    // Some ID tokens/providers may not include email claims; recover from Firebase Auth.
    if (membersSnap.empty && !email && uid) {
      try {
        const authUser = await getAuth(app).getUser(uid);
        const authEmail = (authUser.email || "").trim();
        if (authEmail) {
          rawEmail = authEmail;
          email = authEmail.toLowerCase();
        }
      } catch {
        // Keep graceful fallback error below.
      }
    }

    if (membersSnap.empty && rawEmail) {
      membersSnap = await membersRef.where("email", "==", rawEmail).limit(1).get();
    }
    if (membersSnap.empty && rawEmailFromToken) {
      membersSnap = await membersRef.where("email", "==", rawEmailFromToken).limit(1).get();
    }
    if (membersSnap.empty && rawEmailFromBody) {
      membersSnap = await membersRef.where("email", "==", rawEmailFromBody).limit(1).get();
    }
    if (membersSnap.empty && email && rawEmail !== email) {
      membersSnap = await membersRef.where("email", "==", email).limit(1).get();
    }

    if (membersSnap.empty && !email) {
      return NextResponse.json({ error: "No subscription found for this account." }, { status: 404 });
    }
    if (membersSnap.empty) {
      return NextResponse.json({ error: "No subscription found for this account." }, { status: 404 });
    }

    const memberDoc = membersSnap.docs[0]!;
    const member = memberDoc.data() as {
      stripeCustomerId?: string;
      stripe_customer_id?: string;
      stripeSubscriptionId?: string;
      stripe_subscription_id?: string;
    };
    const stripe = new Stripe(stripeSecret);
    let customerId = (member?.stripeCustomerId || member?.stripe_customer_id || "").trim();
    const subscriptionId = (member?.stripeSubscriptionId || member?.stripe_subscription_id || "").trim();
    if (!customerId && subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (typeof subscription.customer === "string" && subscription.customer.trim()) {
          customerId = subscription.customer.trim();
          await memberDoc.ref.set(
            {
              stripeCustomerId: customerId,
              stripe_customer_id: customerId,
            },
            { merge: true }
          );
        }
      } catch {
        // Keep graceful fallback error below.
      }
    }
    if (!customerId && email) {
      try {
        const customerList = await stripe.customers.list({
          email: rawEmail || email,
          limit: 1,
        });
        const matched = customerList.data?.[0];
        if (matched?.id) {
          customerId = matched.id.trim();
          await memberDoc.ref.set(
            {
              stripeCustomerId: customerId,
              stripe_customer_id: customerId,
            },
            { merge: true }
          );
        }
      } catch {
        // Keep graceful fallback error below.
      }
    }
    if (!customerId) {
      return NextResponse.json(
        { error: "No Stripe customer linked to this account yet. Please contact support and we can reconnect it." },
        { status: 409 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create customer portal session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

