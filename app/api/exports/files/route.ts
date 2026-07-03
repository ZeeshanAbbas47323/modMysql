import { getSession } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { listPrefix, presignGet } from "@/lib/server/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?prefix=exports/{uid}/{orderId} — signed download URLs for every file in
// one of the caller's own stored export folders.
export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ error: "Not signed in." }, 401);

  const prefix = new URL(req.url).searchParams.get("prefix") ?? "";
  const ownPrefix = `exports/${session.uid}/`;
  if (!prefix.startsWith(ownPrefix) || prefix.includes("..")) {
    return json({ error: "Invalid path." }, 400);
  }

  const keys = await listPrefix(prefix);
  const files = await Promise.all(
    keys.map(async (key) => ({ name: key.split("/").pop() ?? key, url: await presignGet(key) }))
  );
  return json({ files });
}
