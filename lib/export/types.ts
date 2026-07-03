import type { CanvasElement, LibraryAsset, SheetConfig } from "../types";

export interface ExportSettings {
  format: "png" | "pdf";
  dpi: number;
  /** PDF: draw registration/crop marks outside the trim box. */
  cropMarks: boolean;
  /** PDF: extend the page by the bleed allowance. */
  includeBleed: boolean;
  /**
   * Paint the sheet background colour into the file. Default false — the
   * background is a preview aid, production files stay transparent.
   */
  includeBackground: boolean;
  /** Mandatory sheet name, saved to export history. */
  name: string;
}

export interface ExportContext {
  elements: CanvasElement[];
  assets: LibraryAsset[];
  sheet: SheetConfig;
  /** Printed small + black at the top of the exported sheet, if set. */
  sheetName?: string;
}

export type ProgressCallback = (
  stage: "preparing" | "rendering" | "encoding",
  /** overall 0..100 */
  progress: number
) => void;

export class ExportError extends Error {
  constructor(
    message: string,
    public readonly suggestion?: string
  ) {
    super(message);
  }
}

export interface QualityIssue {
  severity: "error" | "warning";
  code:
    | "missing-asset"
    | "low-dpi"
    | "overlap"
    | "out-of-bounds"
    | "empty-sheet";
  message: string;
}
