/**
 * DMs: 1:1 conversations between admin and members.
 * Conversation doc id = member uid. Messages in subcollection.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";

export const CONVERSATIONS_COLLECTION = "conversations";
export const MESSAGES_SUBCOLLECTION = "messages";
export const DM_STORAGE_PREFIX = "dm-attachments";
/** Tracks which user has unlocked which locked media (conversationId, messageId, unlockId, uid). */
export const MEDIA_UNLOCKS_COLLECTION = "mediaUnlocks";

export type ConversationDoc = {
  id: string;
  memberUid: string;
  memberEmail: string | null;
  /** Legacy / internal; prefer {@link memberUsername} for fan-facing labels. */
  memberDisplayName: string | null;
  /** Lowercase handle from `users/{uid}.username` — use for admin list/thread labels. */
  memberUsername: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  /** True if the first message in the thread was sent by the member (conversation id = member uid). Used for "Requests" filter. */
  firstMessageFromMember?: boolean | null;
};

export type LockedMediaItem = {
  url: string;
  priceCents: number;
  unlockId: string;
  type: "image" | "video";
};

export type MessageDoc = {
  id: string;
  senderId: string;
  senderEmail: string | null;
  text: string;
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
  /** Pay-to-unlock media (blurred until fan pays). */
  lockedMedia?: LockedMediaItem[];
  createdAt: Date | null;
  /** Set when the fan (conversation owner) has seen this message; only on creator/admin-sent messages. */
  readAt: Date | null;
};

export function conversationFromDoc(id: string, data: Record<string, unknown>): ConversationDoc {
  const createdAt = (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? null;
  const updatedAt = (data.updatedAt as { toDate?: () => Date })?.toDate?.() ?? null;
  const lastMessageAt = (data.lastMessageAt as { toDate?: () => Date })?.toDate?.() ?? null;
  return {
    id,
    memberUid: (data.memberUid as string) ?? id,
    memberEmail: data.memberEmail != null ? String(data.memberEmail) : null,
    memberDisplayName: data.memberDisplayName != null ? String(data.memberDisplayName) : null,
    memberUsername: data.memberUsername != null ? String(data.memberUsername).trim().toLowerCase() : null,
    createdAt,
    updatedAt,
    lastMessageAt,
    lastMessagePreview: data.lastMessagePreview != null ? String(data.lastMessagePreview) : null,
    firstMessageFromMember: data.firstMessageFromMember === true ? true : data.firstMessageFromMember === false ? false : null,
  };
}

export function messageFromDoc(id: string, data: Record<string, unknown>): MessageDoc {
  const createdAt = (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? null;
  const readAt = (data.readAt as { toDate?: () => Date })?.toDate?.() ?? null;
  const imageUrls = Array.isArray(data.imageUrls) ? (data.imageUrls as string[]) : [];
  const videoUrls = Array.isArray(data.videoUrls) ? (data.videoUrls as string[]) : [];
  const audioUrls = Array.isArray(data.audioUrls) ? (data.audioUrls as string[]) : [];
  const rawLocked = Array.isArray(data.lockedMedia) ? data.lockedMedia : [];
  const lockedMedia: LockedMediaItem[] = rawLocked
    .filter((i: unknown) => i && typeof i === "object" && "url" in i && "priceCents" in i && "unlockId" in i && "type" in i)
    .map((i: Record<string, unknown>) => ({
      url: String(i.url),
      priceCents: Number(i.priceCents) || 0,
      unlockId: String(i.unlockId),
      type: (i.type === "video" ? "video" : "image") as "image" | "video",
    }));
  return {
    id,
    senderId: (data.senderId as string) ?? "",
    senderEmail: data.senderEmail != null ? String(data.senderEmail) : null,
    text: (data.text as string) ?? "",
    imageUrls,
    videoUrls,
    audioUrls,
    lockedMedia: lockedMedia.length > 0 ? lockedMedia : undefined,
    createdAt,
    readAt,
  };
}

const READ_BATCH_SIZE = 400;

/** Mark creator/admin messages as read by the fan (conversation id = fan uid). Safe to call repeatedly. */
export async function markCreatorMessagesReadByFan(
  db: Firestore,
  conversationId: string,
  fanUid: string,
  messages: MessageDoc[]
): Promise<void> {
  const toMark = messages.filter((m) => m.senderId && m.senderId !== fanUid && !m.readAt);
  if (toMark.length === 0) return;
  for (let i = 0; i < toMark.length; i += READ_BATCH_SIZE) {
    const chunk = toMark.slice(i, i + READ_BATCH_SIZE);
    const batch = writeBatch(db);
    for (const m of chunk) {
      const ref = doc(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION, m.id);
      batch.update(ref, { readAt: serverTimestamp() });
    }
    await batch.commit();
  }
}

export async function listConversations(db: Firestore): Promise<ConversationDoc[]> {
  const q = query(
    collection(db, CONVERSATIONS_COLLECTION),
    orderBy("lastMessageAt", "desc"),
    limit(100)
  );
  const snap = await getDocs(q);
  const list: ConversationDoc[] = [];
  snap.forEach((d) => {
    list.push(conversationFromDoc(d.id, d.data() as Record<string, unknown>));
  });
  return list;
}

export function subscribeConversations(
  db: Firestore,
  onUpdate: (list: ConversationDoc[]) => void
): Unsubscribe {
  const q = query(
    collection(db, CONVERSATIONS_COLLECTION),
    orderBy("lastMessageAt", "desc"),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: ConversationDoc[] = [];
      snap.forEach((d) => {
        list.push(conversationFromDoc(d.id, d.data() as Record<string, unknown>));
      });
      onUpdate(list);
    },
    (err) => {
      console.warn("[dms] subscribeConversations error:", err?.message ?? err);
      onUpdate([]);
    }
  );
}

export function subscribeMessages(
  db: Firestore,
  conversationId: string,
  onUpdate: (list: MessageDoc[]) => void
): Unsubscribe {
  const q = query(
    collection(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION),
    orderBy("createdAt", "asc"),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: MessageDoc[] = [];
      snap.forEach((d) => {
        list.push(messageFromDoc(d.id, d.data() as Record<string, unknown>));
      });
      onUpdate(list);
    },
    (err) => {
      console.warn("[dms] subscribeMessages error:", err?.message ?? err);
      onUpdate([]);
    }
  );
}

export async function ensureConversation(
  db: Firestore,
  memberUid: string,
  memberEmail: string | null,
  memberDisplayName: string | null,
  memberUsername: string | null = null
): Promise<string> {
  const convRef = doc(db, CONVERSATIONS_COLLECTION, memberUid);
  const snap = await getDoc(convRef);
  const email = memberEmail?.trim().toLowerCase() ?? null;
  const uname = memberUsername?.trim().toLowerCase() || null;
  const mergeFields: Record<string, unknown> = {
    memberUid,
    memberEmail: email,
    memberDisplayName: memberDisplayName?.trim() ?? null,
    updatedAt: serverTimestamp(),
  };
  if (uname) mergeFields.memberUsername = uname;

  if (!snap.exists()) {
    await setDoc(convRef, {
      ...mergeFields,
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessagePreview: null,
    });
  } else {
    await setDoc(convRef, mergeFields, { merge: true });
  }
  return memberUid;
}

/** Admin DM labels: @username, else email — not real names. */
export function fanPublicLabel(c: Pick<ConversationDoc, "memberUsername" | "memberEmail">): string {
  const u = c.memberUsername?.trim();
  if (u) return `@${u}`;
  return c.memberEmail?.trim() || "Member";
}

/** Avatar initials from username, else first letter of email. */
export function fanInitialsFromConversation(c: Pick<ConversationDoc, "memberUsername" | "memberEmail">): string {
  const u = c.memberUsername?.trim();
  if (u) {
    const alnum = u.replace(/[^a-z0-9]/gi, "");
    if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
    if (alnum.length === 1) return alnum[0].toUpperCase();
    return u.slice(0, 2).toUpperCase();
  }
  const e = c.memberEmail?.trim();
  if (e) {
    const ch = e[0].toUpperCase();
    return /[A-Z0-9]/i.test(ch) ? ch : "?";
  }
  return "?";
}

export async function uploadDmFile(
  storage: FirebaseStorage,
  conversationId: string,
  messageId: string,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${DM_STORAGE_PREFIX}/${conversationId}/${messageId}/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type || undefined,
    customMetadata: { originalName: file.name },
  });
  await new Promise<void>((resolve, reject) => {
    task.on("state_changed", undefined, reject, () => resolve());
  });
  return getDownloadURL(task.snapshot.ref);
}

export async function sendMessage(
  db: Firestore,
  conversationId: string,
  senderId: string,
  senderEmail: string | null,
  text: string,
  imageUrls: string[] = [],
  videoUrls: string[] = [],
  audioUrls: string[] = [],
  lockedMedia?: LockedMediaItem[],
  existingMessageId?: string
): Promise<string> {
  const messagesRef = collection(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION);
  const payload = {
    senderId,
    senderEmail: senderEmail?.trim().toLowerCase() ?? null,
    text: (text || "").trim(),
    imageUrls: imageUrls ?? [],
    videoUrls: videoUrls ?? [],
    audioUrls: audioUrls ?? [],
    ...(lockedMedia && lockedMedia.length > 0 ? { lockedMedia } : {}),
    createdAt: serverTimestamp(),
  };
  let messageId: string;
  if (existingMessageId) {
    const messageRef = doc(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION, existingMessageId);
    await setDoc(messageRef, payload);
    messageId = existingMessageId;
  } else {
    const docRef = await addDoc(messagesRef, payload);
    messageId = docRef.id;
  }
  const preview = (text || "").trim().slice(0, 80) + ((text || "").length > 80 ? "\u2026" : "");
  const convRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
  const wasFirstMessage = await getDocs(query(messagesRef, limit(2))).then((snap) => snap.size === 1);
  await updateDoc(convRef, {
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessagePreview: preview || "(attachment)",
    ...(wasFirstMessage ? { firstMessageFromMember: senderId === conversationId } : {}),
  });
  return messageId;
}

/** Delete a message (creator only). Removes the message doc; conversation lastMessageAt is not updated. */
export async function deleteMessage(
  db: Firestore,
  conversationId: string,
  messageId: string
): Promise<void> {
  const messageRef = doc(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION, messageId);
  await deleteDoc(messageRef);
}

/** Call after adding a message (e.g. via file upload path) to set firstMessageFromMember if this was the first message. */
export async function setFirstMessageFlagIfFirst(
  db: Firestore,
  conversationId: string,
  senderId: string
): Promise<void> {
  const messagesRef = collection(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION);
  const snap = await getDocs(query(messagesRef, limit(2)));
  if (snap.size !== 1) return;
  await updateDoc(doc(db, CONVERSATIONS_COLLECTION, conversationId), {
    firstMessageFromMember: senderId === conversationId,
  });
}

/** Generate a stable unlock id for a locked media item. */
export function generateUnlockId(): string {
  return "ul-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

/** Get a new message document ref/id for uploading attachments before sending. */
export function getNewMessageRef(db: Firestore, conversationId: string): { ref: ReturnType<typeof doc>; id: string } {
  const messageRef = doc(
    collection(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION)
  );
  return { ref: messageRef, id: messageRef.id };
}

/** Subscribe to media unlocks for a user in a conversation (to know which locked items they've unlocked). */
export function subscribeMediaUnlocks(
  db: Firestore,
  conversationId: string,
  uid: string,
  onUpdate: (unlockIds: Set<string>) => void
): Unsubscribe {
  const q = query(
    collection(db, MEDIA_UNLOCKS_COLLECTION),
    where("conversationId", "==", conversationId),
    where("uid", "==", uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const set = new Set<string>();
      snap.forEach((d) => {
        const data = d.data();
        const key = [data.messageId, data.unlockId].filter(Boolean).join(":");
        if (key) set.add(key);
      });
      onUpdate(set);
    },
    () => onUpdate(new Set())
  );
}

/** Subscribe to new media unlocks in a conversation (for creator to show "Fan paid" banner). Calls onNewUnlock when a new unlock doc appears after initial load. */
export function subscribeNewMediaUnlocks(
  db: Firestore,
  conversationId: string,
  onNewUnlock: (amountCents: number, email: string | null) => void
): Unsubscribe {
  const q = query(
    collection(db, MEDIA_UNLOCKS_COLLECTION),
    where("conversationId", "==", conversationId)
  );
  const seenIds = new Set<string>();
  let initialLoad = true;
  return onSnapshot(
    q,
    (snap) => {
      if (initialLoad) {
        initialLoad = false;
        snap.forEach((d) => seenIds.add(d.id));
        return;
      }
      snap.forEach((d) => {
        if (seenIds.has(d.id)) return;
        seenIds.add(d.id);
        const data = d.data();
        const amountCents = typeof data.amountCents === "number" ? data.amountCents : 0;
        const email = data.email != null ? String(data.email) : null;
        onNewUnlock(amountCents, email);
      });
    },
    () => {}
  );
}

/** Record that a user unlocked a locked media item (called from server after payment). */
export async function recordMediaUnlock(
  db: Firestore,
  conversationId: string,
  messageId: string,
  unlockId: string,
  uid: string
): Promise<void> {
  const id = [conversationId, messageId, unlockId, uid].join("_");
  await setDoc(doc(db, MEDIA_UNLOCKS_COLLECTION, id), {
    conversationId,
    messageId,
    unlockId,
    uid,
    createdAt: serverTimestamp(),
  });
}
