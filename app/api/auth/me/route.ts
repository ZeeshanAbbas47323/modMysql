import { eq } from "drizzle-orm";
import { getSession, isAdmin } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { users } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ user: null });

  const [row] = await getDb()
    .select({ name: users.name, status: users.status })
    .from(users)
    .where(eq(users.email, session.email))
    .limit(1);
  if (!row || row.status === "disabled") return json({ user: null });

  return json({
    user: { email: session.email, name: row.name, admin: await isAdmin(session.email) },
  });
}
