import { eq } from "drizzle-orm";
import { createSession, isAdmin, verifyPassword } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { json, normalizeEmail } from "@/lib/server/http";
import { users } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return json({ error: "Invalid email or password." }, 400);

  const [user] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  // Always run a compare to avoid leaking which emails exist via timing.
  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidin");
  if (!user || !ok) return json({ error: "Invalid email or password." }, 401);
  if (user.status === "disabled") {
    return json({ error: "This account has been disabled. Contact an admin." }, 403);
  }

  await createSession({ uid: user.id, email: user.email });
  return json({ user: { email: user.email, name: user.name, admin: await isAdmin(user.email) } });
}
