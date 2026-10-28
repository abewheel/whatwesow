import { type AnimalKind, type Cell } from "../micro/world";

export const animalKinds = ["coop", "dairy", "sheepfold"] as const;
export const animalFrame = (kind: AnimalKind, season: string) =>
  Math.max(0, ["spring", "summer", "fall", "winter"].indexOf(season)) * 3 +
  animalKinds.indexOf(kind);
export const penFrameRects = Array.from(
  { length: 12 },
  (_, i) =>
    [
      (i % 3) * 418,
      Math.round((Math.floor(i / 3) * 1254) / 4),
      418,
      Math.round(((Math.floor(i / 3) + 1) * 1254) / 4) -
        Math.round((Math.floor(i / 3) * 1254) / 4),
    ] as const,
);
export const livestockFrames = [
  [141, 108, 197, 219],
  [473, 55, 327, 275],
  [911, 115, 266, 221],
  [141, 414, 205, 213],
  [470, 362, 341, 272],
  [912, 416, 278, 220],
  [137, 695, 208, 220],
  [470, 648, 345, 288],
  [911, 696, 273, 229],
  [140, 979, 207, 212],
  [471, 936, 342, 264],
  [913, 976, 277, 221],
] as const;
// Alpha envelopes across all four seasonal sprites, expressed in grid axes.
const envelopes = {
  coop: [0.12, 1.15, 1.12, 2.12],
  dairy: [0.12, 1.13, 1.13, 2.16],
  sheepfold: [0.14, 1.1, 1.16, 2.1],
} as const;
export function animalArtwork(
  lot: Cell & { kind: AnimalKind; width: number; height: number },
) {
  const [minRow, minCol, maxRow, maxCol] = envelopes[lot.kind];
  const size = Math.min(
    (lot.width + lot.height) * 32 * 0.94,
    ((lot.height - 0.24) * 64) / (maxRow - minRow),
    ((lot.width - 0.24) * 64) / (maxCol - minCol),
  );
  return {
    row: lot.row + (lot.height - 1) / 2 - ((minRow + maxRow) * size) / 128,
    col: lot.col + (lot.width - 1) / 2 - ((minCol + maxCol) * size) / 128,
    size,
    height: (size * 314) / 418,
  };
}
export function withinAnimalFront(
  point: { x: number; y: number },
  anchor: { x: number; y: number },
  width: number,
  height: number,
) {
  const row = (point.y - anchor.y) / 32 - (point.x - anchor.x) / 64;
  const col = (point.y - anchor.y) / 32 + (point.x - anchor.x) / 64;
  return row <= height - 0.5 && col <= width - 0.5;
}
