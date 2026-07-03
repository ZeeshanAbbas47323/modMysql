"use client";

// Client-side helpers for the custom MySQL-backed auth API. Sessions are an
// httpOnly cookie set by the server, so every call here is just a same-origin
// fetch — no tokens to manage on the client.

export interface CurrentUser {
  email: string;
  name: string;
  admin: boolean;
}

async function parse(res: Response): Promise<{ error: string | null; data: any }> {
  const data = await res.json().catch(() => ({}));
  return { error: res.ok ? null : (data.error ?? "Something went wrong."), data };
}

// Tiny in-page pub/sub so components (Toolbar, Gallery sync, History/Admin
// pages) can react to sign-in/out without polling — mirrors the previous
// Supabase `onAuthStateChange` subscription API.
type AuthListener = (email: string | null) => void;
const listeners = new Set<AuthListener>();

export function onAuthChange(cb: AuthListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emitAuthChange(email: string | null): void {
  for (const cb of listeners) cb(email);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  const { data } = await parse(res);
  return data.user ?? null;
}

export async function currentUserEmail(): Promise<string | null> {
  return (await getCurrentUser())?.email ?? null;
}

export async function login(email: string, password: string): Promise<{ error: string | null }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { error } = await parse(res);
  if (!error) emitAuthChange(email);
  return { error };
}

export async function signup(
  email: string,
  password: string,
  name?: string
): Promise<{ error: string | null }> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  const { error } = await parse(res);
  if (!error) emitAuthChange(email);
  return { error };
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
  emitAuthChange(null);
}
