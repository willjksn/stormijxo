export type DemoPost = {
  id: string;
  title: string;
  body: string;
  mediaUrls: string[];
  dateStr: string;
  likeCount: number;
  comments: { username: string; text: string }[];
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
  },
  {
    id: "demo-3",
    title: "Sunday vibes",
    body: "Low-key day. Coffee, music, and catching up on DMs. What are you up to?",
    mediaUrls: ["https://picsum.photos/500/625?random=7"],
    dateStr: "Feb 12, 2025",
    likeCount: 89,
    comments: [{ username: "taylor_m", text: "Love this aesthetic." }],
  },
];
