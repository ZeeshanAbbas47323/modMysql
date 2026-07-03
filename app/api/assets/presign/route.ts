import { getSession } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { presignPut } from "@/lib/server/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

// POST: hand the browser a presigned PUT URL so it can upload bytes straight to
// S3 (never through the app server). The key is always under the user's prefix.
// When an `assetId` is given (gallery re-saves after crop/bg-removal/etc.), the
// key is deterministic so the new bytes overwrite the old object instead of
// leaking an orphaned one.
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  console.log(session);
  
  if (!session) return json({ error: "Not signed in." }, 401);

  const b = await req.json().catch(() => ({}));
  const contentType = String(b.contentType ?? "");
  const ext = EXT[contentType];
  if (!ext) return json({ error: "Unsupported image type." }, 400);

  const name =
    typeof b.assetId === "string" && b.assetId ? b.assetId : globalThis.crypto.randomUUID();
  const key = `users/${session.uid}/${name}.${ext}`;
  return json({ s3Key: key, url: await presignPut(key, contentType) });
}
