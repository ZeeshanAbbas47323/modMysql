"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, onAuthChange } from "@/lib/auth-client";

/**
 * Tracks the signed-in user's email (or null). `configured` is always true —
 * auth is a first-class part of the app now, not an optional integration.
 */
export function useAuth() {
  const [email, setEmail] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      getCurrentUser().then((user) => {
        if (!active) return;
        setEmail(user?.email ?? null);
        setAdmin(user?.admin ?? false);
        setLoading(false);
      });
    void refresh();
    const unsub = onAuthChange(() => void refresh());
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { configured: true, email, admin, loading, signedIn: !!email };
}
