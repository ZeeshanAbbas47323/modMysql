import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { fontsDir, FONT_CONTENT_TYPES } from "@/lib/server/localFonts";

export const runtime = "nodejs";

/** Streams a single custom font file from /Fonts (path-traversal safe). */
export async function GET(req: Request): Promise<Response> {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const safe = path.basename(name); // only a bare file name — block traversal
  const ext = path.extname(safe).toLowerCase();
  if (!safe || safe !== name || !FONT_CONTENT_TYPES[ext]) {
    return NextResponse.json({ error: "Invalid font name." }, { status: 400 });
  }
  try {
    const bytes = await readFile(path.join(fontsDir(), safe));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": FONT_CONTENT_TYPES[ext],
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Font not found." }, { status: 404 });
  }
}
