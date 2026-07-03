import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getDb } from "./db";
import { users } from "./schema";

// Custom email+password auth on MySQL. Sessions are stateless JWTs stored in
// an httpOnly cookie (no session table). Replaces Supabase Auth.

const COOKIE = "gs_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Missing required env var AUTH_SECRET");
  return new TextEncoder().encode(s);
}

export interface Session {
  uid: string;
  email: string;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Issue a session cookie. Only valid inside a Route Handler / Server Action. */
export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT({ email: session.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.uid)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/**
 * Secure cookies are dropped by browsers over plain HTTP, so a production
 * deploy without TLS in front (e.g. bare IP, no reverse-proxy HTTPS yet)
 * needs an explicit opt-out via COOKIE_SECURE=false. Defaults to on in
 * production, off otherwise.
 */
function isCookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  return process.env.NODE_ENV === "production";
}

export function clearSession(): void {
  cookies().set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Read + verify the current session, or null. Safe anywhere server-side. */
export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { uid: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

function adminAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Admin if email is in ADMIN_EMAILS (bootstrap) or the user's role is 'admin'. */
export async function isAdmin(email: string): Promise<boolean> {
  if (adminAllowlist().includes(email.toLowerCase())) return true;
  try {
    const rows = await getDb()
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return rows[0]?.role === "admin";
  } catch {
    return false; // db unreachable — fall back to allowlist only
  }
}

/** Resolve the admin session for a request, or null if not an admin. */
export async function requireAdminSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  return (await isAdmin(session.email)) ? session : null;
}
