import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { hashPassword } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { passwordResets, users } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { token, password } — consumes a reset token and sets a new password.
export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token) return json({ error: "Missing reset token." }, 400);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = getDb();
  const [reset] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, tokenHash), gt(passwordResets.expiresAt, new Date())))
    .limit(1);
  if (!reset) return json({ error: "This reset link is invalid or has expired." }, 400);

  const passwordHash = await hashPassword(password);
  await db.update(users).set({ passwordHash }).where(eq(users.id, reset.userId));
  await db.delete(passwordResets).where(eq(passwordResets.userId, reset.userId));

  return json({ ok: true });
}
