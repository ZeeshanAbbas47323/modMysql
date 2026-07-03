import { desc, eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { exportHistory, users } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only: returns every user's export history + shop statistics.
 */
export async function GET(): Promise<Response> {
  const admin = await requireAdminSession();
  if (!admin) return json({ error: "Not authorized." }, 403);

  const rows = await getDb()
    .select({
      id: exportHistory.id,
      userId: exportHistory.userId,
      userEmail: users.email,
      name: exportHistory.name,
      createdAt: exportHistory.createdAt,
      format: exportHistory.format,
      dpi: exportHistory.dpi,
      itemCount: exportHistory.itemCount,
      sheetCount: exportHistory.sheetCount,
      heights: exportHistory.heights,
      storagePath: exportHistory.storagePrefix,
    })
    .from(exportHistory)
    .leftJoin(users, eq(exportHistory.userId, users.id))
    .orderBy(desc(exportHistory.createdAt));

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const records = rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt).getTime() }));
  const stats = {
    totalExports: records.length,
    totalUsers: new Set(records.map((r) => r.userId)).size,
    totalItems: records.reduce((n, r) => n + (r.itemCount || 0), 0),
    totalSheets: records.reduce((n, r) => n + (r.sheetCount || 0), 0),
    last7Days: records.filter((r) => r.createdAt >= weekAgo).length,
    png: records.filter((r) => r.format === "png").length,
    pdf: records.filter((r) => r.format === "pdf").length,
  };

  return json({ admin: admin.email, stats, records });
}
