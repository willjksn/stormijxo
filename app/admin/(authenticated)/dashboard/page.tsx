"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { getFirebaseDb } from "../../../../lib/firebase";
import { SchedulePlanner } from "../../../calendar/page";

type Timestamp = { toDate: () => Date };

function ToolsPanel({ currentTool }: { currentTool: string }) {
  return (
    <section className="panel active panel-tools" id="panel-tools">
      <div className="tools-content">
        {currentTool === "calendar" && <SchedulePlanner />}
        {currentTool === "media" && (
          <p className="tools-placeholder-text">
            <Link href="/admin/media" className="tools-outbound-link">Open Media</Link> to manage media.
          </p>
        )}
        {currentTool === "content" && (
          <p className="tools-placeholder-text">
            <Link href="/admin/content" className="tools-outbound-link">Open Content</Link> to manage content.
          </p>
        )}
        {currentTool === "posts" && (
          <p className="tools-placeholder-text">
            <Link href="/admin/posts" className="tools-outbound-link">Open Post</Link> to manage posts.
          </p>
        )}
      </div>
    </section>
  );
}

const TOOLS_QUICK_LINKS = [
  { id: "calendar", label: "Calendar" },
  { id: "posts", label: "Post" },
  { id: "media", label: "Media" },
  { id: "content", label: "Content" },
] as const;

export default function AdminDashboardPage() {
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel") === "tools" ? "tools" : "overview";
  const toolParam = searchParams.get("tool") || "calendar";
  const currentTool = TOOLS_QUICK_LINKS.find((t) => t.id === toolParam)?.id ?? "calendar";
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [stats, setStats] = useState({ totalUsers: "—", newUsers: "—", totalRevenue: "—", revenue30d: "—", avgOrder: "—", repeatBuyers: "—", tipsTotal: "—", tips30d: "—", tipsCount: "—", postsThisMonth: "—", totalLikes: "—" });
  const [activity, setActivity] = useState<{ name: string; dateStr: string; photoUrl: string | null; initial: string }[]>([]);
  const [topSpenders, setTopSpenders] = useState<{ email: string; name: string; totalCents: number }[]>([]);
  const [topPurchases, setTopPurchases] = useState<{ name: string; count: number; cents: number }[]>([]);
  const [topPostLikes, setTopPostLikes] = useState<{ id: string; imageUrl: string | null; body: string; value: number } | null>(null);
  const [topPostComments, setTopPostComments] = useState<{ id: string; imageUrl: string | null; body: string; value: number } | null>(null);
  const [topPostTips, setTopPostTips] = useState<{ id: string; imageUrl: string | null; body: string; value: number } | null>(null);
  const [spendersExpanded, setSpendersExpanded] = useState(false);

  const db = getFirebaseDb();

  useEffect(() => {
    if (!db) {
      setOverviewLoading(false);
      return;
    }
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);

    getDocs(collection(db, "members")).then((snap) => {
      let total = snap.size;
      let newCount = 0;
      snap.forEach((doc) => {
        const d = doc.data();
        const joined = (d.joinedAt as Timestamp)?.toDate?.();
        if (joined && joined >= cutoff30) newCount++;
      });
      setStats((s) => ({ ...s, totalUsers: String(total), newUsers: String(newCount) }));
    }).catch(() => {});

    getDocs(query(collection(db, "members"), orderBy("joinedAt", "desc"), limit(15))).then((snap) => {
      const items: { name: string; dateStr: string; photoUrl: string | null; initial: string }[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        let name = (d.displayName || d.instagram_handle || d.note || d.email || "Member").toString().trim();
        if (name.startsWith("@")) name = name.slice(1);
        const initial = (name.charAt(0) || "?").toUpperCase();
        const photoUrl = d.avatarUrl || d.photoURL || null;
        let dateStr = "—";
        const joined = (d.joinedAt as Timestamp)?.toDate?.();
        if (joined) dateStr = joined.toLocaleString(undefined, { month: "numeric", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
        items.push({ name, dateStr, photoUrl, initial });
      });
      setActivity(items);
    }).catch(() => {});

    Promise.all([
      getDocs(collection(db, "tips")),
      getDocs(collection(db, "purchases")).catch(() => ({ empty: true, forEach: () => {} } as { empty: boolean; forEach: () => void })),
    ]).then(([tipsSnap, purchasesSnap]) => {
      let tipsTotalCents = 0, tips30dCents = 0, tipsCount = 0;
      const byEmail: Record<string, { email: string; name: string; totalCents: number }> = {};
      tipsSnap.forEach((doc) => {
        const d = doc.data();
        const cents = typeof d.amountCents === "number" ? d.amountCents : 0;
        tipsTotalCents += cents;
        tipsCount++;
        const tippedAt = (d.tippedAt as Timestamp)?.toDate?.();
        if (tippedAt && tippedAt >= cutoff30) tips30dCents += cents;
        const email = (d.email ?? "").toString().trim().toLowerCase();
        if (!email) return;
        if (!byEmail[email]) byEmail[email] = { email: d.email || email, name: (d.instagram_handle || d.email || email).toString().trim(), totalCents: 0 };
        byEmail[email].totalCents += cents;
        if (d.instagram_handle) byEmail[email].name = String(d.instagram_handle).trim();
      });
      let storeTotalCents = 0, store30dCents = 0;
      const byProduct: Record<string, { count: number; cents: number }> = {};
      if (!(purchasesSnap as { empty?: boolean }).empty && (purchasesSnap as { forEach: (fn: (d: { data: () => Record<string, unknown> }) => void) => void }).forEach) {
        (purchasesSnap as { forEach: (fn: (d: { data: () => Record<string, unknown> }) => void) => void }).forEach((doc: { data: () => Record<string, unknown> }) => {
          const d = doc.data();
          const cents = typeof d.amountCents === "number" ? d.amountCents as number : typeof d.amount === "number" ? Math.round((d.amount as number) * 100) : 0;
          storeTotalCents += cents;
          const createdAt = (d.createdAt as Timestamp)?.toDate?.() ?? (d.purchasedAt as Timestamp)?.toDate?.();
          if (createdAt && createdAt >= cutoff30) store30dCents += cents;
          const name = (d.productName || d.productId || d.sku || "Purchase").toString();
          if (!byProduct[name]) byProduct[name] = { count: 0, cents: 0 };
          byProduct[name].count++;
          byProduct[name].cents += cents;
        });
      }
      const totalRevenue = tipsTotalCents + storeTotalCents;
      const revenue30d = tips30dCents + store30dCents;
      const totalTx = tipsCount + ((purchasesSnap as { empty?: boolean; size?: number }).empty ? 0 : (purchasesSnap as { size: number }).size ?? 0);
      const sorted = Object.values(byEmail).filter((o) => o.totalCents > 0).sort((a, b) => b.totalCents - a.totalCents);
      const purchasesList = Object.entries(byProduct).map(([name, o]) => ({ name, count: o.count, cents: o.cents })).sort((a, b) => b.cents - a.cents);
      setTopSpenders(sorted);
      setTopPurchases(purchasesList.length ? purchasesList : [
        { name: "1-on-1 Chat", count: 12, cents: 24000 },
        { name: "Video Call", count: 8, cents: 40000 },
        { name: "Personal Message", count: 24, cents: 12000 },
      ]);
      setStats((s) => ({
        ...s,
        totalRevenue: totalRevenue > 0 ? "$" + (totalRevenue / 100).toFixed(2) : "$0.00",
        revenue30d: revenue30d > 0 ? "$" + (revenue30d / 100).toFixed(2) : "$0.00",
        avgOrder: totalTx > 0 && totalRevenue > 0 ? "$" + (totalRevenue / 100 / totalTx).toFixed(2) : "—",
        repeatBuyers: String(Object.values(byEmail).filter((o) => o.totalCents > 0).length),
        tipsTotal: tipsTotalCents > 0 ? "$" + (tipsTotalCents / 100).toFixed(2) : "$0.00",
        tips30d: tips30dCents > 0 ? "$" + (tips30dCents / 100).toFixed(2) : "$0.00",
        tipsCount: String(tipsCount),
      }));
    }).catch(() => {}).finally(() => setOverviewLoading(false));

    getDocs(collection(db, "posts")).then((snap) => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      let thisMonth = 0;
      let totalLikes = 0;
      interface PostRow {
        id: string;
        imageUrl: string | null;
        body: string;
        likeCount: number;
        commentCount: number;
        tipRaisedCents: number;
      }
      let bestLikes: PostRow | null = null;
      let bestComments: PostRow | null = null;
      let bestTips: PostRow | null = null;
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i++) {
        const docSnap = docs[i];
        const d = docSnap.data();
        const created = (d.createdAt as Timestamp)?.toDate?.();
        const likeCount = typeof d.likeCount === "number" ? d.likeCount : 0;
        const comments = (d.comments as unknown[]) ?? [];
        const commentCount = comments.length;
        const tipGoal = d.tipGoal as { raisedCents?: number } | undefined;
        const tipRaisedCents = typeof tipGoal?.raisedCents === "number" ? tipGoal.raisedCents : 0;
        if (created && created >= monthStart) thisMonth++;
        totalLikes += likeCount;
        if (created && created >= monthStart) {
          const mediaUrls = (d.mediaUrls as string[]) ?? [];
          const firstImage = mediaUrls.find((u: string) => !/\.(mp4|webm|mov|ogg)(\?|$)/i.test(u)) ?? mediaUrls[0] ?? null;
          const row: PostRow = {
            id: docSnap.id,
            imageUrl: firstImage,
            body: (d.body as string) ?? "",
            likeCount,
            commentCount,
            tipRaisedCents,
          };
          if (!bestLikes || likeCount > bestLikes.likeCount) bestLikes = row;
          if (!bestComments || commentCount > bestComments.commentCount) bestComments = row;
          if (tipRaisedCents > 0 && (!bestTips || tipRaisedCents > bestTips.tipRaisedCents)) bestTips = row;
        }
      }
      setStats((s) => ({ ...s, postsThisMonth: String(thisMonth), totalLikes: String(totalLikes) }));
      setTopPostLikes(bestLikes ? { id: bestLikes.id, imageUrl: bestLikes.imageUrl, body: bestLikes.body, value: bestLikes.likeCount } : null);
      setTopPostComments(bestComments ? { id: bestComments.id, imageUrl: bestComments.imageUrl, body: bestComments.body, value: bestComments.commentCount } : null);
      setTopPostTips(bestTips ? { id: bestTips.id, imageUrl: bestTips.imageUrl, body: bestTips.body, value: bestTips.tipRaisedCents } : null);
    }).catch(() => {});
  }, [db]);

  return (
    <>
      <main className="admin-main custom-scrollbar" role="main">
        <div className="admin-main-inner">
          {panel === "overview" && (
            <section className="panel active panel-overview" id="panel-overview">
              {overviewLoading && <p className="loading-stats">Loading…</p>}
              {!overviewLoading && (
                <>
                  <div className="overview-section">
                    <h2 className="overview-section-title">Audience</h2>
                    <div className="overview-cards">
                      <div className="stat-card">
                        <div className="label">Total members</div>
                        <div className="value">{stats.totalUsers}</div>
                        <div className="sublabel">Paying subscribers</div>
                      </div>
                      <div className="stat-card">
                        <div className="label">New members (30d)</div>
                        <div className="value">{stats.newUsers}</div>
                      </div>
                    </div>
                  </div>
                  <div className="overview-section">
                    <h2 className="overview-section-title">Total revenue</h2>
                    <div className="overview-cards">
                      <div className="stat-card revenue-total">
                        <div className="label">Tips + subscriptions + store</div>
                        <div className="value">{stats.totalRevenue}</div>
                      </div>
                    </div>
                  </div>
                  <div className="overview-section">
                    <h2 className="overview-section-title">Spend metrics to track</h2>
                    <div className="overview-cards metrics-grid">
                      <div className="stat-card">
                        <div className="label">Revenue (30d)</div>
                        <div className="value">{stats.revenue30d}</div>
                        <div className="sublabel">Rolling monthly trend</div>
                      </div>
                      <div className="stat-card">
                        <div className="label">Avg order value</div>
                        <div className="value">{stats.avgOrder}</div>
                        <div className="sublabel">Total revenue ÷ transactions</div>
                      </div>
                      <div className="stat-card">
                        <div className="label">Repeat buyers</div>
                        <div className="value">{stats.repeatBuyers}</div>
                        <div className="sublabel">Tips or store more than once</div>
                      </div>
                      <div className="stat-card">
                        <div className="label">Refunds</div>
                        <div className="value">—</div>
                        <div className="sublabel">Track when you add refunds</div>
                      </div>
                      <div className="stat-card">
                        <div className="label">Tips total</div>
                        <div className="value">{stats.tipsTotal}</div>
                        <div className="sublabel">30d: {stats.tips30d} · Tips: {stats.tipsCount}</div>
                      </div>
                    </div>
                  </div>
                  <div className="overview-section">
                    <h2 className="overview-section-title">Content & engagement</h2>
                    <div className="overview-cards metrics-grid">
                      <div className="stat-card">
                        <div className="label">Posts this month</div>
                        <div className="value">{stats.postsThisMonth}</div>
                        <div className="sublabel">Feed posts</div>
                      </div>
                      <div className="stat-card">
                        <div className="label">Total likes</div>
                        <div className="value">{stats.totalLikes}</div>
                        <div className="sublabel">Across all posts</div>
                      </div>
                    </div>
                    <div className="best-posts-grid">
                      {topPostLikes ? (
                        <div className="best-post-card best-post-card-sm">
                          <h3 className="best-post-card-title">Most likes</h3>
                          <p className="best-post-card-sublabel">This month</p>
                          <div className="best-post-card-inner">
                            {topPostLikes.imageUrl && (
                              <div className="best-post-card-preview">
                                <img src={topPostLikes.imageUrl} alt="" loading="lazy" decoding="async" />
                              </div>
                            )}
                            <div className="best-post-card-meta">
                              <p className="best-post-card-caption">{topPostLikes.body || "No caption"}</p>
                              <div className="best-post-card-stats"><span>{topPostLikes.value} likes</span></div>
                              <Link href={`/admin/posts?edit=${topPostLikes.id}`} className="best-post-card-link">Edit post</Link>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="best-post-card best-post-card-sm best-post-card-demo">
                          <h3 className="best-post-card-title">Most likes</h3>
                          <p className="best-post-card-sublabel">This month</p>
                          <div className="best-post-card-inner">
                            <div className="best-post-card-preview">
                              <img src="/assets/preview1.png" alt="" />
                            </div>
                            <div className="best-post-card-meta">
                              <p className="best-post-card-caption">Top post by likes will appear here.</p>
                              <div className="best-post-card-stats"><span>—</span></div>
                              <Link href="/admin/posts" className="best-post-card-link">Create a post</Link>
                            </div>
                          </div>
                        </div>
                      )}
                      {topPostComments ? (
                        <div className="best-post-card best-post-card-sm">
                          <h3 className="best-post-card-title">Most comments</h3>
                          <p className="best-post-card-sublabel">This month</p>
                          <div className="best-post-card-inner">
                            {topPostComments.imageUrl && (
                              <div className="best-post-card-preview">
                                <img src={topPostComments.imageUrl} alt="" loading="lazy" decoding="async" />
                              </div>
                            )}
                            <div className="best-post-card-meta">
                              <p className="best-post-card-caption">{topPostComments.body || "No caption"}</p>
                              <div className="best-post-card-stats"><span>{topPostComments.value} comments</span></div>
                              <Link href={`/admin/posts?edit=${topPostComments.id}`} className="best-post-card-link">Edit post</Link>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="best-post-card best-post-card-sm best-post-card-demo">
                          <h3 className="best-post-card-title">Most comments</h3>
                          <p className="best-post-card-sublabel">This month</p>
                          <div className="best-post-card-inner">
                            <div className="best-post-card-preview">
                              <img src="/assets/preview1.png" alt="" />
                            </div>
                            <div className="best-post-card-meta">
                              <p className="best-post-card-caption">Top post by comments will appear here.</p>
                              <div className="best-post-card-stats"><span>—</span></div>
                              <Link href="/admin/posts" className="best-post-card-link">Create a post</Link>
                            </div>
                          </div>
                        </div>
                      )}
                      {topPostTips !== null && (
                        <div className="best-post-card best-post-card-sm">
                          <h3 className="best-post-card-title">Most tips</h3>
                          <p className="best-post-card-sublabel">This month</p>
                          <div className="best-post-card-inner">
                            {topPostTips.imageUrl && (
                              <div className="best-post-card-preview">
                                <img src={topPostTips.imageUrl} alt="" loading="lazy" decoding="async" />
                              </div>
                            )}
                            <div className="best-post-card-meta">
                              <p className="best-post-card-caption">{topPostTips.body || "No caption"}</p>
                              <div className="best-post-card-stats"><span>${(topPostTips.value / 100).toFixed(2)} tips</span></div>
                              <Link href={`/admin/posts?edit=${topPostTips.id}`} className="best-post-card-link">Edit post</Link>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="overview-section">
                    <h2 className="overview-section-title">Activity & performance</h2>
                    <div className="overview-layout">
                      <div>
                        <div className="recent-activity-card">
                          <h2>Recent activity</h2>
                          <div className="recent-activity-list">
                            {activity.length === 0 && <span className="recent-activity-empty">No members yet.</span>}
                            {activity.map((item, i) => (
                              <div key={i} className="recent-activity-item">
                                <div className="activity-avatar">
                                  {item.photoUrl ? <img src={item.photoUrl} alt="" loading="lazy" decoding="async" /> : item.initial}
                                </div>
                                <div className="activity-body">
                                  <span className="activity-name">{item.name}</span>
                                  <span className="activity-text"> joined My Inner circle</span>
                                  <div className="activity-meta">{item.dateStr}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className={`top-spenders-card${spendersExpanded ? " expanded" : ""}`}>
                          <h2>Top spenders</h2>
                          <div className="top-spenders-list">
                            {(topSpenders.length ? topSpenders : [
                              { email: "alex.rivera@example.com", name: "Alex Rivera", totalCents: 12500 },
                              { email: "jordan.lee@example.com", name: "Jordan Lee", totalCents: 8500 },
                              { email: "sam.taylor@example.com", name: "Sam Taylor", totalCents: 5200 },
                            ]).slice(0, spendersExpanded ? undefined : 3).map((o, i) => (
                              <div key={i} className={`top-spenders-item${i >= 3 ? " top-spenders-item-more" : ""}`}>
                                <div className="spender-avatar">{(o.name || "?").charAt(0).toUpperCase()}</div>
                                <div className="spender-info">
                                  <span className="spender-name">{o.name}</span>
                                  <span className="spender-email">{o.email}</span>
                                </div>
                                <span className="spender-amount">${(o.totalCents / 100).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          {topSpenders.length > 3 && (
                            <button type="button" className="top-spenders-toggle" onClick={() => setSpendersExpanded((e) => !e)}>
                              {spendersExpanded ? "Show less" : "View more"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="top-purchases-card">
                        <h2>Top purchases</h2>
                        <p className="top-purchases-note" style={{ marginBottom: "0.75rem" }}>Store: personal messages, 1-on-1 chat, video & voice calls</p>
                        <table className="top-purchases-table">
                          <thead>
                            <tr><th>Product</th><th>Purchases</th><th>Revenue</th></tr>
                          </thead>
                          <tbody>
                            {topPurchases.map((r, i) => (
                              <tr key={i}>
                                <td>{r.name}</td>
                                <td>{r.count}</td>
                                <td className="purchase-revenue">${(r.cents / 100).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="top-purchases-note">Store coming soon. Real data will appear when you add a purchases collection.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
          {panel === "tools" && (
            <ToolsPanel currentTool={currentTool} />
          )}
        </div>
      </main>
    </>
  );
}
