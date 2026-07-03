import { readdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { fontsDir, FONT_FORMATS } from "@/lib/server/localFonts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always reflect the current folder

export interface LocalFont {
  family: string;
  file: string;
  /** CSS @font-face format() value. */
  format: string;
}

/**
 * Lists custom fonts found in /Fonts. The family name is the file name without
 * its extension; new files are picked up automatically on the next request.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const entries = await readdir(fontsDir());
    const fonts: LocalFont[] = [];
    const seen = new Set<string>();
    for (const file of entries.sort((a, b) => a.localeCompare(b))) {
      const ext = path.extname(file).toLowerCase();
      const format = FONT_FORMATS[ext];
      if (!format) continue;
      const family = file.slice(0, -ext.length).trim();
      if (!family || seen.has(family)) continue;
      seen.add(family);
      fonts.push({ family, file, format });
    }
    return NextResponse.json({ fonts });
  } catch {
    return NextResponse.json({ fonts: [] });
  }
}
