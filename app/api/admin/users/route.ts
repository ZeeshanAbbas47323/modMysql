import { desc, like, or } from "drizzle-orm";
import { requireAdminSession } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { users } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?q=search — list users (optionally filtered by name/email), admin-only.
export async function GET(req: Request): Promise<Response> {
  const admin = await requireAdminSession();
  if (!admin) return json({ error: "Not authorized." }, 403);

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(q ? or(like(users.name, `%${q}%`), like(users.email, `%${q}%`)) : undefined)
    .orderBy(desc(users.createdAt));

  return json({
    users: rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt).getTime() })),
  });
}
