import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { json, normalizeEmail } from "@/lib/server/http";
import { passwordResets, users } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 60 * 60 * 1000; // 1 hour

// POST { email } — issues a reset token if the account exists. No email
// service is configured yet, so the token is only echoed back outside of
// production (and always logged server-side) until one is wired up; a real
// deployment should email `token` to the user instead of returning it.
export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "Enter a valid email address." }, 400);

  const db = getDb();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  // Always respond the same way to avoid leaking which emails have accounts.
  if (!user) return json({ ok: true });

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await db.insert(passwordResets).values({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  console.log(`[password-reset] token for ${email}: ${token}`);
  return json({ ok: true, ...(process.env.NODE_ENV !== "production" ? { token } : {}) });
}
