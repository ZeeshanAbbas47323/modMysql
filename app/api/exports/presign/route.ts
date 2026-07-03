import { getSession } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { presignPut } from "@/lib/server/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: presigned PUT URL for one exported file, stored under the caller's own
// order folder so it can be re-downloaded byte-for-byte later.
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ error: "Not signed in." }, 401);

  const b = await req.json().catch(() => ({}));
  const orderId = typeof b.orderId === "string" ? b.orderId.replace(/[^a-zA-Z0-9-]/g, "") : "";
  const fileName = typeof b.fileName === "string" ? b.fileName.replace(/[/\\]/g, "_") : "";
  const contentType = typeof b.contentType === "string" ? b.contentType : "application/octet-stream";
  if (!orderId || !fileName) return json({ error: "orderId and fileName are required." }, 400);

  const prefix = `exports/${session.uid}/${orderId}`;
  const key = `${prefix}/${fileName}`;
  return json({ s3Key: key, prefix, url: await presignPut(key, contentType) });
}
