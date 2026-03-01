/**
 * Caption generation usage limits per admin (Firestore or in-memory).
 */

import { getFirebaseAdmin } from "./firebase-admin";

const DAILY_LIMIT = 100;
const USAGE_COLLECTION = "studio_caption_usage";

interface UsageDoc {
  uid: string;
  dateKey: string;
  count: number;
  updatedAt: unknown;
}

function getDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getCaptionUsageRemaining(uid: string): Promise<number> {
  try {
    const { db } = getFirebaseAdmin();
    const dateKey = getDateKey();
    const snap = await db.collection(USAGE_COLLECTION).where("uid", "==", uid).where("dateKey", "==", dateKey).limit(1).get();
    let count = 0;
    snap.forEach((doc) => {
      const d = doc.data() as UsageDoc;
      count = typeof d.count === "number" ? d.count : 0;
    });
    return Math.max(0, DAILY_LIMIT - count);
  } catch {
    return DAILY_LIMIT;
  }
}

export async function incrementCaptionUsage(uid: string): Promise<{ remaining: number }> {
  const { db } = getFirebaseAdmin();
  const dateKey = getDateKey();
  const docId = `${uid}:${dateKey}`;
  const ref = db.collection(USAGE_COLLECTION).doc(docId);
  const admin = require("firebase-admin") as { firestore: { FieldValue: { increment: (n: number) => unknown; serverTimestamp: () => unknown } } };
  await ref.set(
    {
      uid,
      dateKey,
      count: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  const snap = await ref.get();
  const data = snap.data() as UsageDoc | undefined;
  const count = typeof data?.count === "number" ? data.count : 1;
  return { remaining: Math.max(0, DAILY_LIMIT - count) };
}

export { DAILY_LIMIT as CAPTION_DAILY_LIMIT };
