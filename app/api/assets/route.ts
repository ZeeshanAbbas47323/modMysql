import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { gallery } from "@/lib/server/schema";
import { presignGet, publicUrl } from "@/lib/server/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: the signed-in user's gallery (cross-device, permanent). Each item gets a
// fresh short-TTL presigned URL for rendering/download.
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ error: "Not signed in." }, 401);

  const rows = await getDb()
    .select()
    .from(gallery)
    .where(eq(gallery.userId, session.uid))
    .orderBy(desc(gallery.createdAt));

  const items = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      name: r.originalName,
      mimeType: r.mimeType,
      naturalWidth: r.width,
      naturalHeight: r.height,
      sizeBytes: r.fileSize,
      dpi: r.dpi ?? undefined,
      bgRemoved: r.bgRemoved,
      upscaled: r.upscaled,
      cropped: r.cropped,
      textRemoved: r.textRemoved,
      createdAt: new Date(r.createdAt).getTime(),
      url: await presignGet(r.s3Key),
    }))
  );
  return json({ assets: items });
}

// POST: record/update a gallery row after the browser has uploaded bytes to S3
// via a presigned PUT. The s3Key must live under the caller's own prefix. Uses
// an upsert (by the client-generated asset id) so re-saving an edited asset
// (crop / bg-removal / rename) updates the same row instead of duplicating it.
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ error: "Not signed in." }, 401);

  const b = await req.json().catch(() => ({}));
  const prefix = `users/${session.uid}/`;
  if (typeof b.s3Key !== "string" || !b.s3Key.startsWith(prefix)) {
    return json({ error: "Invalid storage key." }, 400);
  }
  const id = typeof b.id === "string" && b.id ? b.id : crypto.randomUUID();
  const name = String(b.name ?? "Image").slice(0, 200);
  const fileName = b.s3Key.split("/").pop() ?? id;

  const values = {
    userId: session.uid,
    fileName,
    originalName: name,
    s3Key: b.s3Key,
    s3Url: publicUrl(b.s3Key),
    mimeType: String(b.mimeType ?? "image/png"),
    fileSize: Number(b.sizeBytes) || 0,
    width: Number(b.naturalWidth) || 0,
    height: Number(b.naturalHeight) || 0,
    dpi: b.dpi != null ? Number(b.dpi) : null,
    bgRemoved: Boolean(b.bgRemoved),
    upscaled: Boolean(b.upscaled),
    cropped: Boolean(b.cropped),
    textRemoved: Boolean(b.textRemoved),
  };

  await getDb()
    .insert(gallery)
    .values({ id, ...values })
    .onDuplicateKeyUpdate({ set: values });

  return json({ id, url: await presignGet(b.s3Key) }, 201);
}
