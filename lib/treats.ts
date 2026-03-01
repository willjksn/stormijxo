/**
 * Treats store: Firestore collection and types.
 * Used by member treats page, admin treats page, treat-checkout API, and stripe webhook.
 */

export const TREATS_COLLECTION = "treats";

export type TreatDoc = {
  id: string;
  name: string;
  price: number; // dollars
  description: string;
  quantityLeft: number;
  order: number;
  /** If true, treat is hidden from the store (admin can toggle). */
  hidden?: boolean;
};

/** Default treats for seeding when collection is empty (from original treats-data). */
export const DEFAULT_TREATS: TreatDoc[] = [
  { id: "voice-30", name: "30-Second Voice Note", price: 25, description: "I'll say your name. Keep it short. Keep it personal.", quantityLeft: 10, order: 0 },
  { id: "voice-60", name: "60-Second Voice Note", price: 45, description: "More direct. Slightly longer. Still chill.", quantityLeft: 8, order: 1 },
  { id: "video-reply", name: "Private Video Reply", price: 35, description: "Ask me something. I'll respond privately.", quantityLeft: 12, order: 2 },
  { id: "birthday", name: "Birthday Message", price: 50, description: "Custom video. Don't make it weird.", quantityLeft: 6, order: 3 },
  { id: "overthinking", name: "Overthinking Response", price: 30, description: "Tell me what's stuck in your head. I'll answer.", quantityLeft: 15, order: 4 },
  { id: "check-in", name: "Random Check-In", price: 20, description: "A short message from me when you least expect it.", quantityLeft: 20, order: 5 },
  { id: "chat-session-15", name: "15-Min Live Chat", price: 40, description: "A live 1:1 chat session with me at a time we agree on.", quantityLeft: 20, order: 6 },
  { id: "chat-session-30", name: "30-Min Live Chat", price: 75, description: "A 30-minute live chat session. We'll pick a time together.", quantityLeft: 15, order: 7 },
  { id: "chat-session-45", name: "45-Min Live Chat", price: 100, description: "A 45-minute live chat session. We'll pick a time together.", quantityLeft: 10, order: 8 },
  { id: "chat-session-60", name: "1-Hour Live Chat", price: 125, description: "A full hour live chat session. We'll pick a time together.", quantityLeft: 10, order: 9 },
];

/** Generate a URL-safe id from name for new treats. */
export function slugForTreatName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32) || "treat-" + Date.now();
}
