"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { currentUserEmail, login, onAuthChange, signOut } from "@/lib/auth-client";

interface AdminRecord {
  id: string;
  userEmail: string | null;
  name: string;
  createdAt: number;
  format: string;
  dpi: number;
  itemCount: number;
  sheetCount: number;
  heights: number[];
  storagePath: string | null;
}

interface Stats {
  totalExports: number;
  totalUsers: number;
  totalItems: number;
  totalSheets: number;
  last7Days: number;
  png: number;
  pdf: number;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  createdAt: number;
}

export default function AdminPage() {
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
          <h1 className="text-base font-semibold text-white">Admin · Gangsheet Builder</h1>
          <p className="text-xs text-gray-500">Shop statistics, designs &amp; user management</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/" className="text-gray-400 hover:text-white">
            ← Home
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

      <div className="mx-auto max-w-5xl p-6">
        {!ready ? (
          <p className="py-20 text-center text-sm text-gray-500">Loading…</p>
        ) : !email ? (
          <AdminLogin onSignedIn={setEmail} />
        ) : (
          <Dashboard email={email} />
        )}
      </div>
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-surface-3 bg-surface-1 p-6 text-center text-sm text-gray-300">
      {children}
    </div>
  );
}

function AdminLogin({ onSignedIn }: { onSignedIn: (email: string) => void }) {
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
      <h2 className="text-sm font-semibold text-white">Admin sign in</h2>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="admin@example.com"
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

function Dashboard({ email }: { email: string }) {
  const [tab, setTab] = useState<"exports" | "users">("exports");
  const [stats, setStats] = useState<Stats | null>(null);
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/admin/exports", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!active) return;
      if (res.status === 403) setForbidden(true);
      else if (!res.ok) setError(data.error ?? "Failed to load.");
      else {
        setStats(data.stats);
        setRecords(data.records ?? []);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const download = useCallback(async (rec: AdminRecord) => {
    if (!rec.storagePath) {
      alert("No stored file for this export (it predates file storage).");
      return;
    }
    const res = await fetch(`/api/admin/download?path=${encodeURIComponent(rec.storagePath)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.files?.length) {
      alert(data.error ?? "No files found for this export.");
      return;
    }
    for (const f of data.files as { name: string; url: string }[]) {
      const a = document.createElement("a");
      a.href = f.url;
      a.download = f.name;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, []);

  const filtered = records.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) || (r.userEmail ?? "").toLowerCase().includes(q)
    );
  });

  if (loading) return <p className="py-20 text-center text-sm text-gray-500">Loading dashboard…</p>;
  if (forbidden)
    return (
      <Notice>
        <span className="text-amber-300">{email}</span> is not an admin account. Set its role to
        admin (<code className="text-gray-300">{"UPDATE users SET role=\"admin\" WHERE email=..."}</code>
        ) or add it to <code className="text-gray-300">ADMIN_EMAILS</code> and reload.
      </Notice>
    );
  if (error) return <Notice>{error}</Notice>;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-surface-3">
        <TabButton active={tab === "exports"} onClick={() => setTab("exports")}>
          Exports
        </TabButton>
        <TabButton active={tab === "users"} onClick={() => setTab("users")}>
          Users
        </TabButton>
      </div>

      {tab === "exports" ? (
        <>
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Shop statistics
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total designs" value={stats?.totalExports ?? 0} />
              <Stat label="Users" value={stats?.totalUsers ?? 0} />
              <Stat label="Images / items" value={stats?.totalItems ?? 0} />
              <Stat label="Sheets" value={stats?.totalSheets ?? 0} />
              <Stat label="Last 7 days" value={stats?.last7Days ?? 0} />
              <Stat label="PNG" value={stats?.png ?? 0} />
              <Stat label="PDF" value={stats?.pdf ?? 0} />
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Designs ({filtered.length})
              </h2>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or user…"
                className="w-56 rounded border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent"
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-surface-3">
              <table className="w-full text-xs">
                <thead className="bg-surface-2 text-left text-gray-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Sheet name</th>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">Items</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                        No designs yet.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => (
                      <tr key={r.id} className="border-t border-surface-3">
                        <td className="px-3 py-2 text-gray-100">{r.name}</td>
                        <td className="px-3 py-2 text-gray-400">{r.userEmail ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-400">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-gray-400 tabular-nums">
                          {r.format.toUpperCase()} · {r.dpi}DPI · {r.sheetCount} sht
                        </td>
                        <td className="px-3 py-2 tabular-nums text-gray-400">{r.itemCount}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => void download(r)}
                            disabled={!r.storagePath}
                            className="rounded bg-accent px-2.5 py-1 font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                            title={r.storagePath ? "Download files" : "No stored file"}
                          >
                            Download
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <UsersPanel currentEmail={email} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
        active
          ? "border-accent text-white"
          : "border-transparent text-gray-500 hover:text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

function UsersPanel({ currentEmail }: { currentEmail: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setUsers(data.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(query), 250);
    return () => clearTimeout(t);
  }, [query, load]);

  const patch = useCallback(
    async (id: string, body: Record<string, string>) => {
      setBusy(id);
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(data.error ?? "Update failed.");
      else await load(query);
      setBusy(null);
    },
    [load, query]
  );

  const remove = useCallback(
    async (id: string, email: string) => {
      if (!confirm(`Delete ${email}? This also deletes their gallery and export history.`)) return;
      setBusy(id);
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(data.error ?? "Delete failed.");
      else await load(query);
      setBusy(null);
    },
    [load, query]
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Users ({users.length})
        </h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email…"
          className="w-56 rounded border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent"
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-surface-3">
        <table className="w-full text-xs">
          <thead className="bg-surface-2 text-left text-gray-400">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Joined</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = u.email === currentEmail;
                return (
                  <tr key={u.id} className="border-t border-surface-3">
                    <td className="px-3 py-2 text-gray-100">{u.name}</td>
                    <td className="px-3 py-2 text-gray-400">{u.email}</td>
                    <td className="px-3 py-2">
                      <select
                        value={u.role}
                        disabled={isSelf || busy === u.id}
                        onChange={(e) => void patch(u.id, { role: e.target.value })}
                        className="rounded border border-surface-3 bg-surface-2 px-1.5 py-1 text-gray-100 outline-none disabled:opacity-50"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={u.status}
                        disabled={isSelf || busy === u.id}
                        onChange={(e) => void patch(u.id, { status: e.target.value })}
                        className="rounded border border-surface-3 bg-surface-2 px-1.5 py-1 text-gray-100 outline-none disabled:opacity-50"
                      >
                        <option value="active">active</option>
                        <option value="disabled">disabled</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-gray-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void remove(u.id, u.email)}
                        disabled={isSelf || busy === u.id}
                        className="rounded bg-red-600/80 px-2.5 py-1 font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 p-3">
      <p className="text-2xl font-semibold tabular-nums text-white">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}
