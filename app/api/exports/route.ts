import { and, desc, eq, gte } from "drizzle-orm";
import { getSession } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { exportHistory } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // last 7 days

// GET: the signed-in user's exports from the last 7 days, newest first.
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ error: "Not signed in." }, 401);

  const cutoff = new Date(Date.now() - RETENTION_MS);
  const rows = await getDb()
    .select()
    .from(exportHistory)
    .where(and(eq(exportHistory.userId, session.uid), gte(exportHistory.createdAt, cutoff)))
    .orderBy(desc(exportHistory.createdAt));

  const records = rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    name: r.name,
    createdAt: new Date(r.createdAt).getTime(),
    format: r.format,
    dpi: r.dpi,
    includeBackground: r.includeBackground,
    cropMarks: r.cropMarks,
    includeBleed: r.includeBleed,
    widthIn: Number(r.widthIn),
    heights: r.heights,
    itemCount: r.itemCount,
    sheetCount: r.sheetCount,
    snapshot: r.snapshot,
    storagePath: r.storagePrefix,
  }));
  return json({ records });
}

// POST: record a completed export.
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ error: "Not signed in." }, 401);

  const b = await req.json().catch(() => ({}));
  if (typeof b.orderId !== "string" || typeof b.name !== "string") {
    return json({ error: "Invalid export record." }, 400);
  }

  const id = crypto.randomUUID();
  await getDb()
    .insert(exportHistory)
    .values({
      id,
      userId: session.uid,
      orderId: b.orderId,
      name: String(b.name).slice(0, 255),
      format: b.format === "pdf" ? "pdf" : "png",
      dpi: Number(b.dpi) || 300,
      includeBackground: Boolean(b.includeBackground),
      cropMarks: Boolean(b.cropMarks),
      includeBleed: Boolean(b.includeBleed),
      heights: Array.isArray(b.heights) ? b.heights : [],
      itemCount: Number(b.itemCount) || 0,
      sheetCount: Number(b.sheetCount) || 0,
      storagePrefix: typeof b.storagePath === "string" ? b.storagePath : null,
      snapshot: Array.isArray(b.snapshot) ? b.snapshot : [],
    });
  return json({ id }, 201);
}

// DELETE: clear the signed-in user's export history.
export async function DELETE(): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ error: "Not signed in." }, 401);
  await getDb().delete(exportHistory).where(eq(exportHistory.userId, session.uid));
  return json({ ok: true });
}
