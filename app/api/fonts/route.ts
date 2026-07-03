import { NextResponse } from "next/server";
import type { CatalogFont } from "@/lib/fonts";

export const runtime = "nodejs";
// Catalog rarely changes — cache the upstream response for a day.
export const revalidate = 86400;

interface GoogleItem {
  family: string;
  category: string;
  variants: string[];
}

let cache: { at: number; fonts: CatalogFont[] } | null = null;
const TTL_MS = 24 * 60 * 60 * 1000;

function toCatalog(items: GoogleItem[]): CatalogFont[] {
  return items.map((it) => {
    const weights = new Set<string>();
    let italic = false;
    for (const v of it.variants) {
      if (v.includes("italic")) italic = true;
      const w = v === "regular" ? "400" : v.replace("italic", "");
      if (/^\d+$/.test(w)) weights.add(w);
    }
    return {
      family: it.family,
      category: it.category,
      weights: weights.size ? [...weights].sort((a, b) => +a - +b) : ["400"],
      italic,
    };
  });
}

/**
 * Returns the full Google Fonts catalog (family + weights + category) using
 * the free Web Fonts Developer API. The key stays server-side. When no key is
 * configured the client falls back to the built-in curated list.
 */
export async function GET(): Promise<NextResponse> {
  const key = process.env.GOOGLE_FONTS_API_KEY;
  if (!key) {
    return NextResponse.json({ configured: false, fonts: [] });
  }
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ configured: true, fonts: cache.fonts });
  }
  try {
    const res = await fetch(
      `https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=${key}`,
      { next: { revalidate } }
    );
    if (!res.ok) {
      return NextResponse.json(
        { configured: true, fonts: [], error: `Google Fonts API error ${res.status}` },
        { status: 200 }
      );
    }
    const data = (await res.json()) as { items?: GoogleItem[] };
    const fonts = toCatalog(data.items ?? []);
    cache = { at: Date.now(), fonts };
    return NextResponse.json({ configured: true, fonts });
  } catch {
    return NextResponse.json(
      { configured: true, fonts: [], error: "Could not reach Google Fonts." },
      { status: 200 }
    );
  }
}
