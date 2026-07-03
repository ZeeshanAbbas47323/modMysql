"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useExport } from "@/hooks/useExport";
import {
  formatExportDate,
  getExportHistory,
  type ExportRecord,
} from "@/lib/exportHistory";
import { SHEET_WIDTH_IN } from "@/lib/presets";
import { currentUserEmail, login, onAuthChange, signOut } from "@/lib/auth-client";

// Per-user export history: a signed-in user sees their own exports from the
// last 7 days and can re-download the EXACT stored file (served from S3).
export default function HistoryPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    currentUserEmail().then((e) => {
      if (active) {
        setEmail(e);
        setReady(true);
      }
    });
    const unsub = onAuthChange((e) => active && setEmail(e));
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return (
    <main className="min-h-screen bg-surface-0 text-gray-100">
      <header className="flex items-center justify-between border-b border-surface-3 px-6 py-3.5">
        <div>
          <h1 className="text-base font-semibold text-white">My Export History</h1>
          <p className="text-xs text-gray-500">Your exports from the last 7 days</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/" className="text-gray-400 hover:text-white">
            ← Home
          </Link>
          <Link href="/builder" className="text-gray-400 hover:text-white">
            ← Builder
          </Link>
          {email && (
            <button
              type="button"
              onClick={() => void signOut().then(() => setEmail(null))}
              className="rounded px-2 py-1 text-gray-400 hover:bg-surface-3 hover:text-white"
            >
              Sign out ({email})
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-3xl p-6">
        {!ready ? (
          <p className="py-20 text-center text-sm text-gray-500">Loading…</p>
        ) : !email ? (
          <Login onSignedIn={setEmail} />
        ) : (
          <HistoryList signedIn={!!email} />
        )}
      </div>
    </main>
  );
}

function Login({ onSignedIn }: { onSignedIn: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await login(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
    else onSignedIn(email.trim());
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-sm space-y-3 rounded-xl border border-surface-3 bg-surface-1 p-6"
    >
      <h2 className="text-sm font-semibold text-white">Sign in to view your history</h2>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent"
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        className="w-full rounded border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function HistoryList({ signedIn }: { signedIn: boolean }) {
  const { reDownload } = useExport();
  const [records, setRecords] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getExportHistory().then((r) => {
      if (active) {
        setRecords(r);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [signedIn]);

  const download = useCallback(
    async (r: ExportRecord) => {
      setBusy(r.id);
      try {
        await reDownload(r);
      } finally {
        setBusy(null);
      }
    },
    [reDownload]
  );

  if (loading) return <p className="py-20 text-center text-sm text-gray-500">Loading…</p>;
  if (records.length === 0)
    return (
      <div className="mx-auto max-w-md rounded-lg border border-surface-3 bg-surface-1 p-6 text-center text-sm text-gray-400">
        No exports in the last 7 days yet.{" "}
        <Link href="/builder" className="text-accent hover:underline">
          Open the builder
        </Link>
        .
      </div>
    );

  return (
    <div className="space-y-2">
      {records.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-3 rounded-lg border border-surface-3 bg-surface-1 p-3"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface-3 text-[10px] font-bold uppercase text-accent">
            {r.format}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-100">{r.name}</p>
            {r.orderId && (
              <p className="truncate font-mono text-[10px] text-accent">{r.orderId}</p>
            )}
            <p className="text-[11px] text-gray-500">
              {formatExportDate(r.createdAt)} · {r.sheetCount} sheet
              {r.sheetCount === 1 ? "" : "s"} · {r.itemCount} item
              {r.itemCount === 1 ? "" : "s"} · {r.dpi} DPI · {SHEET_WIDTH_IN}″ wide
              {r.storagePath ? " · stored" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void download(r)}
            disabled={busy === r.id}
            className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {busy === r.id ? "Downloading…" : "Download"}
          </button>
        </div>
      ))}
    </div>
  );
}
