"use client";

import { useState } from "react";
import { useBuilder } from "@/lib/store";
import { login, signup } from "@/lib/auth-client";

// Email + password login. Signing in enables synced, per-user export history.
export default function AuthModal() {
  const show = useBuilder((s) => s.showAuthModal);
  const setShow = useBuilder((s) => s.setShowAuthModal);
  const pushToast = useBuilder((s) => s.pushToast);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!show) return null;

  const close = () => {
    setShow(false);
    setError(null);
    setPassword("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        const { error } = await login(email.trim(), password);
        if (error) setError(error);
        else {
          pushToast("success", "Signed in.");
          close();
        }
      } else {
        const { error } = await signup(email.trim(), password);
        if (error) setError(error);
        else {
          pushToast("success", "Account created and signed in.");
          close();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-surface-3 bg-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-3 px-5 py-3.5">
          <h2 className="text-base font-semibold text-white">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h2>
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-gray-400 hover:bg-surface-3 hover:text-white"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3 p-5">
          <p className="text-xs text-gray-500">
            Sign in to keep your export history synced across devices.
          </p>

          <div>
            <label className="mb-1 block text-xs text-gray-400">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-400">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent"
            />
          </div>

          {error && (
            <p className="rounded border border-red-500/40 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {busy
              ? "Working…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"));
              setError(null);
            }}
            className="w-full text-center text-xs text-gray-400 hover:text-accent"
          >
            {mode === "signin"
              ? "No account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
