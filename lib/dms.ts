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
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";

export const CONVERSATIONS_COLLECTION = "conversations";
export const MESSAGES_SUBCOLLECTION = "messages";
export const DM_STORAGE_PREFIX = "dm-attachments";

export type ConversationDoc = {
  id: string;
  memberUid: string;
  memberEmail: string | null;
  memberDisplayName: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  /** True if the first message in the thread was sent by the member (conversation id = member uid). Used for "Requests" filter. */
  firstMessageFromMember?: boolean | null;
};

export type MessageDoc = {
  id: string;
  senderId: string;
  senderEmail: string | null;
  text: string;
  imageUrls: string[];
  videoUrls: string[];
  createdAt: Date | null;
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
    createdAt,
    updatedAt,
    lastMessageAt,
    lastMessagePreview: data.lastMessagePreview != null ? String(data.lastMessagePreview) : null,
    firstMessageFromMember: data.firstMessageFromMember === true ? true : data.firstMessageFromMember === false ? false : null,
  };
}

export function messageFromDoc(id: string, data: Record<string, unknown>): MessageDoc {
  const createdAt = (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? null;
  const imageUrls = Array.isArray(data.imageUrls) ? (data.imageUrls as string[]) : [];
  const videoUrls = Array.isArray(data.videoUrls) ? (data.videoUrls as string[]) : [];
  return {
    id,
    senderId: (data.senderId as string) ?? "",
    senderEmail: data.senderEmail != null ? String(data.senderEmail) : null,
    text: (data.text as string) ?? "",
    imageUrls,
    videoUrls,
    createdAt,
  };
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
  return onSnapshot(q, (snap) => {
    const list: ConversationDoc[] = [];
    snap.forEach((d) => {
      list.push(conversationFromDoc(d.id, d.data() as Record<string, unknown>));
    });
    onUpdate(list);
  });
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
  return onSnapshot(q, (snap) => {
    const list: MessageDoc[] = [];
    snap.forEach((d) => {
      list.push(messageFromDoc(d.id, d.data() as Record<string, unknown>));
    });
    onUpdate(list);
  });
}

export async function ensureConversation(
  db: Firestore,
  memberUid: string,
  memberEmail: string | null,
  memberDisplayName: string | null
): Promise<string> {
  const convRef = doc(db, CONVERSATIONS_COLLECTION, memberUid);
  const snap = await getDoc(convRef);
  if (!snap.exists()) {
    await setDoc(convRef, {
      memberUid,
      memberEmail: memberEmail?.trim().toLowerCase() ?? null,
      memberDisplayName: memberDisplayName?.trim() ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessageAt: null,
      lastMessagePreview: null,
    });
  }
  return memberUid;
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
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function sendMessage(
  db: Firestore,
  conversationId: string,
  senderId: string,
  senderEmail: string | null,
  text: string,
  imageUrls: string[] = [],
  videoUrls: string[] = []
): Promise<string> {
  const messagesRef = collection(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION);
  const docRef = await addDoc(messagesRef, {
    senderId,
    senderEmail: senderEmail?.trim().toLowerCase() ?? null,
    text: (text || "").trim(),
    imageUrls,
    videoUrls,
    createdAt: serverTimestamp(),
  });
  const preview = (text || "").trim().slice(0, 80) + ((text || "").length > 80 ? "\u2026" : "");
  const convRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
  const wasFirstMessage = await getDocs(query(messagesRef, limit(2))).then((snap) => snap.size === 1);
  await updateDoc(convRef, {
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessagePreview: preview || "(attachment)",
    ...(wasFirstMessage ? { firstMessageFromMember: senderId === conversationId } : {}),
  });
  return docRef.id;
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
