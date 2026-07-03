import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { users } from "@/lib/server/schema";
import { deleteObject, listPrefix } from "@/lib/server/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH: edit a user's name / role / status (enable-disable), admin-only.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const admin = await requireAdminSession();
  if (!admin) return json({ error: "Not authorized." }, 403);

  const db = getDb();
  const [target] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, params.id))
    .limit(1);
  if (!target) return json({ error: "Not found." }, 404);

  const b = await req.json().catch(() => ({}));
  const patch: Partial<typeof users.$inferInsert> = {};
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().slice(0, 200);
  if (b.role === "user" || b.role === "admin") {
    if (target.email === admin.email && b.role !== "admin") {
      return json({ error: "You can't remove your own admin access." }, 400);
    }
    patch.role = b.role;
  }
  if (b.status === "active" || b.status === "disabled") {
    if (target.email === admin.email && b.status !== "active") {
      return json({ error: "You can't disable your own account." }, 400);
    }
    patch.status = b.status;
  }
  if (Object.keys(patch).length === 0) return json({ error: "Nothing to update." }, 400);

  await db.update(users).set(patch).where(eq(users.id, params.id));
  return json({ ok: true });
}

// DELETE: remove a user (cascades their gallery + export history rows, and
// wipes their S3 objects so nothing is left behind), admin-only.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const admin = await requireAdminSession();
  if (!admin) return json({ error: "Not authorized." }, 403);

  const db = getDb();
  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, params.id))
    .limit(1);
  if (!target) return json({ error: "Not found." }, 404);
  if (target.email === admin.email) {
    return json({ error: "You can't delete your own account." }, 400);
  }

  await db.delete(users).where(eq(users.id, params.id));

  try {
    const keys = await Promise.all([
      listPrefix(`users/${params.id}/`),
      listPrefix(`exports/${params.id}/`),
    ]);
    await Promise.all(keys.flat().map((key) => deleteObject(key)));
  } catch {
    /* DB row is already gone; orphaned objects can be swept later */
  }

  return json({ ok: true });
}
