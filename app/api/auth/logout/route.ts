import { clearSession } from "@/lib/server/auth";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  clearSession();
  return json({ ok: true });
}
