"use client";

import { useEffect, useState, useRef } from "react";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { getFirebaseDb } from "../../../lib/firebase";
import { PURCHASES_COLLECTION } from "../../../lib/purchases";

export type MemberProfileCardMember = {
  uid?: string | null;
  email: string | null;
  displayName?: string | null;
};

type ProfileData = {
  photoURL: string | null;
  displayName: string | null;
  username: string | null;
  email: string | null;
};

type PurchaseRow = { productName: string | null; amountCents: number | null };
type TipsRow = { totalCents: number; count: number };

type MemberProfileCardProps = {
  member: MemberProfileCardMember;
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
};

export function MemberProfileCard({ member, anchorRef, open, onClose }: MemberProfileCardProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [tips, setTips] = useState<TipsRow>({ totalCents: 0, count: 0 });
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const db = getFirebaseDb();
    if (!db) return;

    const email = (member.email ?? "").trim().toLowerCase();
    const hasEmail = email.length > 0;

    setLoading(true);

    const loadUserProfile = (): Promise<{ data: () => Record<string, unknown> } | null> => {
      if (member.uid) {
        return getDoc(doc(db, "users", member.uid)).then((snap) => (snap?.exists() ? snap : null));
      }
      if (!hasEmail) return Promise.resolve(null);
      return getDocs(query(collection(db, "users"), where("email", "==", email), limit(1))).then((snap) =>
        snap.empty ? null : snap.docs[0]
      );
    };

    Promise.all([
      loadUserProfile(),
      hasEmail ? getDocs(query(collection(db, PURCHASES_COLLECTION), where("email", "==", email))) : Promise.resolve(null),
      hasEmail ? getDocs(query(collection(db, "tips"), where("email", "==", email))) : Promise.resolve(null),
    ])
      .then(([userSnapOrDoc, purchasesSnap, tipsSnap]) => {
        const d: Record<string, unknown> = userSnapOrDoc ? userSnapOrDoc.data() ?? {} : {};
        setProfile({
          photoURL: (d.photoURL ?? d.avatarUrl ?? null) != null ? String(d.photoURL ?? d.avatarUrl) : null,
          displayName: d.displayName != null ? String(d.displayName) : null,
          username: d.username != null ? String(d.username) : null,
          email: d.email != null ? String(d.email) : null,
        });

        const purchaseList: PurchaseRow[] = [];
        if (purchasesSnap && !purchasesSnap.empty) {
          purchasesSnap.forEach((p) => {
            const data = p.data() as Record<string, unknown>;
            purchaseList.push({
              productName: data.productName != null ? String(data.productName) : null,
              amountCents: typeof data.amountCents === "number" ? data.amountCents : null,
            });
          });
        }
        setPurchases(purchaseList);

        let totalCents = 0;
        let count = 0;
        if (tipsSnap && !tipsSnap.empty) {
          tipsSnap.forEach((t) => {
            const data = t.data() as Record<string, unknown>;
            const cents = typeof data.amountCents === "number" ? data.amountCents : 0;
            totalCents += cents;
            if (cents > 0) count++;
          });
        }
        setTips({ totalCents, count });
      })
      .catch(() => {
        setProfile(null);
        setPurchases([]);
        setTips({ totalCents: 0, count: 0 });
      })
      .finally(() => setLoading(false));
  }, [open, member.uid, member.email, onClose]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        cardRef.current && !cardRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const displayName = profile?.displayName ?? member.displayName ?? profile?.email ?? member.email ?? "—";
  const username = profile?.username ?? null;
  const email = profile?.email ?? member.email ?? null;

  return (
    <div
      ref={cardRef}
      className="member-profile-card"
      role="dialog"
      aria-label="Member profile"
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        marginTop: 4,
        zIndex: 200,
        minWidth: 280,
        maxWidth: 360,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "1rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div className="member-profile-card-avatar" style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "1.25rem", color: "var(--accent)" }}>
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              (displayName.charAt(0) ?? "?").toUpperCase()
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: "1rem" }}>{displayName}</p>
            {username && <p style={{ margin: "0.2rem 0 0", fontSize: "0.9rem", color: "var(--text-muted)" }}>@{username}</p>}
            {email && <p style={{ margin: "0.15rem 0 0", fontSize: "0.85rem", color: "var(--text-muted)", wordBreak: "break-all" }}>{email}</p>}
          </div>
        </div>
      </div>
      <div style={{ padding: "0.75rem 1rem", fontSize: "0.9rem" }}>
        {loading ? (
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Loading…</p>
        ) : (
          <>
            <p style={{ margin: "0 0 0.5rem", fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)" }}>Purchases</p>
            {purchases.length === 0 ? (
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>None</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                {purchases.map((p, i) => (
                  <li key={i} style={{ marginBottom: "0.25rem" }}>
                    {p.productName ?? "Item"}
                    {p.amountCents != null && <span style={{ color: "var(--text-muted)", marginLeft: "0.35rem" }}>${(p.amountCents / 100).toFixed(2)}</span>}
                  </li>
                ))}
              </ul>
            )}
            <p style={{ margin: "0.75rem 0 0.5rem", fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)" }}>Tips paid</p>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              {tips.count === 0 ? "None" : `$${(tips.totalCents / 100).toFixed(2)} (${tips.count} tip${tips.count !== 1 ? "s" : ""})`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
