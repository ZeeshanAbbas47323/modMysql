"use client";

import { useEffect, useRef } from "react";
import { ensureFontLoaded, fetchLocalFonts } from "@/lib/fonts";
import { useBuilder } from "@/lib/store";
import { measureText } from "@/lib/text";
import type { TextElement } from "@/lib/types";

/**
 * Loads the fonts used by any text on any sheet (e.g. after restoring a saved
 * project that uses a catalog font), then re-measures the affected text on the
 * active sheet so Konva redraws it with the real font metrics.
 */
export function useFontPreload() {
  const sheets = useBuilder((s) => s.sheets);
  const ensured = useRef<Set<string>>(new Set());

  // inject custom-font @font-face rules once so they're available app-wide
  useEffect(() => {
    void fetchLocalFonts();
  }, []);

  useEffect(() => {
    const families = new Set<string>();
    for (const sh of sheets) {
      for (const el of sh.elements) {
        if (el.type === "text") families.add(el.fontFamily);
      }
    }
    for (const family of families) {
      if (ensured.current.has(family)) continue;
      ensured.current.add(family);
      void ensureFontLoaded(family).then(() => {
        const s = useBuilder.getState();
        const updates = s.elements
          .filter((e): e is TextElement => e.type === "text" && e.fontFamily === family)
          .map((e) => {
            const m = measureText(e);
            return { id: e.id, patch: { widthIn: m.widthIn, heightIn: m.heightIn } };
          });
        if (updates.length) s.updateElementsTransient(updates);
      });
    }
  }, [sheets]);
}
