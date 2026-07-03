import { FONTS } from "./text";

export interface CatalogFont {
  family: string;
  category: string;
  /** Available weights as numeric strings (e.g. ["400","700"]). */
  weights: string[];
  italic: boolean;
}

export interface LocalFont {
  family: string;
  file: string;
  /** CSS @font-face format() value. */
  format: string;
}

export interface FontPickItem {
  family: string;
  category: string;
  /** "system" / "custom" / "google-curated" / "google-catalog". */
  source: string;
}

const SYSTEM = new Set(
  FONTS.filter((f) => f.provider === "system").map((f) => f.family)
);
const CURATED = new Set(FONTS.map((f) => f.family));
const LOCAL = new Set<string>();

// ---- catalog fetch (one request, cached app-wide) -------------------------
let catalogPromise: Promise<{ configured: boolean; fonts: CatalogFont[] }> | null = null;

export function fetchFontCatalog(): Promise<{
  configured: boolean;
  fonts: CatalogFont[];
}> {
  if (!catalogPromise) {
    catalogPromise = fetch("/api/fonts")
      .then((r) => r.json())
      .catch(() => ({ configured: false, fonts: [] as CatalogFont[] }));
  }
  return catalogPromise;
}

// ---- custom local fonts (/Fonts folder, auto-detected) --------------------
let localPromise: Promise<LocalFont[]> | null = null;

/** Fetch the auto-detected custom fonts and inject their @font-face rules. */
export function fetchLocalFonts(): Promise<LocalFont[]> {
  if (!localPromise) {
    localPromise = fetch("/api/local-fonts")
      .then((r) => r.json())
      .then((d: { fonts: LocalFont[] }) => {
        const fonts = d.fonts ?? [];
        injectLocalFontFaces(fonts);
        for (const f of fonts) LOCAL.add(f.family);
        return fonts;
      })
      .catch(() => []);
  }
  return localPromise;
}

function injectLocalFontFaces(fonts: LocalFont[]): void {
  if (typeof document === "undefined" || fonts.length === 0) return;
  const id = "local-font-faces";
  const css = fonts
    .map(
      (f) =>
        `@font-face{font-family:'${f.family}';` +
        `src:url('/api/local-fonts/file?name=${encodeURIComponent(f.file)}') format('${f.format}');` +
        `font-display:swap;}`
    )
    .join("\n");
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    document.head.appendChild(style);
  }
  style.textContent = css;
}

/** Unified pick list: system, custom (local), then the Google catalog/curated. */
export function buildFontList(
  catalog: CatalogFont[],
  local: LocalFont[] = []
): FontPickItem[] {
  const systemItems: FontPickItem[] = FONTS.filter(
    (f) => f.provider === "system"
  ).map((f) => ({ family: f.family, category: "System", source: "system" }));

  const customItems: FontPickItem[] = local.map((f) => ({
    family: f.family,
    category: "Custom",
    source: "custom",
  }));

  if (catalog.length > 0) {
    const catalogItems = catalog.map((c) => ({
      family: c.family,
      category: capitalize(c.category),
      source: CURATED.has(c.family) ? "google-curated" : "google-catalog",
    }));
    return [...customItems, ...systemItems, ...catalogItems];
  }

  // fallback: curated google fonts only
  const curatedItems = FONTS.filter((f) => f.provider === "google").map((f) => ({
    family: f.family,
    category: f.category,
    source: "google-curated",
  }));
  return [...customItems, ...systemItems, ...curatedItems];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- lazy font loading ----------------------------------------------------
const requested = new Set<string>();
const catalogWeights = new Map<string, string[]>();

export function rememberWeights(catalog: CatalogFont[]): void {
  for (const c of catalog) catalogWeights.set(c.family, c.weights);
}

function cssHref(family: string, weights: string[]): string {
  const fam = family.replace(/ /g, "+");
  const w = weights.length ? `:wght@${weights.join(";")}` : "";
  return `https://fonts.googleapis.com/css2?family=${fam}${w}&display=swap`;
}

/**
 * Ensure a font family is loaded and ready for canvas rendering/measuring.
 * System + curated families are already loaded; catalog families get their
 * stylesheet injected on demand, then we await the actual face load.
 */
export async function ensureFontLoaded(family: string): Promise<void> {
  if (typeof document === "undefined") return;
  if (SYSTEM.has(family)) return;

  // custom fonts already have their @font-face injected — just await the load
  if (!LOCAL.has(family) && !CURATED.has(family) && !requested.has(family)) {
    requested.add(family);
    const weights = (catalogWeights.get(family) ?? ["400", "700"]).slice(0, 6);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref(family, weights.length ? weights : ["400", "700"]);
    document.head.appendChild(link);
  }

  try {
    await Promise.all([
      document.fonts.load(`400 16px "${family}"`),
      document.fonts.load(`700 16px "${family}"`),
    ]);
  } catch {
    /* font may lack a weight — ignore */
  }
}
