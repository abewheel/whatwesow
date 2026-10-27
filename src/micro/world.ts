import type { FarmPolicy } from "../contracts/farm-policy";
import { WORLD_SIZE } from "../contracts/world";
export { WORLD_SIZE } from "../contracts/world";
export type Cell = { row: number; col: number };
export const buildings = {
  home: {
    name: "Farmhouse",
    cost: 120,
    turn: 1,
    width: 3,
    height: 2,
    frame: 0,
    levels: 1,
    benefit: "Your home. Move it freely to make room",
    bonus: 0,
    income: 0,
  },
  shed: {
    name: "Tool shed",
    cost: 60,
    turn: 1,
    width: 2,
    height: 2,
    frame: 4,
    levels: 3,
    benefit: "Seeds cost 1 less per level",
    bonus: 0,
    income: 0,
  },
  oak: {
    name: "Oak tree",
    cost: 15,
    turn: 1,
    width: 1,
    height: 1,
    frame: 5,
    levels: 1,
    benefit: "A tree to make this place your own",
    bonus: 0,
    income: 0,
  },
  apple: {
    name: "Apple tree",
    cost: 60,
    turn: 5,
    width: 1,
    height: 1,
    frame: 2,
    levels: 3,
    benefit: "Harvest fruit for 6 coins per level each season",
    bonus: 0,
    income: 0,
  },
  well: {
    name: "Irrigation well",
    cost: 180,
    turn: 9,
    width: 2,
    height: 2,
    frame: 3,
    levels: 3,
    benefit: "1 extra grow step and +1 harvest coin per level",
    bonus: 1,
    income: 0,
  },
  barn: {
    name: "Harvest barn",
    cost: 600,
    turn: 25,
    width: 3,
    height: 2,
    frame: 1,
    levels: 3,
    benefit: "+2 coins per harvest per level",
    bonus: 2,
    income: 0,
  },
  mill: {
    name: "Grain mill",
    cost: 1800,
    turn: 49,
    width: 3,
    height: 3,
    frame: 1,
    levels: 3,
    benefit: "+15 coins per corn harvest per level",
    bonus: 0,
    income: 0,
  },
  greenhouse: {
    name: "Greenhouse",
    cost: 4500,
    turn: 81,
    width: 3,
    height: 2,
    frame: 0,
    levels: 3,
    benefit: "+8 coins per harvest per level",
    bonus: 8,
    income: 0,
  },
  market: {
    name: "Farm market",
    cost: 12000,
    turn: 121,
    width: 3,
    height: 3,
    frame: 4,
    levels: 3,
    benefit: "150 coins per level each new season",
    bonus: 0,
    income: 150,
  },
  hall: {
    name: "Legacy hall",
    cost: 25000,
    turn: 145,
    width: 3,
    height: 3,
    frame: 0,
    levels: 3,
    benefit: "+30 coins per harvest per level",
    bonus: 30,
    income: 0,
  },
} as const;
export type BuildingKind = keyof typeof buildings;
export type Structure = Cell & {
  id: number;
  kind: BuildingKind;
  level: number;
  pendingUpgrade?: true;
  pendingConstruction?: true;
  fruitReady?: boolean;
};
export type Layout = { plotCells: Cell[]; structures: Structure[] };
export const upgradeTurn = (
  kind: BuildingKind,
  level: number,
  policy: FarmPolicy = {},
) =>
  Math.min(
    160,
    (policy.unlockTurns?.[kind] ?? buildings[kind].turn) + level * 8,
    buildings[kind].turn === 145 && policy.unlockTurns?.[kind] === undefined
      ? 159
      : 160,
  );
export const upgradeCost = (structure: Structure) =>
  buildings[structure.kind].cost * (structure.level + 1);
export function initialPlotCells(count = 9): Cell[] {
  return Array.from({ length: 49 }, (_, i) => ({
    row: Math.floor(i / 7) + 13,
    col: (i % 7) + 13,
  }))
    .sort(
      (a, b) =>
        Math.max(Math.abs(a.row - 16), Math.abs(a.col - 16)) -
          Math.max(Math.abs(b.row - 16), Math.abs(b.col - 16)) ||
        a.row - b.row ||
        a.col - b.col,
    )
    .slice(0, count);
}
export const cellKey = (cell: Cell) => `${cell.row},${cell.col}`;
export function footprint(cell: Cell, width = 1, height = 1): Cell[] {
  return Array.from({ length: width * height }, (_, i) => ({
    row: cell.row + Math.floor(i / width),
    col: cell.col + (i % width),
  }));
}
export const inBounds = (cell: Cell) =>
  Number.isInteger(cell.row) &&
  Number.isInteger(cell.col) &&
  cell.row >= 0 &&
  cell.col >= 0 &&
  cell.row < WORLD_SIZE &&
  cell.col < WORLD_SIZE;
export function occupiedCells(layout: Layout): Set<string> {
  return new Set(
    [
      ...layout.plotCells,
      ...layout.structures.flatMap((s) =>
        footprint(s, buildings[s.kind].width, buildings[s.kind].height),
      ),
    ].map(cellKey),
  );
}
export const cellAllowed = (cell: Cell, policy: FarmPolicy = {}) =>
  inBounds(cell) &&
  (policy.land === undefined ||
    policy.land.some(
      (r) =>
        cell.row >= r.row &&
        cell.col >= r.col &&
        cell.row < r.row + r.height &&
        cell.col < r.col + r.width,
    ));
export const buildUnlock = (kind: BuildingKind, policy: FarmPolicy = {}) =>
  policy.unlockTurns?.[kind] ?? buildings[kind].turn;
export const policyCost = (cost: number, policy: FarmPolicy = {}) =>
  Math.ceil(cost * (policy.costMultiplier ?? 1));
export const policyProduction = (amount: number, policy: FarmPolicy = {}) =>
  Math.floor(amount * (policy.productionMultiplier ?? 1));
export function canPlace(
  layout: Layout,
  cell: Cell,
  width = 1,
  height = 1,
  policy: FarmPolicy = {},
): boolean {
  const occupied = occupiedCells(layout);
  return footprint(cell, width, height).every(
    (c) => cellAllowed(c, policy) && !occupied.has(cellKey(c)),
  );
}
export const buildingLevel = (layout: Layout, kind: BuildingKind) =>
  layout.structures
    .filter((s) => s.kind === kind && !s.pendingConstruction)
    .reduce((sum, s) => sum + s.level, 0);
export const seasonalIncome = (layout: Layout) =>
  layout.structures.reduce(
    (sum, s) =>
      sum + (s.pendingConstruction ? 0 : buildings[s.kind].income * s.level),
    0,
  );

export const isTree = (kind: BuildingKind) =>
  kind === "oak" || kind === "apple";

export const hasRipeFruit = (s: Structure) =>
  s.kind === "apple" && !s.pendingConstruction && s.fruitReady !== false;
