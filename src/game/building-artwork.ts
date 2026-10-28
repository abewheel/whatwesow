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
type Lot = Cell & { width: number; height: number };
type Point = { x: number; y: number };
// Measured source pixels, using a single scale on both axes.
const atlasMetrics = {
  farm0: { bounds: [0.70703, 1.7168, 1.70703, 2.77734], ratio: 1.0 },
  farm1: { bounds: [0.68555, 1.70117, 1.79102, 2.78516], ratio: 1.0 },
  farm3: { bounds: [0.80664, 1.86914, 1.56836, 2.57617], ratio: 1.0 },
  farm4: { bounds: [0.81055, 1.86328, 1.52148, 2.58594], ratio: 1.0 },
  distinct0: {
    bounds: [0.90223, 1.9162, 2.01955, 3.03911],
    ratio: 1.1229050279329609,
  },
  distinct1: {
    bounds: [0.50469, 1.52113, 1.42019, 2.43897],
    ratio: 0.8732394366197183,
  },
  distinct2: {
    bounds: [0.48956, 1.53596, 1.35035, 2.34571],
    ratio: 0.839907192575406,
  },
  distinct3: {
    bounds: [0.66499, 1.6801, 1.74055, 2.87657],
    ratio: 0.9874055415617129,
  },
  distinct4: {
    bounds: [0.34152, 1.33661, 1.44472, 2.34152],
    ratio: 0.7936117936117936,
  },
  distinct5: {
    bounds: [0.43619, 1.47564, 1.34107, 2.33179],
    ratio: 0.8190255220417634,
  },
  distinct6: {
    bounds: [0.39516, 1.4328, 1.31989, 2.40323],
    ratio: 0.8172043010752689,
  },
} as const;
export function buildingArtwork(lot: Lot, frame: number, distinct = false) {
  const key =
    `${distinct ? "distinct" : "farm"}${frame}` as keyof typeof atlasMetrics;
  const {
    bounds: [minRow, minCol, maxRow, maxCol],
    ratio,
  } = atlasMetrics[key];
  const inset = 0.08;
  const size = Math.min(
    (lot.width + lot.height) * 32 * 0.94,
    ((lot.height - inset * 2) * 64) / (maxRow - minRow),
    ((lot.width - inset * 2) * 64) / (maxCol - minCol),
  );
  return {
    row: lot.row + (lot.height - 1) / 2 - ((minRow + maxRow) * size) / 128,
    col: lot.col + (lot.width - 1) / 2 - ((minCol + maxCol) * size) / 128,
    size,
    height: size * ratio,
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
    point.y <= top.y + art.height &&
    row <= lot.height - 0.5 &&
    col <= lot.width - 0.5
  );
}
