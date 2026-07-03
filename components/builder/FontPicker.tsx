"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildFontList,
  ensureFontLoaded,
  fetchFontCatalog,
  fetchLocalFonts,
  rememberWeights,
  type FontPickItem,
} from "@/lib/fonts";

const MAX_RESULTS = 80;

interface Props {
  value: string;
  /** Called after the chosen font has finished loading. */
  onChange: (family: string) => void;
}

/**
 * Searchable font picker backed by the full Google Fonts catalog (falls back to
 * the curated list when the Web Fonts API key isn't configured). The chosen
 * family is loaded before it's applied so the canvas renders it correctly.
 */
export default function FontPicker({ value, onChange }: Props) {
  const [list, setList] = useState<FontPickItem[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchFontCatalog(), fetchLocalFonts()]).then(([cat, local]) => {
      if (!active) return;
      rememberWeights(cat.fonts);
      setList(buildFontList(cat.fonts, local));
    });
    return () => {
      active = false;
    };
  }, []);

  // close on outside click / escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? list.filter((f) => f.family.toLowerCase().includes(q)) : list;
    return base.slice(0, MAX_RESULTS);
  }, [list, query]);

  const choose = async (family: string) => {
    setOpen(false);
    setQuery("");
    await ensureFontLoaded(family);
    onChange(family);
  };

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-1 rounded border border-surface-3 bg-surface-2 px-2 py-1.5 text-left text-xs text-gray-100 outline-none hover:border-gray-500 focus:border-accent"
        style={{ fontFamily: `'${value}'` }}
      >
        <span className="truncate">{value}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-gray-400"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-64 max-w-[80vw] overflow-hidden rounded-lg border border-surface-3 bg-surface-1 shadow-2xl">
          <div className="border-b border-surface-3 p-2">
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${list.length || ""} fonts…`}
              className="w-full rounded border border-surface-3 bg-surface-2 px-2 py-1.5 text-xs text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {results.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-gray-500">
                No fonts match “{query}”.
              </li>
            ) : (
              results.map((f) => (
                <li key={f.family}>
                  <button
                    type="button"
                    onMouseEnter={() => void ensureFontLoaded(f.family)}
                    onClick={() => void choose(f.family)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-3 ${
                      f.family === value ? "text-accent" : "text-gray-200"
                    }`}
                    style={{ fontFamily: `'${f.family}'` }}
                  >
                    <span className="truncate">{f.family}</span>
                    <span className="shrink-0 text-[9px] uppercase tracking-wide text-gray-600">
                      {f.category}
                    </span>
                  </button>
                </li>
              ))
            )}
            {query.trim() === "" && list.length > MAX_RESULTS && (
              <li className="px-3 py-2 text-center text-[10px] text-gray-600">
                Showing {MAX_RESULTS} of {list.length} — type to search them all
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
