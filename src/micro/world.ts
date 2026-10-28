import type { FarmPolicy } from "../contracts/farm-policy";
import { WORLD_SIZE } from "../contracts/world";
export { WORLD_SIZE } from "../contracts/world";
export type Cell = { row: number; col: number };
export const buildings = {
  home: {
    name: "Farmhouse",
    cost: 120,
    width: 3,
    height: 2,
    frame: 0,
    levels: 1,
    benefit: "Your home. Move it freely to make room",
    bonus: 0,
    income: 0,
  },
  shed: {
    name: "Seed storehouse",
    cost: 60,
    width: 2,
    height: 2,
    frame: 4,
    levels: 3,
    benefit: "Bulk seed storage: seeds cost 1 less per level",
    bonus: 0,
    income: 0,
  },
  oak: {
    name: "Oak tree",
    cost: 15,
    width: 1,
    height: 1,
    frame: 5,
    levels: 1,
    benefit: "Matures in 10 years; harvest acorns each fall",
    bonus: 0,
    income: 0,
  },
  apple: {
    name: "Apple tree",
    cost: 60,
    width: 1,
    height: 1,
    frame: 2,
    levels: 3,
    benefit: "First apples after 3 years; harvest each fall",
    bonus: 0,
    income: 0,
  },
  well: {
    name: "Irrigation well",
    cost: 180,
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
    cost: 2400,
    width: 3,
    height: 2,
    frame: 0,
    levels: 3,
    benefit: "+10 coins per harvest per level",
    bonus: 10,
    income: 0,
  },
  market: {
    name: "Farm market",
    cost: 3000,
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
    cost: 10000,
    width: 3,
    height: 3,
    frame: 0,
    levels: 3,
    benefit: "+50 coins per harvest per level",
    bonus: 50,
    income: 0,
  },
} as const;
export type BuildingKind = keyof typeof buildings;

export type Structure = Cell & {
  id: number;
  kind: BuildingKind;
  level: number;
  harvestsAtLevel?: number;
  pendingUpgrade?: true;
  pendingConstruction?: true;
  /** Seasons of permit delay left before pending work can complete. */
  wait?: number;
  fruitReady?: boolean;
  age?: number;
  product?: boolean;
};
// The first camp provides services until the farmhouse is complete.
export const services = [
  {
    id: "home",
    name: "Farmhouse office",
    row: 7,
    col: 24,
    width: 2,
    height: 2,
    frame: 0,
  },
  {
    id: "seeds",
    name: "Seed shop & nursery",
    row: 7,
    col: 14,
    width: 2,
    height: 2,
    frame: 4,
  },
  {
    id: "builder",
    name: "Builder's workshop",
    row: 7,
    col: 19,
    width: 2,
    height: 2,
    frame: 1,
  },
  {
    id: "fields",
    name: "Field shed",
    row: 11,
    col: 9,
    width: 2,
    height: 2,
    frame: 4,
  },
] as const;
// West of the seed shop; shown only while planting permits are required.
export const councilOffice = {
  id: "council",
  name: "Council office",
  row: 7,
  col: 9,
  width: 2,
  height: 2,
  frame: 0,
} as const;
const allServices = [...services, councilOffice];
type Service = (typeof allServices)[number];
export type ServiceLocation<S extends Service = Service> = Omit<
  S,
  "name" | "row" | "col"
> &
  Cell & { name: string; tent: boolean };
export type ServiceOptions = { council?: boolean };
export type Layout = {
  selfBuilt?: true;
  plotCells: Cell[];
  structures: Structure[];
};
/** More facilities of the same kind cost more; upgrading saves land. */
export function constructionCost(layout: Layout, kind: BuildingKind) {
  const levels = layout.structures
    .filter((s) => s.kind === kind)
    .reduce((sum, s) => sum + s.level + (s.pendingUpgrade ? 1 : 0), 0);
  return (
    buildings[kind].cost * (isTree(kind) || kind === "home" ? 1 : 1 + levels)
  );
}
/** Keep village lots clear of existing farms when loading an older layout. */
export function serviceLocations(
  layout: Layout,
): ServiceLocation<(typeof services)[number]>[];
export function serviceLocations(
  layout: Layout,
  options: ServiceOptions,
): ServiceLocation[];
export function serviceLocations(
  layout: Layout,
  options: ServiceOptions = {},
): ServiceLocation[] {
  const used = new Set(
    [
      ...layout.plotCells,
      ...layout.structures.flatMap((s) =>
        footprint(s, buildings[s.kind].width, buildings[s.kind].height),
      ),
    ].map(cellKey),
  );
  const settled = layout.structures.some(
    (s) => s.kind === "home" && !s.pendingConstruction,
  );
  return allServices
    .filter((s) => s.id !== "council" || options.council)
    .filter(
      (s) =>
        s.id === "council" ||
        !layout.selfBuilt ||
        (!settled && s.id === "home"),
    )
    .filter((service) => service.id !== "home" || !settled)
    .map((service) => {
      const tent = service.id === "home" && !!layout.selfBuilt && !settled;
      const candidates = [
        ...(tent ? [{ row: 11, col: 14 }] : []),
        service,
        ...Array.from({ length: WORLD_SIZE * WORLD_SIZE }, (_, i) => ({
          row: Math.floor(i / WORLD_SIZE),
          col: i % WORLD_SIZE,
        })),
      ];
      const cell = candidates.find((c) =>
        footprint(c, service.width, service.height).every(
          (p) => inBounds(p) && !used.has(cellKey(p)),
        ),
      ) ?? {
        row: -2,
        col: 9 + allServices.findIndex((s) => s.id === service.id) * 5,
      };
      for (const p of footprint(cell, service.width, service.height))
        used.add(cellKey(p));
      return {
        ...service,
        ...cell,
        name: tent ? "Your tent" : service.name,
        tent,
      };
    });
}
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
export function occupiedCells(
  layout: Layout,
  options: ServiceOptions = {},
): Set<string> {
  return new Set(
    [
      ...serviceLocations(layout, options).flatMap((s) =>
        footprint(s, s.width, s.height),
      ),
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
    )) &&
  !policy.takenCells?.some((c) => c.row === cell.row && c.col === cell.col);
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
  const occupied = occupiedCells(layout, {
    council: policy.permitsRequired === true,
  });
  return footprint(cell, width, height).every(
    (c) => cellAllowed(c, policy) && !occupied.has(cellKey(c)),
  );
}
/** Effect level of a kind; sealed kinds give no benefits. */
export const buildingLevel = (
  layout: Layout,
  kind: BuildingKind,
  policy: FarmPolicy = {},
) =>
  policy.sealedBuildings?.includes(kind)
    ? 0
    : layout.structures
        .filter((s) => s.kind === kind && !s.pendingConstruction)
        .reduce((sum, s) => sum + s.level, 0);
export const seasonalIncome = (layout: Layout, policy: FarmPolicy = {}) =>
  layout.structures.reduce(
    (sum, s) =>
      sum +
      (s.pendingConstruction || policy.sealedBuildings?.includes(s.kind)
        ? 0
        : buildings[s.kind].income * s.level),
    0,
  );

export const isTree = (kind: BuildingKind) =>
  kind === "apple" || kind === "oak";
export const treeMaturity = (kind: BuildingKind) =>
  kind === "apple" ? 12 : 40;
export const treeProduct = (kind: BuildingKind) =>
  kind === "apple" ? "Apples" : "Acorns";
export const treeStatus = (s: Structure) =>
  s.product
    ? `${treeProduct(s.kind)} ready to harvest`
    : (s.age ?? 0) < treeMaturity(s.kind)
      ? `${(s.age ?? 0) < treeMaturity(s.kind) / 4 ? "Sapling" : "Growing tree"} · ${s.age ?? 0}/${treeMaturity(s.kind)} seasons`
      : "Mature · produces in fall";
export function seasonTrees(
  structures: Structure[],
  season: string,
): Structure[] {
  return structures.map((s) => {
    if (!isTree(s.kind)) return s;
    const age = Math.min(160, (s.age ?? 0) + 1);
    return {
      ...s,
      age,
      product:
        season === "fall" && age >= treeMaturity(s.kind)
          ? true
          : (s.product ?? false),
    };
  });
}

export const hasRipeFruit = (s: Structure) =>
  isTree(s.kind) && !s.pendingConstruction && s.product === true;
