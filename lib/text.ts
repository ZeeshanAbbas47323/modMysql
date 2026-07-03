import type { TextElement } from "./types";

export type FontProvider = "system" | "google";
export type FontCategory = "Sans Serif" | "Display" | "Script" | "Serif";

export interface FontDef {
  family: string;
  /** CSS stack used for rendering/measuring. */
  stack: string;
  provider: FontProvider;
  category: FontCategory;
  /** Google Fonts `family=` spec (incl. weights); only for Google fonts. */
  google?: string;
}

const sans = (family: string, google: string): FontDef => ({
  family,
  stack: `'${family}', sans-serif`,
  provider: "google",
  category: "Sans Serif",
  google,
});
const display = (family: string, google: string): FontDef => ({
  family,
  stack: `'${family}', sans-serif`,
  provider: "google",
  category: "Display",
  google,
});
const script = (family: string, google: string): FontDef => ({
  family,
  stack: `'${family}', cursive`,
  provider: "google",
  category: "Script",
  google,
});
const serif = (family: string, google: string): FontDef => ({
  family,
  stack: `'${family}', serif`,
  provider: "google",
  category: "Serif",
  google,
});

/** Built-in fonts (system + an expanded Google Fonts library). */
const BASE_FONTS: FontDef[] = [
  { family: "Arial", stack: "Arial, sans-serif", provider: "system", category: "Sans Serif" },
  { family: "Helvetica", stack: "Helvetica, Arial, sans-serif", provider: "system", category: "Sans Serif" },
  { family: "Impact", stack: "Impact, Haettenschweiler, sans-serif", provider: "system", category: "Display" },
  // Sans serif
  sans("Montserrat", "Montserrat:wght@400;500;600;700;800;900"),
  sans("Roboto", "Roboto:wght@400;500;700;900"),
  sans("Poppins", "Poppins:wght@400;500;600;700;800"),
  sans("Inter", "Inter:wght@400;500;600;700;800"),
  sans("Open Sans", "Open+Sans:wght@400;600;700;800"),
  sans("Lato", "Lato:wght@400;700;900"),
  sans("Nunito", "Nunito:wght@400;600;700;800"),
  sans("Work Sans", "Work+Sans:wght@400;500;600;700"),
  // Display / heavy
  display("Oswald", "Oswald:wght@400;500;600;700"),
  display("Bebas Neue", "Bebas+Neue"),
  display("Anton", "Anton"),
  display("Archivo Black", "Archivo+Black"),
  display("Teko", "Teko:wght@400;500;600;700"),
  display("Fjalla One", "Fjalla+One"),
  // Script / handwriting
  script("Pacifico", "Pacifico"),
  script("Dancing Script", "Dancing+Script:wght@400;600;700"),
  script("Caveat", "Caveat:wght@400;600;700"),
  script("Lobster", "Lobster"),
  script("Great Vibes", "Great+Vibes"),
  script("Satisfy", "Satisfy"),
  // Serif / slab
  serif("Playfair Display", "Playfair+Display:wght@400;600;700;800"),
  serif("Merriweather", "Merriweather:wght@400;700;900"),
  serif("Roboto Slab", "Roboto+Slab:wght@400;500;700"),
  serif("Bitter", "Bitter:wght@400;600;700"),
];

/** Always-available fonts (system + a curated free Google set). The full
 *  Google Fonts catalog is layered on top at runtime via the Web Fonts API. */
export const FONTS: FontDef[] = BASE_FONTS;

/** Curated fonts grouped by category, for the quick-pick section. */
export const FONT_GROUPS: { category: FontCategory; fonts: FontDef[] }[] = (() => {
  const order: FontCategory[] = ["Sans Serif", "Display", "Script", "Serif"];
  return order
    .map((category) => ({
      category,
      fonts: FONTS.filter((f) => f.category === category),
    }))
    .filter((g) => g.fonts.length > 0);
})();

export const DEFAULT_FONT = "Montserrat";

export function fontStack(family: string): string {
  return FONTS.find((f) => f.family === family)?.stack ?? `'${family}', sans-serif`;
}

/** Single Google Fonts stylesheet URL covering every Google web font (one request, display=swap). */
export function googleFontsHref(): string {
  const families = FONTS.filter((f) => f.provider === "google" && f.google).map(
    (f) => `family=${f.google}`
  );
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

const PT_PER_IN = 72;

let measureCtx: CanvasRenderingContext2D | null = null;
function ctx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  return measureCtx;
}

export interface TextMetrics {
  widthIn: number;
  heightIn: number;
}

/**
 * Measure a text element's physical bounding box in inches. Font size is in
 * points, so 1pt → 1/72in; we measure at `fontSize` CSS px and divide by 72.
 * Falls back to a width estimate when no DOM canvas is available (SSR).
 */
export function measureText(
  t: Pick<
    TextElement,
    "text" | "fontFamily" | "fontSize" | "fontWeight" | "italic" | "letterSpacing" | "lineHeight"
  >
): TextMetrics {
  const lines = (t.text || " ").split("\n");
  const lineHeightIn = (t.fontSize * t.lineHeight) / PT_PER_IN;
  const heightIn = Math.max(lineHeightIn * lines.length, lineHeightIn);

  const c = ctx();
  if (!c) {
    // rough average glyph width ≈ 0.55em when we can't measure
    const longest = Math.max(...lines.map((l) => l.length), 1);
    const widthIn = (longest * t.fontSize * 0.55 + (longest - 1) * t.letterSpacing) / PT_PER_IN;
    return { widthIn: Math.max(0.1, widthIn), heightIn };
  }

  const style = t.italic ? "italic " : "";
  c.font = `${style}${t.fontWeight} ${t.fontSize}px ${fontStack(t.fontFamily)}`;
  let maxW = 0;
  for (const line of lines) {
    let w = c.measureText(line).width;
    if (t.letterSpacing) w += Math.max(0, line.length - 1) * t.letterSpacing;
    maxW = Math.max(maxW, w);
  }
  return { widthIn: Math.max(0.1, maxW / PT_PER_IN), heightIn };
}
