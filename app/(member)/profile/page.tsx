"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getFirebaseDb, getFirebaseFunctions } from "../../../lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { updateProfile, updatePassword, updateEmail, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { getFirebaseAuth } from "../../../lib/firebase";
import { getAuthErrorMessage } from "../../../lib/auth-redirect";
import { httpsCallable } from "firebase/functions";

export default function ProfilePage() {
  const { user } = useAuth();
  const db = getFirebaseDb();
  const fbFunctions = getFirebaseFunctions();

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
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [emailForm, setEmailForm] = useState({ password: "", newEmail: "" });
  const [emailLoading, setEmailLoading] = useState(false);
  const auth = getFirebaseAuth();

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
    if (!fbFunctions) {
      setMessage({ type: "error", text: "Functions not configured." });
      return;
    }
    setPortalLoading(true);
    setMessage(null);
    try {
      const createPortal = httpsCallable<{ returnUrl?: string }, { url: string }>(fbFunctions, "createCustomerPortalSession");
      const returnUrl = typeof window !== "undefined" ? `${window.location.origin}/profile` : "/profile";
      const result = await createPortal({ returnUrl });
      if (result.data?.url) {
        window.location.href = result.data.url;
      } else {
        setMessage({ type: "error", text: "Could not open subscription portal." });
      }
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message || "Could not open subscription portal." });
    } finally {
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
    if (newPass.length < 8) {
      setMessage({ type: "error", text: "New password must be at least 8 characters." });
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

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !auth) return;
    const { password, newEmail } = emailForm;
    const trimmed = newEmail.trim().toLowerCase();
    if (!password) {
      setMessage({ type: "error", text: "Enter your current password." });
      return;
    }
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setMessage({ type: "error", text: "Enter a valid new email address." });
      return;
    }
    if (trimmed === user.email) {
      setMessage({ type: "error", text: "New email is the same as current." });
      return;
    }
    setEmailLoading(true);
    setMessage(null);
    try {
      const cred = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, cred);
      await updateEmail(user, trimmed);
      setMessage({ type: "success", text: "Email updated. Check your inbox to verify." });
      setEmailForm({ password: "", newEmail: "" });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ type: "error", text: getAuthErrorMessage(err, "Could not update email.") });
    } finally {
      setEmailLoading(false);
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
            <textarea
              id="profile-bio"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              disabled={!editing}
              placeholder="Write a short bio…"
              maxLength={500}
              className="profile-textarea"
              rows={4}
            />
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
          <button
            type="button"
            className="btn btn-primary btn-manage-sub"
            onClick={handleManageSubscription}
            disabled={portalLoading}
          >
            {portalLoading ? "…" : "Manage subscription"}
          </button>
        </section>

        <section className="profile-card profile-account-card">
          <h2>Account</h2>
          <p className="profile-account-desc">Change your password or email. You must enter your current password to confirm.</p>

          <form className="profile-form profile-password-form" onSubmit={handleChangePassword}>
            <h3 className="profile-account-subtitle">Change password</h3>
            <label htmlFor="profile-current-password">Current password</label>
            <input
              id="profile-current-password"
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))}
              placeholder="Current password"
              className="profile-input"
              autoComplete="current-password"
            />
            <label htmlFor="profile-new-password">New password</label>
            <input
              id="profile-new-password"
              type="password"
              value={passwordForm.new}
              onChange={(e) => setPasswordForm((f) => ({ ...f, new: e.target.value }))}
              placeholder="New password (min 8 characters)"
              className="profile-input"
              autoComplete="new-password"
            />
            <label htmlFor="profile-confirm-password">Confirm new password</label>
            <input
              id="profile-confirm-password"
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
              placeholder="Confirm new password"
              className="profile-input"
              autoComplete="new-password"
            />
            <button type="submit" className="btn btn-secondary" disabled={passwordLoading}>
              {passwordLoading ? "Updating…" : "Update password"}
            </button>
          </form>

          <form className="profile-form profile-email-form" onSubmit={handleChangeEmail}>
            <h3 className="profile-account-subtitle">Change email</h3>
            <label htmlFor="profile-email-password">Current password</label>
            <input
              id="profile-email-password"
              type="password"
              value={emailForm.password}
              onChange={(e) => setEmailForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Current password"
              className="profile-input"
              autoComplete="current-password"
            />
            <label htmlFor="profile-new-email">New email</label>
            <input
              id="profile-new-email"
              type="email"
              value={emailForm.newEmail}
              onChange={(e) => setEmailForm((f) => ({ ...f, newEmail: e.target.value }))}
              placeholder="New email address"
              className="profile-input"
              autoComplete="email"
            />
            <button type="submit" className="btn btn-secondary" disabled={emailLoading}>
              {emailLoading ? "Updating…" : "Update email"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
