/**
 * Subscribers (members) list for admin — used by Chat Session to show "Select Fan" from all subscribers.
 * Includes all members; uses auth uid when present, otherwise "member-{docId}" so everyone appears in the list.
 */

import {
  collection,
  query,
  limit,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

export type SubscriberDoc = {
  id: string;
  uid: string | null;
  userId: string | null;
  email: string | null;
  displayName: string | null;
};

function subscriberFromDoc(id: string, data: Record<string, unknown>): SubscriberDoc {
  const uid = data.uid != null ? String(data.uid).trim() : null;
  const userId = data.userId != null ? String(data.userId).trim() : null;
  const email = data.email != null ? String(data.email).trim().toLowerCase() : null;
  const displayName =
    (data.displayName ?? data.instagram_handle ?? data.note ?? data.email) != null
      ? String(data.displayName ?? data.instagram_handle ?? data.note ?? data.email).trim()
      : null;
  return {
    id,
    uid: uid || null,
    userId: userId || null,
    email: email || null,
    displayName: displayName || null,
  };
}

/**
 * Subscribe to the members collection (subscribers). Includes all members; those with uid/userId
 * use that as the conversation id; others use "member-{id}" so they still appear in the dropdown.
 */
export function subscribeSubscribers(
  db: Firestore,
  onUpdate: (list: SubscriberDoc[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "members"),
    limit(500)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: SubscriberDoc[] = [];
      snap.forEach((d) => {
        const sub = subscriberFromDoc(d.id, d.data() as Record<string, unknown>);
        const authUid = sub.uid || sub.userId || ("member-" + sub.id);
        list.push({ ...sub, uid: authUid, userId: authUid });
      });
      list.sort((a, b) => {
        const na = (a.displayName || a.email || a.id).toLowerCase();
        const nb = (b.displayName || b.email || b.id).toLowerCase();
        return na.localeCompare(nb);
      });
      onUpdate(list);
    },
    (err) => {
      console.warn("[subscribers] subscribeSubscribers error:", err?.message ?? err);
      onUpdate([]);
    }
  );
}
