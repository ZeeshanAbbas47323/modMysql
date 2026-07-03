import path from "path";

/** Folder where users drop custom font files (project root /Fonts). */
export function fontsDir(): string {
  return path.join(process.cwd(), "Fonts");
}

/** Extension → CSS @font-face format() value. */
export const FONT_FORMATS: Record<string, string> = {
  ".ttf": "truetype",
  ".otf": "opentype",
  ".woff": "woff",
  ".woff2": "woff2",
};

/** Extension → HTTP content type. */
export const FONT_CONTENT_TYPES: Record<string, string> = {
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
