import { NextResponse } from "next/server";

// Every data API route returns through this helper so responses are never
// cached by the browser or any intermediary — the permanent fix for the
// "new records don't appear until restart" class of bugs. Pair with
// `export const dynamic = "force-dynamic"` on each route.
export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}
