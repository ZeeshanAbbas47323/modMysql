import { requireAdminSession } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { listPrefix, presignGet } from "@/lib/server/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only: returns signed download URLs for every file in a stored export
 * folder (path = "exports/{user_id}/{order_id}"), for any user.
 */
export async function GET(req: Request): Promise<Response> {
  const admin = await requireAdminSession();
  if (!admin) return json({ error: "Not authorized." }, 403);

  const prefix = new URL(req.url).searchParams.get("path") ?? "";
  if (!prefix.startsWith("exports/") || prefix.includes("..")) {
    return json({ error: "Invalid path." }, 400);
  }

  const keys = await listPrefix(prefix);
  const files = await Promise.all(
    keys.map(async (key) => ({ name: key.split("/").pop() ?? key, url: await presignGet(key) }))
  );
  return json({ files });
}
