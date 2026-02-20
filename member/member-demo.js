/**
 * Demo posts for feed preview (shown when Firestore has no posts)
 */
var DEMO_POSTS = [
  {
    id: "demo-1",
    title: "Behind the scenes",
    body: "Spent the day on set for the new shoot. Can't wait to share the final images with you all. The lighting was perfect.",
    mediaUrls: ["https://picsum.photos/500/625?random=1", "https://picsum.photos/500/625?random=2"],
    dateStr: "Feb 18, 2025",
    likeCount: 42,
    comments: [
      { username: "alex_j", text: "Love this! So excited for the results 💕" },
      { username: "jordan.k", text: "The vibes look amazing" }
    ]
  },
  {
    id: "demo-2",
    title: "New drop coming soon",
    body: "Something special is in the works. Stay tuned for the announcement this weekend.",
    mediaUrls: ["https://picsum.photos/500/625?random=3"],
    dateStr: "Feb 16, 2025",
    likeCount: 28,
    comments: [
      { username: "sam_r", text: "Can't wait!!" },
      { username: "riley_v", text: "Already counting down" },
      { username: "casey_b", text: "This is going to be good" }
    ]
  },
  {
    id: "demo-3",
    title: "Throwback",
    body: "Found this from last year. Sometimes the best moments are the unplanned ones.",
    mediaUrls: ["https://picsum.photos/500/625?random=4", "https://picsum.photos/500/625?random=5", "https://picsum.photos/500/625?random=6"],
    dateStr: "Feb 14, 2025",
    likeCount: 156,
    comments: [
      { username: "morgan_w", text: "So nostalgic ✨" }
    ]
  },
  {
    id: "demo-4",
    title: "Sunday vibes",
    body: "Low-key day. Coffee, music, and catching up on DMs. What are you all up to?",
    mediaUrls: ["https://picsum.photos/500/625?random=7"],
    dateStr: "Feb 12, 2025",
    likeCount: 89,
    comments: [
      { username: "taylor_m", text: "Living for this aesthetic" },
      { username: "avery_l", text: "Same energy over here" }
    ]
  }
];

function getDemoPost(id) {
  return DEMO_POSTS.filter(function(p) { return p.id === id; })[0] || null;
}
