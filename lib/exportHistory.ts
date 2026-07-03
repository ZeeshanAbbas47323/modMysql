import { currentUserEmail } from "./auth-client";
import { SHEET_WIDTH_IN } from "./presets";
import type { CanvasElement } from "./types";

// Lightweight, localStorage-backed log of recent exports. We store a small
// snapshot (per-sheet config + element geometry, no image bytes) so a previous
// export can be re-generated/re-downloaded from the current asset library —
// without bloating storage with multi-MB blobs.

const STORAGE_KEY = "gangsheet-export-history-v1";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // last 7 days
const MAX_RECORDS = 60;

export interface ExportSheetSnapshot {
  heightIn: number;
  /** Background colour at export time (null = transparent). */
  background: string | null;
  dpi: number;
  elements: CanvasElement[];
}

export interface ExportRecord {
  id: string;
  /** Unique human-readable order id (GS-YYYYMMDD-XXXX). */
  orderId: string;
  name: string;
  createdAt: number;
  format: "png" | "pdf";
  dpi: number;
  includeBackground: boolean;
  cropMarks: boolean;
  includeBleed: boolean;
  widthIn: number; // always 22.5
  heights: number[]; // per-sheet heights
  itemCount: number;
  sheetCount: number;
  snapshot: ExportSheetSnapshot[];
  /** Prefix in the "exports" S3 folder, if the files were stored. */
  storagePath?: string | null;
}

function read(): ExportRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ExportRecord[]) : [];
  } catch {
    return [];
  }
}

function write(records: ExportRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // quota — drop the oldest half and retry once
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(records.slice(0, Math.ceil(records.length / 2)))
      );
    } catch {
      /* give up silently */
    }
  }
}

/** Records from the last 7 days, newest first (also prunes expired ones). */
export function loadExportHistory(): ExportRecord[] {
  const cutoff = Date.now() - RETENTION_MS;
  const fresh = read()
    .filter((r) => r.createdAt >= cutoff)
    .sort((a, b) => b.createdAt - a.createdAt);
  return fresh;
}

export function addExportRecord(
  record: Omit<ExportRecord, "id" | "createdAt" | "widthIn">
): ExportRecord {
  const full: ExportRecord = {
    ...record,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    createdAt: Date.now(),
    widthIn: SHEET_WIDTH_IN,
  };
  const cutoff = Date.now() - RETENTION_MS;
  const next = [full, ...read().filter((r) => r.createdAt >= cutoff)].slice(
    0,
    MAX_RECORDS
  );
  write(next);
  return full;
}

export function clearExportHistory(): void {
  write([]);
}

export function formatExportDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Pluggable backend: MySQL (multi-user, when signed in) with a localStorage
// fallback. The UI calls the async functions below; they pick the right store
// at runtime.
// ---------------------------------------------------------------------------

/** True when history is backed by MySQL (a user is signed in). */
export async function usingRemoteHistory(): Promise<boolean> {
  return (await currentUserEmail()) !== null;
}

/** Load the last 7 days of exports from the active backend (newest first). */
export async function getExportHistory(): Promise<ExportRecord[]> {
  try {
    const res = await fetch("/api/exports", { cache: "no-store" });
    if (res.ok) {
      const { records } = (await res.json()) as { records: ExportRecord[] };
      return records;
    }
  } catch {
    /* fall through to local */
  }
  return loadExportHistory();
}

/** Persist an export to the active backend. */
export async function saveExportRecord(
  record: Omit<ExportRecord, "id" | "createdAt" | "widthIn">
): Promise<void> {
  try {
    const res = await fetch("/api/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (res.ok) return;
  } catch {
    /* fall through to local */
  }
  addExportRecord(record);
}

/** Clear history in the active backend. */
export async function clearExportHistoryAll(): Promise<void> {
  try {
    const res = await fetch("/api/exports", { method: "DELETE" });
    if (res.ok) return;
  } catch {
    /* fall through to local */
  }
  clearExportHistory();
}
