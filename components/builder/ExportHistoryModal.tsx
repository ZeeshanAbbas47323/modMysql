"use client";

import { useEffect, useMemo, useState } from "react";
import { useExport } from "@/hooks/useExport";
import {
  clearExportHistoryAll,
  formatExportDate,
  getExportHistory,
  type ExportRecord,
} from "@/lib/exportHistory";
import { SHEET_WIDTH_IN } from "@/lib/presets";
import { useBuilder } from "@/lib/store";
import { currentUserEmail, signOut } from "@/lib/auth-client";

// Export History — exports from the last 7 days with search, details, and
// one-click re-download (regenerated from the saved snapshot + current assets).
export default function ExportHistoryModal() {
  const show = useBuilder((s) => s.showExportHistory);
  const setShow = useBuilder((s) => s.setShowExportHistory);
  const setShowAuthModal = useBuilder((s) => s.setShowAuthModal);
  const jobs = useBuilder((s) => s.exportJobs);
  const { reDownload } = useExport();

  const [records, setRecords] = useState<ExportRecord[]>([]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // refresh the list (and signed-in user) when the panel opens / a job finishes
  useEffect(() => {
    if (!show) return;
    let active = true;
    getExportHistory().then((r) => active && setRecords(r));
    currentUserEmail().then((e) => active && setEmail(e));
    return () => {
      active = false;
    };
  }, [show, jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => r.name.toLowerCase().includes(q));
  }, [records, query]);

  if (!show) return null;

  const close = () => {
    setShow(false);
    setQuery("");
    setExpanded(null);
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Export history"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-surface-3 bg-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-3 px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-white">Export History</h2>
            <p className="text-xs text-gray-500">Exports from the last 7 days</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-gray-400 hover:bg-surface-3 hover:text-white"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* account bar */}
        <div className="flex items-center justify-between gap-2 border-b border-surface-3 bg-surface-2/40 px-3 py-2 text-xs">
          {email ? (
            <>
              <span className="truncate text-gray-300">
                Signed in as <span className="text-gray-100">{email}</span> · synced
              </span>
              <button
                type="button"
                onClick={() => void signOut().then(() => { setEmail(null); setRecords([]); })}
                className="shrink-0 rounded px-2 py-1 text-gray-400 hover:bg-surface-3 hover:text-white"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <span className="text-gray-400">
                Sign in to sync history across devices
              </span>
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="shrink-0 rounded bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-hover"
              >
                Sign in
              </button>
            </>
          )}
        </div>

        <div className="border-b border-surface-3 p-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by sheet name…"
            className="w-full rounded border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              {records.length === 0
                ? "No exports in the last 7 days yet."
                : "No exports match your search."}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => {
                const open = expanded === r.id;
                return (
                  <div
                    key={r.id}
                    className="rounded-lg border border-surface-3 bg-surface-2"
                  >
                    <div className="flex items-center gap-3 p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface-3 text-[10px] font-bold uppercase text-accent">
                        {r.format}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-100">{r.name}</p>
                        {r.orderId && (
                          <p className="truncate font-mono text-[10px] text-accent">{r.orderId}</p>
                        )}
                        <p className="text-[11px] text-gray-500">
                          {formatExportDate(r.createdAt)} ·{" "}
                          {r.sheetCount} sheet{r.sheetCount === 1 ? "" : "s"} ·{" "}
                          {r.itemCount} item{r.itemCount === 1 ? "" : "s"} · {r.dpi} DPI
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : r.id)}
                        className="rounded px-2 py-1 text-[11px] text-gray-400 hover:bg-surface-3 hover:text-white"
                      >
                        {open ? "Hide" : "Details"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void reDownload(r)}
                        className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></svg>
                        Re-download
                      </button>
                    </div>

                    {open && (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-surface-3 px-3 py-2.5 text-xs">
                        <Detail label="Order ID" value={r.orderId || "—"} />
                        <Detail label="Format" value={r.format.toUpperCase()} />
                        <Detail label="Resolution" value={`${r.dpi} DPI`} />
                        <Detail label="Width" value={`${SHEET_WIDTH_IN}″ (fixed)`} />
                        <Detail
                          label="Heights"
                          value={r.heights.map((h) => `${h}″`).join(", ")}
                        />
                        <Detail label="Sheets" value={`${r.sheetCount}`} />
                        <Detail label="Items" value={`${r.itemCount}`} />
                        <Detail
                          label="Background"
                          value={r.includeBackground ? "Included" : "Transparent"}
                        />
                        <Detail
                          label="Exported"
                          value={new Date(r.createdAt).toLocaleString()}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-surface-3 px-5 py-3">
          <span className="text-[11px] text-gray-500">
            {records.length} export{records.length === 1 ? "" : "s"} · re-download
            serves the exact stored file when available
          </span>
          {records.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Clear all export history?")) {
                  void clearExportHistoryAll().then(() => setRecords([]));
                }
              }}
              className="text-[11px] text-gray-400 hover:text-red-400"
            >
              Clear history
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="truncate text-right text-gray-200">{value}</span>
    </div>
  );
}
