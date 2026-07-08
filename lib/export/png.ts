import { SHEET_WIDTH_IN } from "../presets";
import { setPngBlobDpi } from "./pngDpi";
import { exportLargePng } from "./pngStream";
import {
  outputPixelSize,
  renderSheetToCanvas,
} from "./render";
import {
  ExportError,
  type ExportContext,
  type ProgressCallback,
} from "./types";

// Single-canvas limit: a band/canvas may be at most this tall/wide.
const MAX_CANVAS_SIDE = 16384;

/**
 * Export the sheet as a transparency-preserving PNG at exact physical
 * resolution (e.g. 22.5"×60" @300 DPI → 6750×18000 px).
 *
 * UPDATED: sheets too tall for a single browser canvas are rendered in
 * horizontal tiles and stream-encoded into one full-resolution PNG.
 */
export async function exportPng(
  ctx: ExportContext,
  dpi: number,
  includeBackground: boolean,
  onProgress?: ProgressCallback
): Promise<Blob> {
  // width is always the fixed 22.5" roll width
  const { width, height } = outputPixelSize(SHEET_WIDTH_IN, ctx.sheet.heightIn, dpi);
  if (width > MAX_CANVAS_SIDE || height > MAX_CANVAS_SIDE) {
    return exportLargePng(ctx, dpi, includeBackground, onProgress);
  }

  const canvas = await renderSheetToCanvas(ctx, dpi, includeBackground, onProgress);
  onProgress?.("encoding", 85);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  // release the (potentially huge) backing store promptly
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) {
    throw new ExportError(
      "PNG encoding failed — the image may be too large for this browser.",
      "Lower the export DPI."
    );
  }
  // Browser encoders omit the pHYs chunk (readers then assume 96 DPI) —
  // stamp the real print resolution into the metadata.
  const withDpi = await setPngBlobDpi(blob, dpi);
  onProgress?.("encoding", 100);
  return withDpi;
}
