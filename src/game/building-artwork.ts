import type { Cell, BuildingKind } from "../micro/world";

export const distinctStructures: Partial<Record<BuildingKind, number>> = {
  mill: 0,
  greenhouse: 1,
  market: 2,
  hall: 3,
};
// The farmhouse uses the farm atlas; the council office is a drawn placeholder.
export const distinctServices = {
  hive: undefined,
  seeds: 4,
  builder: 5,
  fields: 6,
  home: undefined,
  council: undefined,
} as const;
export const distinctBuildingRects = [
  [40, 20, 365, 410],
  [405, 55, 435, 380],
  [840, 70, 440, 370],
  [0, 431, 425, 405],
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
    x: Math.round((x * sourceWidth) / 1254),
    y: Math.round((y * sourceHeight) / 1254),
    width: Math.round((width * sourceWidth) / 1254),
    height: Math.round((height * sourceHeight) / 1254),
  };
}
type Lot = Cell & { width: number; height: number };
type Point = { x: number; y: number };
// Measured source pixels, using a single scale on both axes.
const atlasMetrics = {
  farm0: {
    bounds: [0.708984375, 1.716796875, 1.697265625, 2.75390625],
    ratio: 1,
  },
  farm1: {
    bounds: [0.69921875, 1.712890625, 1.755859375, 2.7421875],
    ratio: 1,
  },
  farm3: {
    bounds: [0.806640625, 1.869140625, 1.568359375, 2.576171875],
    ratio: 1,
  },
  farm4: {
    bounds: [0.822265625, 1.86328125, 1.521484375, 2.5859375],
    ratio: 1,
  },
  distinct0: {
    bounds: [
      0.9205479452054794, 1.9178082191780823, 1.9835616438356165,
      2.978082191780822,
    ],
    ratio: 1.1232876712328768,
  },
  distinct1: {
    bounds: [
      0.5908045977011495, 1.5402298850574712, 1.4045977011494253,
      2.367816091954023,
    ],
    ratio: 0.8735632183908046,
  },
  distinct2: {
    bounds: [
      0.5863636363636363, 1.518181818181818, 1.309090909090909,
      2.265909090909091,
    ],
    ratio: 0.8409090909090909,
  },
  distinct3: {
    bounds: [
      0.611764705882353, 1.628235294117647, 1.5905882352941176,
      2.6611764705882353,
    ],
    ratio: 0.9529411764705882,
  },
  distinct4: {
    bounds: [
      0.455421686746988, 1.5132530120481928, 1.2313253012048193,
      2.2265060240963854,
    ],
    ratio: 0.7951807228915663,
  },
  distinct5: {
    bounds: [
      0.5727272727272726, 1.6545454545454545, 1.2431818181818182,
      2.3477272727272727,
    ],
    ratio: 0.8181818181818182,
  },
  distinct6: {
    bounds: [
      0.5078947368421053, 1.6526315789473685, 1.1973684210526314,
      2.2578947368421054,
    ],
    ratio: 0.8157894736842105,
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
