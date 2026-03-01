"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, setDoc, collection, getDocs, query, where, limit, updateDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "../../lib/firebase";

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      setError(null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const db = getFirebaseDb();
    const email = user?.email?.trim();
    if (!db || !user?.uid || !email) return;
    const emailLower = email.toLowerCase();
    setDoc(doc(db, "users", user.uid), { email_lower: emailLower }, { merge: true }).catch(() => {});

    // Sync member doc so members.uid = auth.uid for chat sessions and DMs
    getDocs(query(collection(db, "members"), where("email", "==", emailLower), limit(1)))
      .then((snap) => {
        if (snap.empty) return;
        const memberRef = snap.docs[0].ref;
        return updateDoc(memberRef, { uid: user.uid, userId: user.uid });
      })
      .catch(() => {});
  }, [user?.uid, user?.email]);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }, []);

  const value: AuthState = {
    user,
    loading,
    error,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      loading: false,
      error: null,
      signOut: async () => {},
    };
  }
  return ctx;
}
