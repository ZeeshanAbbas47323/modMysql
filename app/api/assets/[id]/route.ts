import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { gallery } from "@/lib/server/schema";
import { deleteObject } from "@/lib/server/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH: rename one of the caller's gallery assets (metadata only, no re-upload).
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ error: "Not signed in." }, 401);

  const b = await req.json().catch(() => ({}));
  if (typeof b.name !== "string" || !b.name.trim()) {
    return json({ error: "Invalid name." }, 400);
  }

  const db = getDb();
  const [row] = await db
    .select({ id: gallery.id })
    .from(gallery)
    .where(and(eq(gallery.id, params.id), eq(gallery.userId, session.uid)))
    .limit(1);
  if (!row) return json({ error: "Not found." }, 404);

  await db
    .update(gallery)
    .set({ originalName: b.name.trim().slice(0, 200) })
    .where(and(eq(gallery.id, params.id), eq(gallery.userId, session.uid)));
  return json({ ok: true });
}

// DELETE one of the caller's gallery assets (row + S3 object).
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ error: "Not signed in." }, 401);

  const db = getDb();
  const [row] = await db
    .select({ s3Key: gallery.s3Key })
    .from(gallery)
    .where(and(eq(gallery.id, params.id), eq(gallery.userId, session.uid)))
    .limit(1);
  if (!row) return json({ error: "Not found." }, 404);

  await db
    .delete(gallery)
    .where(and(eq(gallery.id, params.id), eq(gallery.userId, session.uid)));

  try {
    await deleteObject(row.s3Key);
  } catch {
    /* row already gone; ignore orphaned object */
  }
  return json({ ok: true });
}
