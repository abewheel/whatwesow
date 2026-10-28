import { WORLD_SIZE, WORLD_CELLS } from "./world";
/** Macro-owned restrictions passed into pure farming rules. Missing fields mean no restriction. */
export type FarmPolicy = {
  land?: { row: number; col: number; width: number; height: number }[];
  blockedBuildings?: string[];
  buildingLimits?: Record<string, number>;
  maxPlots?: number;
  costMultiplier?: number;
  productionMultiplier?: number;
  allowWork?: boolean;
  /** Sale multiplier per crop or fruit tree kind, 0–10. */
  cropPrices?: Record<string, number>;
  /** Sale value per crop; replaces harvestValue and ignores multipliers above 1. */
  fixedPrices?: Record<string, number>;
  /** Cap on the combined sale multiplier (1 under fixed prices). */
  priceCeiling?: number;
  bannedCrops?: string[];
  /** Blight recovery: a hard block, never a fine. */
  recoveringCrops?: string[];
  cropLimits?: Record<string, number>;
  /** Limits from an accepted deal: a hard block, never a fine. */
  agreedCropLimits?: Record<string, number>;
  assignedCrops?: string[];
  seedMultiplier?: number;
  plantingFee?: number;
  /** Share of each crop and fruit sale paid to the relief fund, 0–1. */
  harvestTax?: number;
  yieldMultiplier?: number;
  /** Crop sale value capped at the crop's base sale (the valley average). */
  averageCap?: boolean;
  /** Sales allowed this season; sales over it earn nothing. */
  quota?: number;
  /** Crop → `above`: its sales are held while more than `above` plots of it are planted. */
  sellDelay?: Record<string, number>;
  permitsRequired?: boolean;
  /** No planting the same crop twice in a row on a plot. */
  rotation?: boolean;
  /** Share of plots that must stay empty, 0–1. */
  fallowShare?: number;
  /** Fine = this × crop base sale; when absent, finable rules block instead. */
  plantingFine?: number;
  /** These kinds give no growth, harvest bonus, seed discount or income. */
  sealedBuildings?: string[];
  /** Extra seasons for new construction and upgrades, 0–4. */
  buildDelay?: number;
  frozenUpgrades?: boolean;
  /** Kinds that can be built without their milestone. */
  unlockedBuildings?: string[];
  /** Cells that are no longer part of the farm. */
  takenCells?: { row: number; col: number }[];
  /** Drought water prices per thirsty growing plot. */
  waterTrade?: { buy: number; sell: number };
  droughtWells?: boolean;
  premiumSeed?: { seed: number; yield: number; failOneIn: number };
  /** A price lock available this season. */
  forwardContract?: { mult: number; seasons: number };
};
const inRange = (value: unknown, max: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= max;
const wholeInRange = (value: unknown, min: number, max: number) =>
  Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function parseFarmPolicy(value: unknown): FarmPolicy {
  if (!isRecord(value)) throw new Error("Farm policy must be an object.");
  const s = value,
    p: FarmPolicy = {};
  if (s.land !== undefined) {
    if (!Array.isArray(s.land) || s.land.length > WORLD_CELLS)
      throw new Error("Invalid land grants.");
    p.land = s.land.map((value: unknown) => {
      if (!value || typeof value !== "object")
        throw new Error("Invalid land grant.");
      const r = value as Record<string, unknown>;
      if (
        !["row", "col", "width", "height"].every((k) =>
          Number.isInteger(r[k]),
        ) ||
        Number(r.row) < 0 ||
        Number(r.col) < 0 ||
        Number(r.width) < 1 ||
        Number(r.height) < 1 ||
        Number(r.row) + Number(r.height) > WORLD_SIZE ||
        Number(r.col) + Number(r.width) > WORLD_SIZE
      )
        throw new Error("Land grants must fit the farm.");
      return {
        row: r.row as number,
        col: r.col as number,
        width: r.width as number,
        height: r.height as number,
      };
    });
  }
  for (const key of [
    "blockedBuildings",
    "bannedCrops",
    "recoveringCrops",
    "assignedCrops",
    "sealedBuildings",
    "unlockedBuildings",
  ] as const)
    if (s[key] !== undefined) {
      const list = s[key];
      if (!Array.isArray(list) || list.some((k) => typeof k !== "string"))
        throw new Error("Invalid policy list.");
      p[key] = [...list] as string[];
    }
  for (const [key, valid] of [
    ["buildingLimits", (v: unknown) => wholeInRange(v, 0, Infinity)],
    ["cropLimits", (v: unknown) => wholeInRange(v, 0, Infinity)],
    ["agreedCropLimits", (v: unknown) => wholeInRange(v, 0, Infinity)],
    ["fixedPrices", (v: unknown) => wholeInRange(v, 0, Infinity)],
    ["cropPrices", (v: unknown) => inRange(v, 10)],
    ["sellDelay", (v: unknown) => wholeInRange(v, 0, WORLD_CELLS)],
  ] as const)
    if (s[key] !== undefined) {
      const record = s[key];
      if (!isRecord(record)) throw new Error("Invalid policy limits.");
      const entries = Object.entries(record);
      if (entries.some(([, v]) => !valid(v)))
        throw new Error("Invalid policy limit value.");
      p[key] = Object.fromEntries(entries) as Record<string, number>;
    }
  for (const [key, min, max] of [
    ["maxPlots", 0, WORLD_CELLS],
    ["plantingFee", 0, 1000],
    ["quota", 0, Number.MAX_SAFE_INTEGER],
    ["buildDelay", 0, 4],
  ] as const)
    if (s[key] !== undefined) {
      if (!wholeInRange(s[key], min, max))
        throw new Error("Invalid policy count.");
      p[key] = s[key] as number;
    }
  for (const [key, max] of [
    ["costMultiplier", 1000],
    ["productionMultiplier", 1000],
    ["priceCeiling", 10],
    ["seedMultiplier", 10],
    ["yieldMultiplier", 10],
    ["plantingFine", 10],
    ["harvestTax", 1],
    ["fallowShare", 1],
  ] as const)
    if (s[key] !== undefined) {
      if (!inRange(s[key], max)) throw new Error("Invalid policy multiplier.");
      p[key] = s[key];
    }
  for (const key of [
    "allowWork",
    "averageCap",
    "permitsRequired",
    "rotation",
    "frozenUpgrades",
    "droughtWells",
  ] as const)
    if (s[key] !== undefined) {
      if (typeof s[key] !== "boolean")
        throw new Error("Invalid policy switch.");
      p[key] = s[key];
    }
  if (s.takenCells !== undefined) {
    if (
      !Array.isArray(s.takenCells) ||
      s.takenCells.length > WORLD_CELLS ||
      s.takenCells.some(
        (c) =>
          !isRecord(c) ||
          !wholeInRange(c.row, 0, WORLD_SIZE - 1) ||
          !wholeInRange(c.col, 0, WORLD_SIZE - 1),
      )
    )
      throw new Error("Taken cells must be inside the farm.");
    p.takenCells = s.takenCells.map((c: { row: number; col: number }) => ({
      row: c.row,
      col: c.col,
    }));
  }
  if (s.waterTrade !== undefined) {
    const w = s.waterTrade;
    if (
      !isRecord(w) ||
      !wholeInRange(w.buy, 0, 1000) ||
      !wholeInRange(w.sell, 0, 1000)
    )
      throw new Error("Invalid water prices.");
    p.waterTrade = { buy: w.buy as number, sell: w.sell as number };
  }
  if (s.premiumSeed !== undefined) {
    const q = s.premiumSeed;
    if (
      !isRecord(q) ||
      !inRange(q.seed, 10) ||
      !inRange(q.yield, 10) ||
      !wholeInRange(q.failOneIn, 1, 1000)
    )
      throw new Error("Invalid premium seed.");
    p.premiumSeed = {
      seed: q.seed,
      yield: q.yield,
      failOneIn: q.failOneIn as number,
    };
  }
  if (s.forwardContract !== undefined) {
    const f = s.forwardContract;
    if (
      !isRecord(f) ||
      !inRange(f.mult, 10) ||
      !wholeInRange(f.seasons, 1, 160)
    )
      throw new Error("Invalid price contract.");
    p.forwardContract = { mult: f.mult, seasons: f.seasons as number };
  }
  return p;
}
