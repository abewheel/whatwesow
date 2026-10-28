import {
  earnOpportunities,
  opportunities,
  type Opportunity,
} from "./progression";
import { WORLD_CELLS } from "../contracts/world";
import type { FarmPolicy } from "../contracts/farm-policy";
import {
  debrisTypes,
  debrisCells,
  initialDebris,
  type Debris,
  buildings,
  structureSize,
  compactBuildingSizes,
  isTree,
  isProducer,
  treeMaturity,
  buildingLevel,
  cellKey,
  footprint,
  inBounds,
  initialPlotCells,
  type Cell,
  type Structure,
} from "./world";
export const crops = {
  turnip: {
    name: "Turnip",
    seed: 4,
    sale: 9,
    steps: 1,
    plantingSeasons: ["spring", "summer"],
    thirsty: false,
    color: 0xf4d5b6,
  },
  carrot: {
    name: "Carrot",
    seed: 7,
    sale: 18,
    steps: 2,
    plantingSeasons: ["spring"],
    thirsty: false,
    color: 0xec8c39,
  },
  corn: {
    name: "Corn",
    seed: 12,
    sale: 34,
    steps: 2,
    plantingSeasons: ["spring"],
    thirsty: true,
    color: 0xf1ce55,
  },
  radish: {
    name: "Radish",
    seed: 3,
    sale: 7,
    steps: 1,
    plantingSeasons: ["spring"],
    thirsty: false,
    color: 0xd54d68,
  },
  tomato: {
    name: "Tomato",
    seed: 9,
    sale: 21,
    steps: 1,
    plantingSeasons: ["summer"],
    thirsty: true,
    color: 0xd94b38,
  },
  pumpkin: {
    name: "Pumpkin",
    seed: 14,
    sale: 32,
    steps: 1,
    plantingSeasons: ["summer"],
    thirsty: true,
    color: 0xe79832,
  },
} as const;
export type CropId = keyof typeof crops;
export type Plot = {
  crop: CropId;
  growth: number;
  /** Half yield at harvest. */
  dry?: true;
  /** Dead: harvesting clears it for nothing. */
  withered?: true;
  premium?: "good" | "bad";
  premiumYield?: number;
} | null;
export type MicroState = {
  debris?: Debris[];
  selfBuilt?: true;
  seeds: Record<CropId, number>;
  premiumSeeds: Record<CropId, number>;
  premiumSeedBatches?: Partial<
    Record<CropId, { quantity: number; yield: number; failOneIn: number }[]>
  >;
  honeyReady?: boolean;
  harvests: Record<CropId, number>;
  opportunities: Opportunity[];
  coins: number;
  /** Seasonal charges the coins could not cover; income pays it first. */
  owed?: number;
  /** Sale money held back until the next season. */
  held?: number;
  /** Turns with a planting permit, ascending, at most two. */
  permits?: number[];
  /** Plot ID → the last crop planted there. */
  lastCrops?: Record<string, CropId>;
  /** Sales counted toward this season's quota. */
  seasonSales?: { turn: number; count: number };
  /** This season's drought water trade; bought water reaches only these plot IDs. */
  water?:
    | { turn: number; choice: "bought"; plots: number[] }
    | { turn: number; choice: "sold" };
  /** Forward price contract, turns inclusive. */
  contract?: { from: number; until: number; mult: number };
  plots: Plot[];
  soilLevel: number;
  pendingSoilUpgrade?: true;
  plotCells: Cell[];
  structures: Structure[];
  nextStructureId: number;
  plotIds: number[];
  nextPlotId: number;
};
export const homesteadMicroState = (): MicroState => ({
  seeds: { radish: 0, tomato: 0, pumpkin: 0, turnip: 0, carrot: 0, corn: 0 },
  premiumSeeds: {
    radish: 0,
    tomato: 0,
    pumpkin: 0,
    turnip: 0,
    carrot: 0,
    corn: 0,
  },
  honeyReady: true,
  harvests: { radish: 0, tomato: 0, pumpkin: 0, turnip: 0, carrot: 0, corn: 0 },
  opportunities: [],
  coins: 100,
  plots: Array.from({ length: 9 }, () => null),
  soilLevel: 0,
  plotCells: initialPlotCells(),
  plotIds: Array.from({ length: 9 }, (_, i) => i + 1),
  nextPlotId: 10,
  nextStructureId: 2,
  structures: [{ id: 1, kind: "home", row: 11, col: 14, level: 1 }],
});
export const initialMicroState = (): MicroState => ({
  ...homesteadMicroState(),
  selfBuilt: true,
  debris: initialDebris(),
  coins: 240,
  plots: [],
  plotCells: [],
  plotIds: [],
  nextPlotId: 1,
  structures: [],
  nextStructureId: 1,
});
export function parseMicroState(value: unknown): MicroState {
  if (!value || typeof value !== "object")
    throw new Error("Farm state must be an object.");
  const s = value as Record<string, unknown>;
  if (!Number.isSafeInteger(s.coins) || Number(s.coins) < 0)
    throw new Error("Use a nonnegative whole coin balance.");
  if (
    !Array.isArray(s.plots) ||
    s.plots.length < 0 ||
    s.plots.length > WORLD_CELLS
  )
    throw new Error("Use 0–4096 plots.");
  if (
    !Number.isInteger(s.soilLevel) ||
    Number(s.soilLevel) < 0 ||
    Number(s.soilLevel) > 3
  )
    throw new Error("Use soilLevel 0–3.");
  if (
    s.pendingSoilUpgrade !== undefined &&
    (s.pendingSoilUpgrade !== true || Number(s.soilLevel) >= 3)
  )
    throw new Error("Invalid pending soil upgrade.");
  const plots = s.plots.map((value: unknown): Plot => {
    if (value === null) return null;
    if (!value || typeof value !== "object") throw new Error("Invalid plot.");
    const p = value as Record<string, unknown>;
    if (typeof p.crop !== "string" || !Object.hasOwn(crops, p.crop))
      throw new Error("Unknown crop.");
    const crop = p.crop as CropId;
    if (
      !Number.isInteger(p.growth) ||
      Number(p.growth) < 0 ||
      Number(p.growth) > (crop === "corn" ? 3 : crops[crop].steps)
    )
      throw new Error("Crop growth is outside its grow steps.");
    if (
      (p.dry !== undefined && p.dry !== true) ||
      (p.withered !== undefined && p.withered !== true) ||
      (p.premium !== undefined && p.premium !== "good" && p.premium !== "bad")
    )
      throw new Error("Invalid crop condition.");
    if (
      p.premiumYield !== undefined &&
      (!p.premium ||
        typeof p.premiumYield !== "number" ||
        !Number.isFinite(p.premiumYield) ||
        p.premiumYield < 0 ||
        p.premiumYield > 100)
    )
      throw new Error("Invalid premium yield.");
    return {
      crop,
      growth: Math.min(p.growth as number, crops[crop].steps),
      ...(p.premiumYield !== undefined
        ? { premiumYield: p.premiumYield as number }
        : {}),
      ...(p.dry ? { dry: true as const } : {}),
      ...(p.withered ? { withered: true as const } : {}),
      ...(p.premium ? { premium: p.premium as "good" | "bad" } : {}),
    };
  });
  if (
    !Array.isArray(s.plotCells) ||
    s.plotCells.length !== plots.length ||
    !Array.isArray(s.structures) ||
    s.structures.length > WORLD_CELLS
  )
    throw new Error("Provide a cell per plot and at most 4,096 structures.");
  const parseCell = (value: unknown): Cell => {
    if (!value || typeof value !== "object" || !inBounds(value as Cell))
      throw new Error("Cells must be inside the 64 × 64 farm.");
    const { row, col } = value as Cell;
    return { row, col };
  };
  const plotCells = s.plotCells.map(parseCell);
  const structures = s.structures.map((value: unknown): Structure => {
    if (!value || typeof value !== "object")
      throw new Error("Invalid structure.");
    const b = value as Record<string, unknown>;
    if (typeof b.kind !== "string" || !Object.hasOwn(buildings, b.kind))
      throw new Error("Unknown building.");
    const kind = b.kind as Structure["kind"];
    if (
      !Number.isSafeInteger(b.id) ||
      Number(b.id) < 1 ||
      !Number.isInteger(b.level) ||
      Number(b.level) < 1 ||
      Number(b.level) > buildings[kind].levels
    )
      throw new Error("Invalid building ID or level.");
    if (
      b.pendingUpgrade !== undefined &&
      (b.pendingUpgrade !== true || Number(b.level) >= buildings[kind].levels)
    )
      throw new Error("Invalid pending building upgrade.");
    if (
      b.pendingConstruction !== undefined &&
      (b.pendingConstruction !== true ||
        b.level !== 1 ||
        b.pendingUpgrade !== undefined)
    )
      throw new Error("Invalid pending construction.");
    if (
      b.pendingDemolition !== undefined &&
      (b.pendingDemolition !== true ||
        b.pendingConstruction !== undefined ||
        b.pendingUpgrade !== undefined)
    )
      throw new Error("Invalid pending demolition.");
    if (
      b.fruitReady !== undefined &&
      (kind !== "apple" ||
        typeof b.fruitReady !== "boolean" ||
        (b.pendingConstruction && b.fruitReady))
    )
      throw new Error("Invalid fruit readiness.");
    if (
      isTree(kind) &&
      ((b.age !== undefined &&
        (!Number.isInteger(b.age) ||
          Number(b.age) < 0 ||
          Number(b.age) > 160)) ||
        (b.product !== undefined && typeof b.product !== "boolean"))
    )
      throw new Error("Invalid tree age or product.");
    if (
      b.harvestsAtLevel !== undefined &&
      (!Number.isSafeInteger(b.harvestsAtLevel) ||
        Number(b.harvestsAtLevel) < 0)
    )
      throw new Error("Invalid upgrade harvest baseline.");
    if (
      b.wait !== undefined &&
      (!Number.isInteger(b.wait) ||
        Number(b.wait) < 1 ||
        Number(b.wait) > 4 ||
        (b.pendingConstruction !== true && b.pendingUpgrade !== true))
    )
      throw new Error("Invalid permit delay.");
    if (
      isProducer(kind) &&
      b.product !== undefined &&
      (typeof b.product !== "boolean" || (b.pendingConstruction && b.product))
    )
      throw new Error("Invalid building product readiness.");
    if (b.footprint !== undefined) {
      const f = b.footprint as { width: number; height: number };
      const old = compactBuildingSizes[kind],
        current = buildings[kind];
      if (
        !f ||
        !(
          (f.width === old.width && f.height === old.height) ||
          (f.width === current.width && f.height === current.height)
        )
      )
        throw new Error("Invalid building footprint.");
    }
    return {
      ...(b.wait === undefined ? {} : { wait: b.wait as number }),
      ...(b.footprint
        ? {
            footprint: {
              ...(b.footprint as { width: number; height: number }),
            },
          }
        : {}),
      ...(isProducer(kind) ? { product: b.product === true } : {}),
      ...(b.harvestsAtLevel === undefined
        ? {}
        : { harvestsAtLevel: b.harvestsAtLevel as number }),
      ...(b.pendingConstruction === true
        ? { pendingConstruction: true as const }
        : {}),
      ...(b.pendingUpgrade === true ? { pendingUpgrade: true as const } : {}),
      ...(b.pendingDemolition === true
        ? { pendingDemolition: true as const }
        : {}),
      ...(isTree(kind)
        ? {
            age:
              b.age === undefined
                ? b.pendingConstruction
                  ? 0
                  : treeMaturity(kind)
                : (b.age as number),
            product:
              b.product === undefined
                ? b.fruitReady === undefined
                  ? kind === "apple" &&
                    b.age === undefined &&
                    !b.pendingConstruction
                  : b.fruitReady === true
                : b.product === true,
          }
        : {}),
      ...parseCell(b),
      kind,
      id: b.id as number,
      level: b.level as number,
    };
  });
  if (new Set(structures.map((s) => s.id)).size !== structures.length)
    throw new Error("Building IDs must be unique.");
  if (
    s.debris !== undefined &&
    (!Array.isArray(s.debris) || s.debris.length > WORLD_CELLS)
  )
    throw new Error("Invalid debris.");
  const debris = (s.debris as unknown[] | undefined)?.map((value): Debris => {
    if (!value || typeof value !== "object") throw new Error("Invalid debris.");
    const d = value as Record<string, unknown>;
    if (typeof d.kind !== "string" || !Object.hasOwn(debrisTypes, d.kind))
      throw new Error("Unknown debris.");
    return { ...parseCell(d), kind: d.kind as Debris["kind"] };
  });
  const cells = [
    ...debrisCells(debris),
    ...plotCells,
    ...structures.flatMap((b) =>
      footprint(b, structureSize(b).width, structureSize(b).height),
    ),
  ];
  if (
    cells.some((c) => !inBounds(c)) ||
    new Set(cells.map(cellKey)).size !== cells.length
  )
    throw new Error("Plots and buildings cannot overlap or leave the farm.");
  if (
    !Number.isSafeInteger(s.nextStructureId) ||
    Number(s.nextStructureId) < 1 ||
    structures.some((b) => b.id >= Number(s.nextStructureId))
  )
    throw new Error("nextStructureId must exceed all building IDs.");
  if (
    !Array.isArray(s.plotIds) ||
    s.plotIds.length !== plots.length ||
    s.plotIds.some((id) => !Number.isSafeInteger(id) || id < 1) ||
    new Set(s.plotIds).size !== plots.length ||
    !Number.isSafeInteger(s.nextPlotId) ||
    Number(s.nextPlotId) < 1 ||
    s.plotIds.some((id) => id >= Number(s.nextPlotId))
  )
    throw new Error("Plots need unique stable IDs below nextPlotId.");
  const seeds = { ...homesteadMicroState().seeds };
  if (s.seeds !== undefined) {
    if (!s.seeds || typeof s.seeds !== "object" || Array.isArray(s.seeds))
      throw new Error("Invalid seed inventory.");
    const inventory = s.seeds as Record<string, unknown>;
    if (
      Object.keys(inventory).length !== Object.keys(crops).length ||
      Object.keys(inventory).some((crop) => !Object.hasOwn(crops, crop))
    )
      throw new Error("Invalid seed inventory crops.");
    for (const crop of Object.keys(crops) as CropId[]) {
      if (!Number.isSafeInteger(inventory[crop]) || Number(inventory[crop]) < 0)
        throw new Error("Use nonnegative whole seed counts.");
      seeds[crop] = inventory[crop] as number;
    }
  }
  const premiumSeeds = { ...homesteadMicroState().premiumSeeds };
  const premiumSeedBatches: NonNullable<MicroState["premiumSeedBatches"]> = {};
  if (s.premiumSeeds !== undefined) {
    if (
      !isRecord(s.premiumSeeds) ||
      Object.keys(s.premiumSeeds).length !== Object.keys(crops).length ||
      Object.keys(s.premiumSeeds).some((c) => !Object.hasOwn(crops, c))
    )
      throw new Error("Invalid premium seed inventory.");
    for (const crop of Object.keys(crops) as CropId[]) {
      const count = s.premiumSeeds[crop];
      if (!Number.isSafeInteger(count) || Number(count) < 0)
        throw new Error("Invalid premium seed count.");
      premiumSeeds[crop] = count as number;
    }
  }
  if (
    s.premiumSeedBatches !== undefined &&
    (!isRecord(s.premiumSeedBatches) ||
      Object.keys(s.premiumSeedBatches).some((c) => !Object.hasOwn(crops, c)))
  )
    throw new Error("Invalid premium seed batches.");
  for (const crop of Object.keys(crops) as CropId[]) {
    const batches = (
      s.premiumSeedBatches as Record<string, unknown> | undefined
    )?.[crop];
    if (batches !== undefined) {
      if (
        !Array.isArray(batches) ||
        batches.some(
          (b) =>
            !isRecord(b) ||
            !Number.isSafeInteger(b.quantity) ||
            Number(b.quantity) < 1 ||
            typeof b.yield !== "number" ||
            !Number.isFinite(b.yield) ||
            b.yield < 0 ||
            b.yield > 100 ||
            !Number.isSafeInteger(b.failOneIn) ||
            Number(b.failOneIn) < 1,
        )
      )
        throw new Error("Invalid premium seed terms.");
      const parsed = batches as {
        quantity: number;
        yield: number;
        failOneIn: number;
      }[];
      if (parsed.reduce((n, b) => n + b.quantity, 0) !== premiumSeeds[crop])
        throw new Error("Premium seed terms must match inventory.");
      if (parsed.length)
        premiumSeedBatches[crop] = parsed.map((b) => ({ ...b }));
    } else if (premiumSeeds[crop])
      throw new Error("Premium seeds need purchase terms.");
  }
  const harvests = {
    radish: 0,
    tomato: 0,
    pumpkin: 0,
    turnip: 0,
    carrot: 0,
    corn: 0,
  };
  if (s.harvests !== undefined) {
    if (
      !s.harvests ||
      typeof s.harvests !== "object" ||
      Array.isArray(s.harvests)
    )
      throw new Error("Invalid harvest history.");
    for (const crop of Object.keys(harvests) as CropId[]) {
      const value = (s.harvests as Record<string, unknown>)[crop];
      const n =
        value === undefined && ["radish", "tomato", "pumpkin"].includes(crop)
          ? 0
          : value;
      if (!Number.isSafeInteger(n) || Number(n) < 0)
        throw new Error("Invalid harvest count.");
      harvests[crop] = n as number;
    }
    if (
      !Number.isSafeInteger(Object.values(harvests).reduce((a, b) => a + b, 0))
    )
      throw new Error("Invalid harvest total.");
  }
  if (
    s.opportunities !== undefined &&
    (!Array.isArray(s.opportunities) ||
      s.opportunities.some(
        (id) => typeof id !== "string" || !Object.hasOwn(opportunities, id),
      ))
  )
    throw new Error("Invalid farm opportunities.");
  if (s.selfBuilt !== undefined && s.selfBuilt !== true)
    throw new Error("Invalid founding farm flag.");
  const plotIds = s.plotIds as number[];
  const council = parseCouncilFields(
    s,
    plotIds,
    thirstyPlots({ plots } as MicroState).map((i) => plotIds[i]),
  );
  if (s.honeyReady !== undefined && typeof s.honeyReady !== "boolean")
    throw new Error("Invalid honey readiness.");
  const result: MicroState = {
    honeyReady: s.honeyReady !== false,
    ...(s.selfBuilt === true ? { selfBuilt: true as const } : {}),
    ...(debris === undefined ? {} : { debris }),
    ...council,
    seeds,
    premiumSeeds,
    ...(Object.keys(premiumSeedBatches).length ? { premiumSeedBatches } : {}),
    harvests,
    opportunities: [
      ...new Set(
        (s.opportunities ??
          (s.harvests === undefined ? ["corn"] : [])) as Opportunity[],
      ),
    ],
    ...(s.pendingSoilUpgrade === true
      ? { pendingSoilUpgrade: true as const }
      : {}),
    nextStructureId: s.nextStructureId as number,
    nextPlotId: s.nextPlotId as number,
    plotIds: [...plotIds],
    coins: s.coins as number,
    plots,
    soilLevel: s.soilLevel as number,
    plotCells,
    structures,
  };
  result.opportunities = earnOpportunities(result);
  return result;
}
const isTurn = (value: unknown) =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 160;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
/** Money, permits and sales the council's rules keep between actions. */
function parseCouncilFields(
  s: Record<string, unknown>,
  plotIds: number[],
  thirstyIds: number[],
): Partial<MicroState> {
  const fields: Partial<MicroState> = {};
  for (const key of ["owed", "held"] as const)
    if (s[key] !== undefined) {
      if (!Number.isSafeInteger(s[key]) || Number(s[key]) < 1)
        throw new Error("Use a positive whole coin amount.");
      fields[key] = s[key] as number;
    }
  if (s.permits !== undefined) {
    const permits = s.permits;
    if (
      !Array.isArray(permits) ||
      permits.length > 2 ||
      permits.some((t, i) => !isTurn(t) || (i > 0 && t <= permits[i - 1]))
    )
      throw new Error("Keep up to two ascending permit turns.");
    if (permits.length) fields.permits = [...permits];
  }
  if (s.lastCrops !== undefined) {
    if (
      !isRecord(s.lastCrops) ||
      Object.values(s.lastCrops).some(
        (crop) => typeof crop !== "string" || !Object.hasOwn(crops, crop),
      )
    )
      throw new Error("Crop history must name known crops.");
    // History of removed plots is dropped; plot IDs are never reused.
    const entries = Object.entries(s.lastCrops).filter(([id]) =>
      plotIds.some((plotId) => String(plotId) === id),
    );
    if (entries.length)
      fields.lastCrops = Object.fromEntries(entries) as Record<string, CropId>;
  }
  if (s.seasonSales !== undefined) {
    const sales = s.seasonSales;
    if (
      !isRecord(sales) ||
      !isTurn(sales.turn) ||
      !Number.isSafeInteger(sales.count) ||
      Number(sales.count) < 0
    )
      throw new Error("Invalid season sales.");
    fields.seasonSales = {
      turn: sales.turn as number,
      count: sales.count as number,
    };
  }
  if (s.water !== undefined) {
    const water = s.water;
    if (
      !isRecord(water) ||
      !isTurn(water.turn) ||
      (water.choice !== "bought" && water.choice !== "sold") ||
      (water.plots !== undefined &&
        (water.choice === "sold" ||
          !Array.isArray(water.plots) ||
          water.plots.some((id) => !Number.isSafeInteger(id) || id < 1) ||
          new Set(water.plots).size !== water.plots.length))
    )
      throw new Error("Invalid water trade.");
    const turn = water.turn as number;
    // Water bought before it was counted per plot reached the thirsty crops growing now.
    fields.water =
      water.choice === "sold"
        ? { turn, choice: "sold" }
        : {
            turn,
            choice: "bought",
            plots: Array.isArray(water.plots)
              ? water.plots.filter((id) => plotIds.includes(id as number))
              : thirstyIds,
          };
  }
  if (s.contract !== undefined) {
    const c = s.contract;
    if (
      !isRecord(c) ||
      !isTurn(c.from) ||
      !isTurn(c.until) ||
      Number(c.until) < Number(c.from) ||
      typeof c.mult !== "number" ||
      !Number.isFinite(c.mult) ||
      c.mult < 0 ||
      c.mult > 10
    )
      throw new Error("Invalid price contract.");
    fields.contract = {
      from: c.from as number,
      until: c.until as number,
      mult: c.mult,
    };
  }
  return fields;
}
export const expansionCost = (state: MicroState) =>
  30 + Math.max(0, state.plots.length - 9) * 5;
export const soilCost = (state: MicroState) => 80 * (state.soilLevel + 1);
/** Sealed building kinds add nothing to the sale. */
export const harvestValue = (
  state: MicroState,
  crop: CropId,
  policy: FarmPolicy = {},
) =>
  crops[crop].sale +
  state.soilLevel * 3 +
  state.structures.reduce(
    (sum, b) =>
      sum +
      (b.pendingConstruction ||
      b.pendingDemolition ||
      policy.sealedBuildings?.includes(b.kind)
        ? 0
        : buildings[b.kind].bonus * b.level),
    0,
  ) +
  (crop === "corn" ? buildingLevel(state, "mill", policy) * 15 : 0);
export const seedCost = (
  state: MicroState,
  crop: CropId,
  policy: FarmPolicy = {},
) => Math.max(1, crops[crop].seed - buildingLevel(state, "shed", policy));

/** Growth uses today's irrigation before paid work completes for later seasons. */
export function growthSeasons(
  state: MicroState,
  crop: CropId,
  policy: FarmPolicy = {},
): number {
  const first = 1 + buildingLevel(state, "well", policy);
  const later = policy.sealedBuildings?.includes("well")
    ? 1
    : 1 +
      state.structures
        .filter((s) => s.kind === "well" && !s.pendingDemolition)
        .reduce((sum, s) => sum + s.level + (s.pendingUpgrade ? 1 : 0), 0);
  return 1 + Math.ceil(Math.max(0, crops[crop].steps - first) / later);
}
/** Living plots of a crop; withered plots no longer count as planted. */
export const plantedPlots = (state: MicroState, crop: CropId) =>
  state.plots.filter((p) => p?.crop === crop && !p.withered).length;
/** Plot indices of thirsty crops that still need water this season. */
export const thirstyPlots = (state: MicroState) =>
  state.plots.flatMap((p, i) =>
    p && crops[p.crop].thirsty && !p.withered && p.growth < crops[p.crop].steps
      ? [i]
      : [],
  );

export function canPlant(crop: CropId, turn: number): boolean {
  return (crops[crop].plantingSeasons as readonly string[]).includes(
    ["spring", "summer", "fall", "winter"][(turn - 1) % 4],
  );
}
