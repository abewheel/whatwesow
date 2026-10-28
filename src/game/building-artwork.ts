import type { Cell, BuildingKind } from "../micro/world";

export const distinctStructures: Partial<Record<BuildingKind, number>> = {
  mill: 0,
  greenhouse: 1,
  market: 2,
  hall: 3,
};
export const distinctServices = {
  seeds: 4,
  builder: 5,
  fields: 6,
  home: undefined,
} as const;
export const distinctBuildingRects = [
  [40, 20, 365, 410],
  [405, 55, 435, 380],
  [840, 70, 440, 370],
  [0, 435, 405, 400],
  [425, 500, 415, 330],
  [840, 480, 440, 360],
  [20, 880, 380, 310],
  [395, 860, 445, 330],
  [840, 840, 440, 360],
] as const;
export function distinctBuildingRect(
  frame: number,
  sourceWidth: number,
  sourceHeight: number,
) {
  const [x, y, width, height] = distinctBuildingRects[frame];
  return {
    x: Math.round((x * sourceWidth) / 1280),
    y: Math.round((y * sourceHeight) / 1280),
    width: Math.round((width * sourceWidth) / 1280),
    height: Math.round((height * sourceHeight) / 1280),
  };
}
const distinctGroundBounds: Record<
  number,
  readonly [number, number, number, number]
> = {
  0: [0.695, 1.709, 1.796, 2.815],
  1: [0.718, 1.734, 1.642, 2.649],
  2: [0.759, 1.805, 1.608, 2.615],
  3: [0.686, 1.701, 1.764, 2.901],
  4: [0.689, 1.684, 1.821, 2.713],
  5: [0.74, 1.78, 1.638, 2.638],
  6: [0.703, 1.74, 1.629, 2.725],
};

type Lot = Cell & { width: number; height: number };
type Point = { x: number; y: number };
// Atlas coordinates in isometric axes: row = 2v-u, column = 2v+u.
// The lower ground apron (v >= .84) supplies the back bounds; all visible
// pixels supply the front bounds. These envelopes include every season and
// the construction atlas, so roofs may rise behind a lot but never spill in front.
const groundBounds: Record<number, readonly [number, number, number, number]> =
  {
    0: [0.706, 1.716, 1.708, 2.778],
    1: [0.685, 1.7, 1.792, 2.786],
    3: [0.806, 1.868, 1.569, 2.577],
    4: [0.81, 1.862, 1.522, 2.587],
  };

/** Square atlas placement with its ground apron inside the occupied cells. */
export function buildingArtwork(lot: Lot, frame: number, distinct = false) {
  const [minRow, minCol, maxRow, maxCol] = (
    distinct ? distinctGroundBounds : groundBounds
  )[frame];
  // Smaller utility buildings should not rival the barn or farmhouse.
  // Keep the same ground anchor for every season and construction state.
  const proportion = distinct
    ? [1, 0.92, 0.8, 1, 0.88, 0.9, 0.82][frame]
    : ({ 0: 1, 1: 1, 3: 0.62, 4: 0.78 }[frame] ?? 1);
  const inset = 0.08;
  const size =
    proportion *
    Math.min(
      (lot.width + lot.height) * 32 * 0.94,
      ((lot.height - inset * 2) * 64) / (maxRow - minRow),
      ((lot.width - inset * 2) * 64) / (maxCol - minCol),
    );
  return {
    row: lot.row + (lot.height - 1) / 2 - ((minRow + maxRow) * size) / 128,
    col: lot.col + (lot.width - 1) / 2 - ((minCol + maxCol) * size) / 128,
    size,
  };
}

/** Use the rendered position, excluding transparent space over front neighbors. */
export function hitsBuildingArtwork(
  point: Point,
  lot: Lot,
  frame: number,
  project: (cell: Cell) => Point,
  distinct = false,
) {
  const art = buildingArtwork(lot, frame, distinct);
  const top = project(art);
  const anchor = project(lot);
  const row = (point.y - anchor.y) / 32 - (point.x - anchor.x) / 64;
  const col = (point.y - anchor.y) / 32 + (point.x - anchor.x) / 64;
  return (
    point.x >= top.x &&
    point.x <= top.x + art.size &&
    point.y >= top.y &&
    point.y <= top.y + art.size &&
    row <= lot.height - 0.5 &&
    col <= lot.width - 0.5
  );
}
