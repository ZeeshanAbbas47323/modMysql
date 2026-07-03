"use client";

import { useCallback } from "react";
import {
  saveExportRecord,
  type ExportRecord,
  type ExportSheetSnapshot,
} from "@/lib/exportHistory";
import { exportPdf } from "@/lib/export/pdf";
import { exportPng } from "@/lib/export/png";
import { ExportError, type ExportContext, type ExportSettings } from "@/lib/export/types";
import { uid } from "@/lib/id";
import { generateOrderId } from "@/lib/orderId";
import { DEFAULT_SHEET } from "@/lib/presets";
import { useBuilder } from "@/lib/store";
import { currentUserEmail } from "@/lib/auth-client";
import { signedUrlsForFolder, uploadExportFiles } from "@/lib/exportStorage";
import type { ExportJob, SheetConfig } from "@/lib/types";

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Download a (possibly cross-origin) URL as a file with the right name. */
async function downloadFromUrl(url: string, fileName: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  downloadBlob(await res.blob(), fileName);
}

/** Filesystem-safe slug from the user's sheet name. */
function slug(name: string): string {
  return (
    name
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "gangsheet"
  );
}

/** Export contexts for an explicit set of sheets. */
function contextsFromSnapshot(
  snapshot: ExportSheetSnapshot[],
  name: string
): ExportContext[] {
  const { assets } = useBuilder.getState();
  return snapshot.map((sh) => {
    const sheet: SheetConfig = {
      ...DEFAULT_SHEET,
      widthIn: DEFAULT_SHEET.widthIn,
      heightIn: sh.heightIn,
      dpi: sh.dpi as SheetConfig["dpi"],
      background: sh.background,
    };
    return { elements: sh.elements, assets, sheet, sheetName: snapshot.length > 1 ? `${name} ${snapshot.indexOf(sh) + 1}` : name };
  });
}

/**
 * Run the export for a set of contexts. Shared by a fresh export (all current
 * sheets) and a re-download from history.
 */
async function runForContexts(
  contexts: ExportContext[],
  settings: ExportSettings,
  jobLabel: string
): Promise<Blob[] | null> {
  const { upsertExportJob, removeExportJob, pushToast } = useBuilder.getState();
  const base = `${slug(settings.name)}-${settings.dpi}dpi`;
  const sheetCount = contexts.length;

  const job: ExportJob = {
    id: uid(),
    format: settings.format,
    dpi: settings.dpi,
    fileName: jobLabel,
    stage: "queued",
    progress: 0,
  };
  upsertExportJob(job);
  const onProgress = (stage: ExportJob["stage"], progress: number) =>
    upsertExportJob({ ...job, stage, progress: Math.round(progress) });

  try {
    const blobs: Blob[] = [];
    if (settings.format === "pdf") {
      const blob = await exportPdf(
        contexts,
        {
          dpi: settings.dpi,
          cropMarks: settings.cropMarks,
          includeBleed: settings.includeBleed,
          includeBackground: settings.includeBackground,
        },
        onProgress
      );
      blobs.push(blob);
      downloadBlob(blob, `${base}.pdf`);
    } else {
      for (let i = 0; i < contexts.length; i++) {
        const blob = await exportPng(
          contexts[i],
          settings.dpi,
          settings.includeBackground,
          (stage, p) => onProgress(stage, ((i + p / 100) / contexts.length) * 100)
        );
        blobs.push(blob);
        downloadBlob(blob, sheetCount > 1 ? `${base}-sheet-${i + 1}.png` : `${base}.png`);
      }
    }
    upsertExportJob({ ...job, stage: "done", progress: 100 });
    if (process.env.NODE_ENV === "development") {
      (window as unknown as { __lastExport?: object }).__lastExport = {
        blobs,
        format: settings.format,
        dpi: settings.dpi,
        sheets: sheetCount,
        name: settings.name,
        includeBackground: settings.includeBackground,
      };
    }
    pushToast(
      "success",
      `Exported “${settings.name}” — ${
        settings.format === "pdf"
          ? `${sheetCount}-page PDF`
          : `${sheetCount} PNG sheet${sheetCount === 1 ? "" : "s"}`
      }`
    );
    setTimeout(() => removeExportJob(job.id), 4000);
    return blobs;
  } catch (err) {
    const message =
      err instanceof ExportError
        ? `${err.message}${err.suggestion ? ` ${err.suggestion}` : ""}`
        : "Export failed unexpectedly.";
    upsertExportJob({ ...job, stage: "error", progress: 0, error: message });
    pushToast("error", message);
    setTimeout(() => removeExportJob(job.id), 8000);
    return null;
  }
}

export function useExport() {
  /** Fresh export of every sheet in the project + history record. */
  const runExport = useCallback(async (settings: ExportSettings) => {
    const { sheets, assets } = useBuilder.getState();
    const contexts: ExportContext[] = sheets.map((sh) => ({
      elements: sh.elements,
      assets,
      sheet: sh.config,
      sheetName: sh.name,
    }));
    const label =
      settings.format === "png" && contexts.length > 1
        ? `${contexts.length} PNG sheets`
        : `${slug(settings.name)}.${settings.format}`;

    const blobs = await runForContexts(contexts, settings, label);
    if (!blobs) return false;

    // upload the actual files to S3 when signed in (enables exact re-download
    // by the owner and by admins). Degrades gracefully to null.
    const orderId = generateOrderId();
    const base = `${slug(settings.name)}-${settings.dpi}dpi`;
    const files = blobs.map((blob, i) => ({
      name:
        settings.format === "pdf"
          ? `${base}.pdf`
          : blobs.length > 1
            ? `${base}-sheet-${i + 1}.png`
            : `${base}.png`,
      blob,
    }));
    const storagePath = await uploadExportFiles(files, orderId);
    // If signed in but the upload didn't land, the file won't be re-downloadable
    // and the admin Download button will be disabled — make that visible.
    if (!storagePath && (await currentUserEmail())) {
      useBuilder
        .getState()
        .pushToast(
          "error",
          "Saved to history, but uploading the file to storage failed. Check the S3 bucket + credentials."
        );
    }

    // record it in export history (snapshot enables regeneration as a fallback)
    const snapshot: ExportSheetSnapshot[] = sheets.map((sh) => ({
      heightIn: sh.config.heightIn,
      background: sh.config.background,
      dpi: sh.config.dpi,
      elements: sh.elements,
    }));
    void saveExportRecord({
      orderId,
      name: settings.name,
      format: settings.format,
      dpi: settings.dpi,
      includeBackground: settings.includeBackground,
      cropMarks: settings.cropMarks,
      includeBleed: settings.includeBleed,
      heights: sheets.map((sh) => sh.config.heightIn),
      itemCount: sheets.reduce(
        (n, sh) => n + sh.elements.filter((e) => e.visible).length,
        0
      ),
      sheetCount: sheets.length,
      snapshot,
      storagePath,
    });
    return true;
  }, []);

  const runBatch = useCallback(
    async (batch: ExportSettings[]) => {
      for (const settings of batch) await runExport(settings);
    },
    [runExport]
  );

  /**
   * Re-download a previous export. Prefer the EXACT files stored in S3 (so the
   * download matches the original byte-for-byte). Only fall back to
   * regenerating from the snapshot when no stored files are available (e.g.
   * the export predates storage, or the user is signed out / offline).
   */
  const reDownload = useCallback(async (record: ExportRecord) => {
    const { pushToast } = useBuilder.getState();
    if (record.storagePath) {
      try {
        const files = await signedUrlsForFolder(record.storagePath);
        if (files.length > 0) {
          for (const f of files) await downloadFromUrl(f.url, f.name);
          pushToast("success", `Downloaded “${record.name}”`);
          return;
        }
      } catch {
        // fall through to regeneration
      }
    }
    const contexts = contextsFromSnapshot(record.snapshot, record.name);
    await runForContexts(
      contexts,
      {
        format: record.format,
        dpi: record.dpi,
        cropMarks: record.cropMarks,
        includeBleed: record.includeBleed,
        includeBackground: record.includeBackground,
        name: record.name,
      },
      `${slug(record.name)}.${record.format}`
    );
  }, []);

  return { runExport, runBatch, reDownload };
}
