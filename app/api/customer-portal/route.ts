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

    const body = (await req.json().catch(() => ({}))) as { returnUrl?: string };
    const returnUrl = body.returnUrl && body.returnUrl.trim() ? body.returnUrl.trim() : "https://stormijxo.com/profile";

    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(token);
    const email = (decoded.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "No email on signed-in account." }, { status: 400 });
    }

    const db = getFirestore(app);
    const membersSnap = await db.collection("members").where("email", "==", email).limit(1).get();
    if (membersSnap.empty) {
      return NextResponse.json({ error: "No subscription found for this account." }, { status: 404 });
    }

    const member = membersSnap.docs[0]?.data() as { stripeCustomerId?: string } | undefined;
    const customerId = (member?.stripeCustomerId || "").trim();
    if (!customerId) {
      return NextResponse.json({ error: "No Stripe customer linked to this account yet." }, { status: 409 });
    }

    const stripe = new Stripe(stripeSecret);
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

