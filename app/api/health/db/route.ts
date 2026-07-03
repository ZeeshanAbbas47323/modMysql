import type { RowDataPacket } from "mysql2/promise";
import { getPool, isDbConfigured } from "@/lib/server/db";
import { isS3Configured } from "@/lib/server/s3";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deploy self-test: run after deploying to confirm MySQL + S3 wiring.
//   GET /api/health/db  ->  { db: true, s3: true }
export async function GET(): Promise<Response> {
  const out: Record<string, unknown> = {
    dbConfigured: isDbConfigured(),
    s3Configured: isS3Configured(),
  };
  if (!isDbConfigured()) return json({ ...out, db: false, error: "DB env not set" }, 503);
  try {
    const [rows] = await getPool().query<RowDataPacket[]>("select 1 as ok");
    return json({ ...out, db: rows[0]?.ok === 1 });
  } catch (err) {
    return json(
      { ...out, db: false, error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
