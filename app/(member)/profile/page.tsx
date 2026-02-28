"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getFirebaseDb } from "../../../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { getFirebaseAuth } from "../../../lib/firebase";
import { getAuthErrorMessage, isAdminEmail } from "../../../lib/auth-redirect";

const PROFILE_EMOJI_CATEGORIES = {
  faces: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😎 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😭 😤 😠 😡 🤬 😳 😱 😨 😰 😥 😓 🤗 🤔 😴 🤤 😪 🤒 🤕 🤠 🤡 💩 👻 💀 🎃".split(" "),
  people: "👩 👩‍🦰 👩‍🦱 👩‍🦳 👩‍🦲 👱‍♀️ 👵 👸 💃 🕺 👯‍♀️ 🧚‍♀️ 🧜‍♀️ 🦸‍♀️ 🧝‍♀️ 🙋‍♀️ 🙆‍♀️ 🙅‍♀️ 🤷‍♀️ 👩‍💻 👩‍🎤 👩‍🎨 👩‍🍳 👰‍♀️ 🤰 🤱".split(" "),
  animals: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐵 🦄 🦋 🐝 🐢 🐙 🐬 🐳 🦈 🐊 🐘 🦒 🦘 🐎 🐕 🐓 🦅 🦆 🦢 🦉 🦚 🦜 🐸".split(" "),
  plants: "🌹 🥀 🌺 🌻 🌼 🌷 🌱 🌲 🌳 🌴 🌵 🌿 🍀 🍁 🍄 🔥 ✨ ⭐ ☀️ 🌙 ☁️ 🌊 🌎".split(" "),
  food: "🍇 🍉 🍊 🍋 🍌 🍍 🍎 🍏 🍐 🍑 🍒 🍓 🥝 🍅 🥥 🥑 🍆 🥔 🥕 🌽 🌶️ 🥒 🥬 🥦 🍞 🥐 🥖 🧀 🍖 🍔 🍟 🍕 🌮 🍣 🍤 🍦 🍩 🍪 🎂 🍰 🧁 🍫 🍬 ☕ 🍵 🍾 🍷 🍸 🍹 🍺 🍻 🥂".split(" "),
  sports: "⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🏒 ⛳ 🏹 🥊 🥋 ⛸️ 🎿 🏂 🏋️ 🤸 🏇 🏊 🏄 🎯 🎳 🎮 🎲 🧩 ♟️".split(" "),
  travel: "🎨 🎬 🎤 🎧 🎹 🥁 🎉 🎊 🎄 🎆 🚀 ✈️ 🚁 🛰️ ⛵ 🚢 🚗 🚕 🚌 🚓 🚑 🚒 🚚 🚂 🚲 🚦 🗽 🗼 🏰 🎡 🎢 🎪 ⛺ 🏠 🏡 🏢 🏨 🏦 🏥 🏫 🏛️ 🏝️ 🏞️ ⛰️".split(" "),
  objects: "💡 💻 🖥️ 🖱️ 📱 ☎️ 📺 📷 📹 🎥 💿 💾 💰 💵 💎 🔧 🔨 🛠️ 🔑 🚪 🪑 🛏️ 🛁 🚽 🎁 🎈 📚 📖 📄 📰 🔗 📎 ✂️ 🗑️ 🔒 🔓 🔔 👗 👠 👑 💍 💄 👛 👜".split(" "),
  symbols: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ ☯️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 💯 ✅ ❌ ❓ ❕ ©️ ®️ ™️".split(" "),
} as const;
const PROFILE_EMOJI_CATEGORY_ORDER = ["all", "faces", "people", "animals", "plants", "food", "sports", "travel", "objects", "symbols"] as const;
type ProfileEmojiCategory = (typeof PROFILE_EMOJI_CATEGORY_ORDER)[number];
const PROFILE_EMOJI_CATEGORY_ICONS: Record<ProfileEmojiCategory, string> = {
  all: "😀",
  faces: "😀",
  people: "👩",
  animals: "🐶",
  plants: "🌹",
  food: "🍎",
  sports: "⚽",
  travel: "✈️",
  objects: "💡",
  symbols: "❤️",
};
const PASSWORD_REQUIREMENTS = [
  { id: "len", test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { id: "lower", test: (p: string) => /[a-z]/.test(p), label: "One lowercase letter" },
  { id: "upper", test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { id: "num", test: (p: string) => /\d/.test(p), label: "One number" },
  { id: "special", test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p), label: "One special character" },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const db = getFirebaseDb();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    displayName: string;
    username: string;
    bio: string;
    avatarUrl: string | null;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: "", username: "", bio: "" });
  const [saveLoading, setSaveLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [bioEmojiOpen, setBioEmojiOpen] = useState(false);
  const [bioEmojiQuery, setBioEmojiQuery] = useState("");
  const [bioEmojiCategory, setBioEmojiCategory] = useState<ProfileEmojiCategory>("all");
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [accountSectionOpen, setAccountSectionOpen] = useState<"password" | null>(null);
  const [hasStripeMembership, setHasStripeMembership] = useState<boolean | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const auth = getFirebaseAuth();
  const bioRef = useRef<HTMLTextAreaElement | null>(null);
  const bioEmojiAnchorRef = useRef<HTMLDivElement | null>(null);

  const visibleBioEmojis = useMemo(() => {
    const q = bioEmojiQuery.trim().toLowerCase();
    const source =
      bioEmojiCategory === "all"
        ? PROFILE_EMOJI_CATEGORY_ORDER.filter((c) => c !== "all").flatMap((c) => PROFILE_EMOJI_CATEGORIES[c])
        : PROFILE_EMOJI_CATEGORIES[bioEmojiCategory];
    if (!q) return source;
    return source.filter((e) => e.includes(q));
  }, [bioEmojiCategory, bioEmojiQuery]);

  const insertBioEmojiAtCursor = (emoji: string) => {
    const el = bioRef.current;
    if (!el) {
      setForm((f) => ({ ...f, bio: f.bio + emoji }));
      return;
    }
    const current = form.bio;
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
    setForm((f) => ({ ...f, bio: next }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const loadProfile = useCallback(() => {
    if (!user || !db) return;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        const d = snap.exists() ? snap.data() : {};
        const displayName = (d.displayName ?? user.displayName ?? "").toString().trim();
        const username = (d.username ?? "").toString().trim();
        const bio = (d.bio ?? "").toString().trim();
        const avatarUrl = (d.avatarUrl ?? user.photoURL ?? null) as string | null;
        setProfile({
          displayName,
          username,
          bio,
          avatarUrl,
        });
        setForm({ displayName, username, bio });
      })
      .catch(() => {
        setProfile({
          displayName: (user.displayName ?? "").toString().trim(),
          username: "",
          bio: "",
          avatarUrl: user.photoURL ?? null,
        });
        setForm({
          displayName: (user.displayName ?? "").toString().trim(),
          username: "",
          bio: "",
        });
      })
      .finally(() => setLoading(false));
  }, [user, db]);

  useEffect(() => {
    if (user && db) loadProfile();
    else if (!user) setLoading(false);
  }, [user, db, loadProfile]);

  useEffect(() => {
    if (!user || !db) {
      setHasStripeMembership(null);
      return;
    }
    let active = true;
    const uid = user.uid || "";
    const email = (user.email || "").trim().toLowerCase();
    const membersRef = collection(db, "members");

    const hasStripeLink = (data: Record<string, unknown> | undefined): boolean => {
      if (!data) return false;
      const customerId = String(data.stripeCustomerId ?? data.stripe_customer_id ?? "").trim();
      const subscriptionId = String(data.stripeSubscriptionId ?? data.stripe_subscription_id ?? "").trim();
      return !!customerId || !!subscriptionId;
    };

    (async () => {
      try {
        const checks: Promise<boolean>[] = [];
        if (uid) {
          checks.push(
            getDocs(query(membersRef, where("uid", "==", uid), limit(2))).then((snap) =>
              snap.docs.some((d) => hasStripeLink(d.data() as Record<string, unknown>))
            )
          );
          checks.push(
            getDocs(query(membersRef, where("userId", "==", uid), limit(2))).then((snap) =>
              snap.docs.some((d) => hasStripeLink(d.data() as Record<string, unknown>))
            )
          );
        }
        if (email) {
          checks.push(
            getDocs(query(membersRef, where("email", "==", email), limit(2))).then((snap) =>
              snap.docs.some((d) => hasStripeLink(d.data() as Record<string, unknown>))
            )
          );
        }

        let linked = false;
        for (const check of checks) {
          // eslint-disable-next-line no-await-in-loop
          if (await check) {
            linked = true;
            break;
          }
        }
        if (active) setHasStripeMembership(linked);
      } catch {
        if (active) setHasStripeMembership(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [db, user]);

  useEffect(() => {
    if (!bioEmojiOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (bioEmojiAnchorRef.current?.contains(target)) return;
      setBioEmojiOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [bioEmojiOpen]);

  const handleEdit = () => {
    if (profile) {
      setForm({
        displayName: profile.displayName,
        username: profile.username,
        bio: profile.bio,
      });
    }
    setEditing(true);
    setMessage(null);
  };

  const handleCancel = () => {
    setEditing(false);
    if (profile) {
      setForm({
        displayName: profile.displayName,
        username: profile.username,
        bio: profile.bio,
      });
    }
    setMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;
    const name = form.displayName.trim();
    const newUsername = form.username.trim().toLowerCase();
    const bio = form.bio.trim();
    if (!newUsername) {
      setMessage({ type: "error", text: "Username is required." });
      return;
    }
    setSaveLoading(true);
    setMessage(null);
    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const oldUsername = (snap.exists() ? (snap.data().username ?? "").toString() : "").toLowerCase();

      const updateData = { displayName: name, username: newUsername, bio, updatedAt: serverTimestamp() };
      if (newUsername === oldUsername) {
        await setDoc(userRef, updateData, { merge: true });
      } else {
        await runTransaction(db, async (tx) => {
          const usernameSnap = await tx.get(doc(db, "usernames", newUsername));
          if (usernameSnap.exists()) throw new Error("Username already in use.");
          tx.set(doc(db, "usernames", newUsername), { uid: user.uid, createdAt: serverTimestamp() });
          tx.set(userRef, { displayName: name, username: newUsername, bio, updatedAt: serverTimestamp() }, { merge: true });
          if (oldUsername) tx.delete(doc(db, "usernames", oldUsername));
        });
      }
      if (user.displayName !== name) {
        await updateProfile(user, { displayName: name });
      }
      setProfile({ ...profile!, displayName: name, username: newUsername, bio });
      setEditing(false);
      setMessage({ type: "success", text: "Profile updated." });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message || "Could not update profile." });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!confirm("You will be taken to Stripe to manage your subscription (update payment, view billing, cancel). Continue?")) return;
    if (!user) return;
    setPortalLoading(true);
    setMessage(null);
    let timeoutId: number | null = null;
    try {
      const returnUrl = typeof window !== "undefined" ? `${window.location.origin}/profile` : "/profile";
      const token = await user.getIdToken(true);
      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), 15000);
      const res = await fetch("/api/customer-portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ returnUrl, email: user.email || "", uid: user.uid || "" }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.assign(data.url);
      } else {
        const text = data.error || "Could not open subscription portal.";
        setMessage({ type: "error", text });
        alert(text);
      }
    } catch (err) {
      const message =
        err instanceof Error && err.name === "AbortError"
          ? "Stripe portal request timed out. Please try again."
          : (err as Error).message || "Could not open subscription portal.";
      setMessage({ type: "error", text: message });
      alert(message);
    } finally {
      if (timeoutId != null) window.clearTimeout(timeoutId);
      setPortalLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !auth) return;
    const { current, new: newPass, confirm } = passwordForm;
    if (!current.trim()) {
      setMessage({ type: "error", text: "Enter your current password." });
      return;
    }
    if (!PASSWORD_REQUIREMENTS.every((r) => r.test(newPass))) {
      setMessage({ type: "error", text: "New password does not meet all requirements." });
      return;
    }
    if (newPass !== confirm) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    setPasswordLoading(true);
    setMessage(null);
    try {
      const cred = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPass);
      setMessage({ type: "success", text: "Password updated." });
      setPasswordForm({ current: "", new: "", confirm: "" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: "error", text: getAuthErrorMessage(err, "Could not update password.") });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!user) {
    return (
      <main className="member-main profile-page">
        <div className="profile-page-inner">
          <h1>Profile</h1>
          <p className="profile-subtitle">Please sign in to view your profile.</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="member-main profile-page">
        <div className="profile-page-inner">
          <h1>Profile</h1>
          <p className="profile-subtitle">Loading…</p>
        </div>
      </main>
    );
  }

  const displayName = profile?.displayName ?? "";
  const email = user.email ?? "";
  const photoURL = profile?.avatarUrl ?? user.photoURL ?? null;
  const initial = displayName.trim()
    ? displayName.trim().charAt(0).toUpperCase()
    : email ? email.charAt(0).toUpperCase() : "?";
  const adminWithoutStripeMembership = isAdminEmail(user.email ?? null) && hasStripeMembership === false;

  return (
    <main className="member-main profile-page">
      <div className="profile-page-inner">
        <h1>Profile</h1>
        <p className="profile-subtitle">View and manage profile information.</p>

        {message && (
          <p className={`profile-message profile-message-${message.type}`} role="alert">
            {message.text}
          </p>
        )}

        <section className={`profile-card${editing ? " editing" : ""}`}>
          <h2>Profile Information</h2>
          <div className="profile-avatar-wrap-large">
            {photoURL ? (
              <img src={photoURL} alt="" className="profile-avatar-large" />
            ) : (
              <div className="profile-avatar-large-initials">{initial}</div>
            )}
          </div>

          <form className="profile-form" onSubmit={handleSave}>
            <label htmlFor="profile-name">Full Name</label>
            <input
              id="profile-name"
              type="text"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              disabled={!editing}
              placeholder="Your name"
              className="profile-input"
              autoComplete="name"
            />
            <label htmlFor="profile-username">Username</label>
            <input
              id="profile-username"
              type="text"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              disabled={!editing}
              placeholder="username"
              className="profile-input"
              autoComplete="username"
            />
            <label>Email</label>
            <p className="profile-email-readonly">{email}</p>
            <label htmlFor="profile-bio">Bio</label>
            <div className="profile-bio-emoji-anchor" ref={bioEmojiAnchorRef}>
              <textarea
                ref={bioRef}
                id="profile-bio"
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                disabled={!editing}
                placeholder="Write a short bio…"
                maxLength={500}
                className="profile-textarea profile-textarea-with-emoji"
                rows={4}
              />
            {editing && (
              <div className="profile-bio-emoji profile-bio-emoji-inline">
                <button
                  type="button"
                  className="profile-bio-emoji-trigger profile-bio-emoji-trigger-inline"
                  onClick={() => {
                    setBioEmojiOpen((o) => !o);
                    setBioEmojiQuery("");
                    setBioEmojiCategory("all");
                  }}
                  aria-label="Add emoji to bio"
                >
                  😀
                </button>
                {bioEmojiOpen && (
                  <div className="profile-bio-emoji-picker-wrap">
                    <input
                      type="text"
                      value={bioEmojiQuery}
                      onChange={(e) => setBioEmojiQuery(e.target.value)}
                      placeholder="Search emoji..."
                      className="profile-bio-emoji-search"
                    />
                    <div className="profile-bio-emoji-grid" role="dialog" aria-label="Pick emoji">
                      {visibleBioEmojis.length === 0 ? (
                        <p className="profile-bio-emoji-empty">No emoji found.</p>
                      ) : (
                        visibleBioEmojis.map((e, i) => (
                          <button
                            key={`${bioEmojiCategory}-${i}-${e}`}
                            type="button"
                            className="profile-bio-emoji-btn"
                            onClick={() => {
                              insertBioEmojiAtCursor(e);
                              setBioEmojiOpen(false);
                            }}
                            aria-label={`Emoji ${e}`}
                          >
                            {e}
                          </button>
                        ))
                      )}
                    </div>
                    <div className="profile-bio-emoji-category-bar" role="tablist" aria-label="Emoji categories">
                      {PROFILE_EMOJI_CATEGORY_ORDER.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`profile-bio-emoji-category-btn${bioEmojiCategory === c ? " active" : ""}`}
                          onClick={() => setBioEmojiCategory(c)}
                          aria-label={`Show ${c} emoji`}
                          title={c}
                        >
                          {PROFILE_EMOJI_CATEGORY_ICONS[c]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
            <div className="profile-form-actions">
              {!editing ? (
                <button type="button" className="btn btn-secondary btn-edit-profile" onClick={handleEdit}>
                  Edit
                </button>
              ) : (
                <div className="profile-edit-actions">
                  <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={saveLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saveLoading}>
                    {saveLoading ? "Saving…" : "Save changes"}
                  </button>
                </div>
              )}
            </div>
          </form>
        </section>

        <section className="profile-card profile-subscription-card">
          <h2>Subscription</h2>
          <p className="profile-subscription-desc">
            Manage your subscription, update payment method, or cancel anytime. You&apos;ll be taken to Stripe&apos;s secure portal.
          </p>
          {adminWithoutStripeMembership && (
            <p className="profile-subscription-desc" style={{ marginTop: "0.5rem" }}>
              This admin account is not linked to a Stripe membership, so there is no subscription portal to manage.
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary btn-manage-sub"
            onClick={handleManageSubscription}
            disabled={portalLoading || adminWithoutStripeMembership}
          >
            {portalLoading ? "…" : "Manage subscription"}
          </button>
        </section>

        <section className="profile-card profile-account-card">
          <h2>Account</h2>
          <p className="profile-account-desc">Change your password. You must enter your current password to confirm.</p>
          <p className="profile-account-desc" style={{ marginTop: "-0.5rem" }}>
            Legal:{" "}
            <a href="/privacy" style={{ textDecoration: "underline" }}>
              Privacy Policy
            </a>{" "}
            {" · "}
            <a href="/terms" style={{ textDecoration: "underline" }}>
              Terms of Service
            </a>
          </p>

          <div className="profile-account-collapsible">
            <button
              type="button"
              className={`profile-account-toggle${accountSectionOpen === "password" ? " active" : ""}`}
              onClick={() => setAccountSectionOpen((s) => (s === "password" ? null : "password"))}
              aria-expanded={accountSectionOpen === "password"}
            >
              Change password
            </button>
            {accountSectionOpen === "password" && (
              <form className="profile-form profile-password-form" onSubmit={handleChangePassword}>
                <label htmlFor="profile-current-password">Current password</label>
                <div className="profile-input-row">
                  <input
                    id="profile-current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))}
                    placeholder="Current password"
                    className="profile-input"
                    autoComplete="current-password"
                  />
                  <button type="button" className="profile-btn-show" onClick={() => setShowCurrentPassword((v) => !v)}>
                    {showCurrentPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <label htmlFor="profile-new-password">New password</label>
                <div className="profile-input-row">
                  <input
                    id="profile-new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, new: e.target.value }))}
                    placeholder="New password"
                    className="profile-input"
                    autoComplete="new-password"
                  />
                  <button type="button" className="profile-btn-show" onClick={() => setShowNewPassword((v) => !v)}>
                    {showNewPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className={"auth-password-reqs" + (passwordForm.new ? " visible" : "")}>
                  <ul>
                    {PASSWORD_REQUIREMENTS.map((r) => (
                      <li key={r.id} className={r.test(passwordForm.new) ? "met" : ""}>
                        <span className="req-icon" />
                        {r.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <label htmlFor="profile-confirm-password">Confirm new password</label>
                <div className="profile-input-row">
                  <input
                    id="profile-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                    placeholder="Confirm new password"
                    className="profile-input"
                    autoComplete="new-password"
                  />
                  <button type="button" className="profile-btn-show" onClick={() => setShowConfirmPassword((v) => !v)}>
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <button type="submit" className="btn btn-secondary" disabled={passwordLoading}>
                  {passwordLoading ? "Updating…" : "Update password"}
                </button>
              </form>
            )}
          </div>

        </section>
      </div>
    </main>
  );
}
