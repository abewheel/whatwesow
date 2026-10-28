/** Presentation layout only. Ownership, prices, and unlocks belong to micro rules. */
export const TILE_WIDTH = 36;
export const TILE_HEIGHT = 18;
export const FARM_SIZE = 18;
// Camera headroom keeps the top-corner honey tree reachable below phone controls.
export const WORLD_TOP = 384;

export function project(col: number, row: number) {
  return {
    x: ((col - row) * TILE_WIDTH) / 2,
    y: ((col + row) * TILE_HEIGHT) / 2,
  };
}

export type FarmObject = {
  id: string;
  name: string;
  frame: number;
  col: number;
  row: number;
  width: number;
  depth: number;
  kind: "building" | "tree";
};

// Every object has a grid anchor and footprint. No screen coordinates are stored.
export const farmObjects: readonly FarmObject[] = [
  {
    id: "home",
    name: "Farmhouse",
    frame: 0,
    col: 2,
    row: 2,
    width: 3,
    depth: 3,
    kind: "building",
  },
  {
    id: "barn",
    name: "Barn",
    frame: 1,
    col: 10,
    row: 1,
    width: 3,
    depth: 3,
    kind: "building",
  },
  {
    id: "shed",
    name: "Garden shed",
    frame: 4,
    col: 1,
    row: 9,
    width: 2,
    depth: 2,
    kind: "building",
  },
  {
    id: "well",
    name: "Well",
    frame: 3,
    col: 14,
    row: 8,
    width: 1,
    depth: 1,
    kind: "building",
  },
  {
    id: "apple-1",
    name: "Apple tree",
    frame: 2,
    col: 14,
    row: 2,
    width: 2,
    depth: 2,
    kind: "tree",
  },
  {
    id: "apple-2",
    name: "Apple tree",
    frame: 2,
    col: 15,
    row: 6,
    width: 2,
    depth: 2,
    kind: "tree",
  },
  {
    id: "cherry-1",
    name: "Flowering tree",
    frame: 5,
    col: 1,
    row: 6,
    width: 2,
    depth: 2,
    kind: "tree",
  },
  {
    id: "cherry-2",
    name: "Flowering tree",
    frame: 5,
    col: 3,
    row: 13,
    width: 2,
    depth: 2,
    kind: "tree",
  },
];

export const cropArea = { col: 6, row: 6, width: 7, depth: 7 };
export const gardenArea = { col: 14, row: 11, width: 2, depth: 3 };

export function footprint(object: {
  col: number;
  row: number;
  width: number;
  depth: number;
}) {
  return [
    project(object.col, object.row),
    project(object.col + object.width, object.row),
    project(object.col + object.width, object.row + object.depth),
    project(object.col, object.row + object.depth),
  ];
}
