import { eq } from "drizzle-orm";
import { createSession, hashPassword } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { json, normalizeEmail } from "@/lib/server/http";
import { users } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 200)
      : (email ?? "").split("@")[0];
  if (!email) return json({ error: "Enter a valid email address." }, 400);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);

  const db = getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return json({ error: "An account with this email already exists." }, 409);
  }

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  await db.insert(users).values({ id, name, email, passwordHash });

  await createSession({ uid: id, email });
  return json({ user: { email, name } }, 201);
}
