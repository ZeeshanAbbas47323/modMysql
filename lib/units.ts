import type { CanvasElement, Unit } from "./types";

export const CM_PER_INCH = 2.54;

/** Convert a length in inches to the given display unit. */
export function fromInches(valueIn: number, unit: Unit, dpi: number): number {
  switch (unit) {
    case "in":
      return valueIn;
    case "cm":
      return valueIn * CM_PER_INCH;
    case "px":
      return valueIn * dpi;
  }
}

/** Convert a length in the given display unit back to inches. */
export function toInches(value: number, unit: Unit, dpi: number): number {
  switch (unit) {
    case "in":
      return value;
    case "cm":
      return value / CM_PER_INCH;
    case "px":
      return value / dpi;
  }
}

export function formatLength(valueIn: number, unit: Unit, dpi: number): string {
  const v = fromInches(valueIn, unit, dpi);
  const decimals = unit === "px" ? 0 : 2;
  return `${v.toFixed(decimals)}${unit === "px" ? "px" : ` ${unit}`}`;
}

export interface AABB {
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
}

/** Axis-aligned bounding box of a (possibly rotated) element, in inches. */
export function elementAABB(el: CanvasElement): AABB {
  const rad = (el.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const halfW = (el.widthIn * cos + el.heightIn * sin) / 2;
  const halfH = (el.widthIn * sin + el.heightIn * cos) / 2;
  return {
    left: el.x - halfW,
    top: el.y - halfH,
    right: el.x + halfW,
    bottom: el.y + halfH,
    cx: el.x,
    cy: el.y,
    width: halfW * 2,
    height: halfH * 2,
  };
}

export function aabbsIntersect(a: AABB, b: AABB): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Find a placement CENTER for a boxW×boxH (inches) element on the sheet that
 * doesn't overlap any occupied box, scanning left→right then top→bottom on a
 * grid so items tile neatly. Returns null when nothing fits. `pad` keeps a small
 * gap between items; `margin` keeps clear of the sheet edges.
 */
export function findFreePlacement(
  sheetWidthIn: number,
  sheetHeightIn: number,
  boxW: number,
  boxH: number,
  occupied: AABB[],
  pad = 0.1,
  margin = 0.1
): { x: number; y: number } | null {
  const w = boxW + pad * 2;
  const h = boxH + pad * 2;
  if (w > sheetWidthIn - margin * 2 || h > sheetHeightIn - margin * 2) return null;
  const step = Math.max(0.25, Math.min(boxW, boxH) * 0.9);
  const maxTop = sheetHeightIn - margin - h;
  const maxLeft = sheetWidthIn - margin - w;
  for (let top = margin; top <= maxTop + 1e-6; top += step) {
    for (let left = margin; left <= maxLeft + 1e-6; left += step) {
      const cx = left + w / 2;
      const cy = top + h / 2;
      const candidate: AABB = {
        left,
        top,
        right: left + w,
        bottom: top + h,
        cx,
        cy,
        width: w,
        height: h,
      };
      if (!occupied.some((o) => aabbsIntersect(candidate, o))) {
        return { x: cx, y: cy };
      }
    }
  }
  return null;
}

/** Effective print DPI for an element given its source pixel width. */
export function effectiveDpi(naturalWidth: number, widthIn: number): number {
  if (widthIn <= 0) return 0;
  return naturalWidth / widthIn;
}

export const LOW_DPI_THRESHOLD = 150;
