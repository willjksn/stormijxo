export type DemoPost = {
  id: string;
  title: string;
  body: string;
  mediaUrls: string[];
  dateStr: string;
  likeCount: number;
  comments: { username: string; text: string }[];
  poll?: { question: string; options: string[]; optionVotes?: number[] };
  tipGoal?: { description: string; targetCents: number; raisedCents: number };
};

export const DEMO_POSTS: DemoPost[] = [
  {
    id: "demo-1",
    title: "Behind the scenes",
    body: "Spent the day on set for the new shoot. Can't wait to share the final images with you all. The lighting was perfect.",
    mediaUrls: ["https://picsum.photos/500/625?random=1"],
    dateStr: "Feb 18, 2025",
    likeCount: 42,
    comments: [
      { username: "alex_j", text: "Love this! So excited for the results ❤️" },
      { username: "jordan.k", text: "The vibes look amazing" },
    ],
    poll: {
      question: "What should I post next?",
      options: ["More BTS", "Final shots", "Outtakes", "Video clip"],
      optionVotes: [12, 8, 5, 3],
    },
  },
  {
    id: "demo-2",
    title: "New drop coming soon",
    body: "Something special is in the works. Stay tuned for the announcement this weekend.",
    mediaUrls: ["https://picsum.photos/500/625?random=3"],
    dateStr: "Feb 16, 2025",
    likeCount: 28,
    comments: [
      { username: "sam_r", text: "Can't wait." },
      { username: "riley_v", text: "Already counting down." },
    ],
    tipGoal: {
      description: "If I raise $200 I'll post an exclusive behind-the-scenes video.",
      targetCents: 20000,
      raisedCents: 8500,
    },
  },
  {
    id: "demo-3",
    title: "Sunday vibes",
    body: "Low-key day. Coffee, music, and catching up on DMs. What are you up to?",
    mediaUrls: ["https://picsum.photos/500/625?random=7"],
    dateStr: "Feb 12, 2025",
    likeCount: 89,
    comments: [{ username: "taylor_m", text: "Love this aesthetic." }],
    poll: {
      question: "Coffee or tea?",
      options: ["Coffee", "Tea", "Both", "Neither"],
      optionVotes: [45, 28, 12, 4],
    },
    tipGoal: {
      description: "Tips go toward my next photo shoot!",
      targetCents: 50000,
      raisedCents: 12500,
    },
  },
];
