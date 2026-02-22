export type Treat = {
  id: string;
  name: string;
  price: number;
  description: string;
  quantityLeft: number;
};

export const TREATS: Treat[] = [
  {
    id: "voice-30",
    name: "30-Second Voice Note",
    price: 25,
    description: "I'll say your name. Keep it short. Keep it personal.",
    quantityLeft: 10,
  },
  {
    id: "voice-60",
    name: "60-Second Voice Note",
    price: 45,
    description: "More direct. Slightly longer. Still chill.",
    quantityLeft: 8,
  },
  {
    id: "video-reply",
    name: "Private Video Reply",
    price: 35,
    description: "Ask me something. I'll respond privately.",
    quantityLeft: 12,
  },
  {
    id: "birthday",
    name: "Birthday Message",
    price: 50,
    description: "Custom video. Don't make it weird.",
    quantityLeft: 6,
  },
  {
    id: "overthinking",
    name: "Overthinking Response",
    price: 30,
    description: "Tell me what's stuck in your head. I'll answer.",
    quantityLeft: 15,
  },
  {
    id: "check-in",
    name: "Random Check-In",
    price: 20,
    description: "A short message from me when you least expect it.",
    quantityLeft: 20,
  },
];
