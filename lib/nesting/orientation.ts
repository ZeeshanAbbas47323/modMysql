import { SkylineStrategy } from "./skyline";
import type {
  BinConfig,
  NestItem,
  NestPlacement,
  PackedResult,
} from "./types";

/**
 * Orientation policy for auto-arrangement.
 *
 * Placement always attempts horizontal (landscape) first — it generally gives
 * better roll coverage and shorter print lengths. Vertical (portrait) is only
 * chosen when packing the same items portrait-first is MEANINGFULLY denser,
 * not marginally better.
 */

export type OrientationTarget = "horizontal" | "vertical";

/**
 * Vertical placement must beat horizontal packing density by this margin
 * (absolute, 0..1) before it is chosen. A small difference is not worth
 * rotating everything away from the preferred landscape layout.
 */
export const VERTICAL_GAIN_THRESHOLD = 0.1;

/**
 * Normalize every item to the target orientation by swapping w/h where
 * needed. Squares (w === h) are untouched. Returns the id set that was
 * swapped so placements can be mapped back to the original artwork.
 */
export function orientItems(
  items: NestItem[],
  target: OrientationTarget
): { items: NestItem[]; swapped: Set<string> } {
  const swapped = new Set<string>();
  const oriented = items.map((i) => {
    if (Math.abs(i.w - i.h) < 1e-9) return i;
    const alreadyTarget = target === "horizontal" ? i.w > i.h : i.h > i.w;
    if (alreadyTarget) return i;
    swapped.add(i.id);
    return { ...i, w: i.h, h: i.w };
  });
  return { items: oriented, swapped };
}

/**
 * Re-express a pack of pre-oriented items relative to the ORIGINAL artwork:
 * an item we pre-swapped that the packer placed "unrotated" is in fact
 * rotated 90° on the sheet (and vice versa). Placement x/y/w/h already
 * describe the final on-sheet box, so only the flag flips.
 */
export function fixupRotation(
  result: PackedResult,
  swapped: Set<string>
): PackedResult {
  if (swapped.size === 0) return result;
  return {
    ...result,
    placements: result.placements.map((p) =>
      swapped.has(p.id) ? { ...p, rotated: !p.rotated } : p
    ),
  };
}

/**
 * Packing density of the strip the layout actually consumed: placed artwork
 * area ÷ (printable width × used height). Empty space inside the consumed
 * strip lowers the score; sheet area BELOW the pack is free for later designs
 * and is deliberately not penalized.
 */
export function packScore(result: PackedResult, bin: BinConfig): number {
  if (result.placements.length === 0) return 0;
  const innerW = bin.width - bin.margin * 2;
  let bottom = 0;
  for (const p of result.placements) bottom = Math.max(bottom, p.y + p.h);
  const usedH = Math.max(0, bottom - bin.margin);
  const envelope = innerW * usedH;
  return envelope > 0 ? Math.min(1, result.usedArea / envelope) : 0;
}

/**
 * Decide whether a vertical-first pack should replace the horizontal-first
 * one. Fitting more items always wins; otherwise vertical needs a
 * significant density improvement (VERTICAL_GAIN_THRESHOLD).
 */
export function verticalWins(
  horizontal: PackedResult,
  vertical: PackedResult,
  bin: BinConfig
): boolean {
  if (vertical.overflow.length !== horizontal.overflow.length) {
    return vertical.overflow.length < horizontal.overflow.length;
  }
  return packScore(vertical, bin) > packScore(horizontal, bin) + VERTICAL_GAIN_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Standalone reusable API
// ---------------------------------------------------------------------------

export interface OptimalPlacementInput {
  images: { id: string; width: number; height: number }[];
  availableWidth: number;
  availableHeight: number;
  /** Gap between images (same unit as the dimensions). */
  spacing: number;
  /** Inset from every edge. Default 0. */
  margin?: number;
}

export interface OptimalPlacementResult {
  orientation: OrientationTarget;
  positions: NestPlacement[];
  /** Ids that did not fit in the available area. */
  overflow: string[];
  /** Density of the chosen layout within its consumed strip, 0..1. */
  density: number;
}

/**
 * Reusable placement decision: pack the images horizontal-first, then
 * portrait-first, and keep vertical only when it is clearly denser.
 * A single image is always placed horizontally.
 */
export function calculateOptimalPlacement(
  input: OptimalPlacementInput
): OptimalPlacementResult {
  const bin: BinConfig = {
    width: input.availableWidth,
    height: input.availableHeight,
    spacing: Math.max(0, input.spacing),
    margin: Math.max(0, input.margin ?? 0),
    allowRotation: true,
    obstacles: [],
  };
  const items: NestItem[] = input.images.map((img) => ({
    id: img.id,
    w: img.width,
    h: img.height,
    hash: `${img.width.toFixed(3)}x${img.height.toFixed(3)}`,
  }));

  const strategy = new SkylineStrategy();
  const pass = (target: OrientationTarget) => {
    const o = orientItems(items, target);
    // tallest-first ordering, matching the engine's row/skyline heuristic
    const sorted = [...o.items].sort((a, b) => b.h - a.h || a.hash.localeCompare(b.hash));
    return fixupRotation(strategy.pack(sorted, bin), o.swapped);
  };

  const horizontal = pass("horizontal");
  if (items.length <= 1) {
    return {
      orientation: "horizontal",
      positions: horizontal.placements,
      overflow: horizontal.overflow,
      density: packScore(horizontal, bin),
    };
  }
  const vertical = pass("vertical");
  const useVertical = verticalWins(horizontal, vertical, bin);
  const chosen = useVertical ? vertical : horizontal;
  return {
    orientation: useVertical ? "vertical" : "horizontal",
    positions: chosen.placements,
    overflow: chosen.overflow,
    density: packScore(chosen, bin),
  };
}
