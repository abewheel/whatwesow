import type { FarmPolicy } from "../contracts/farm-policy";
import { canPlant as cropUnlocked } from "./progression";
import {
  canPlant,
  crops,
  expansionCost,
  harvestValue,
  plantedPlots,
  seedCost,
  type CropId,
  type MicroState,
} from "./state";
import { policyCost, type Structure } from "./world";
type Purse = Pick<MicroState, "coins" | "owed">;
const checkAmount = (amount: number) => {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("Use a nonnegative whole coin amount.");
};
function settle<T extends Purse>(state: T, coins: number, owed: number): T {
  const next = { ...state, coins };
  delete next.owed;
  return owed > 0 ? { ...next, owed } : next;
}
/** Seasonal charges never overdraw: whatever the coins cannot cover is owed. */
export function charge<T extends Purse>(
  state: T,
  amount: number,
): { state: T; toOwed: number } {
  checkAmount(amount);
  const paid = Math.min(state.coins, amount);
  return {
    state: settle(state, state.coins - paid, (state.owed ?? 0) + amount - paid),
    toOwed: amount - paid,
  };
}
/** Income pays what is owed first; the rest reaches the coins. */
export function credit<T extends Purse>(
  state: T,
  amount: number,
): { state: T; toOwed: number } {
  checkAmount(amount);
  const toOwed = Math.min(state.owed ?? 0, amount);
  return {
    state: settle(
      state,
      state.coins + amount - toOwed,
      (state.owed ?? 0) - toOwed,
    ),
    toOwed,
  };
}

export type PlantQuote = {
  seed: number;
  fee: number;
  fine: number;
  /** Finable rules this planting breaks, in check order. */
  reasons: string[];
  /** Why the council forbids it outright; planting throws this. */
  blocked?: string;
};
/** Seed price, fee and fine for one planting; `plot` adds the rotation check. */
export function plantQuote(
  state: MicroState,
  crop: CropId,
  policy: FarmPolicy = {},
  turn = 1,
  premium = false,
  plot?: number,
): PlantQuote {
  const { name, sale } = crops[crop];
  const planted = plantedPlots(state, crop);
  const agreed = policy.agreedCropLimits?.[crop];
  const limit = policy.cropLimits?.[crop];
  const resting = Math.floor((policy.fallowShare ?? 0) * state.plots.length);
  const empty = state.plots.filter((p) => !p || p.withered).length;
  const reasons = [
    policy.bannedCrops?.includes(crop) && `${name} is banned`,
    limit !== undefined &&
      planted >= limit &&
      `${name} is limited to ${limit} plot${limit === 1 ? "" : "s"}`,
    policy.assignedCrops &&
      !policy.assignedCrops.includes(crop) &&
      `only ${policy.assignedCrops.map((id) => (Object.hasOwn(crops, id) ? crops[id as CropId].name.toLowerCase() : id)).join(" or ") || "no crop"} may be planted`,
    policy.rotation &&
      plot !== undefined &&
      !policy.assignedCrops?.includes(crop) &&
      state.lastCrops?.[String(state.plotIds[plot])] === crop &&
      `${name} grew here last`,
    policy.fallowShare !== undefined &&
      empty - 1 < resting &&
      `${resting} plot${resting === 1 ? "" : "s"} must rest empty`,
    policy.permitsRequired &&
      !state.permits?.includes(turn) &&
      "no planting permit this season",
  ].filter((r): r is string => typeof r === "string");
  const finable = policy.plantingFine !== undefined;
  const blocked = policy.recoveringCrops?.includes(crop)
    ? `${name} is still recovering from blight.`
    : agreed !== undefined && planted >= agreed
      ? `Your deal limits ${name.toLowerCase()} to ${agreed} plot${agreed === 1 ? "" : "s"}.`
      : reasons.length && !finable
        ? `${reasons[0][0].toUpperCase()}${reasons[0].slice(1)}.`
        : undefined;
  const seed = Math.ceil(
    policyCost(seedCost(state, crop, policy), policy) *
      (policy.seedMultiplier ?? 1),
  );
  return {
    seed: premium ? Math.ceil(seed * (policy.premiumSeed?.seed ?? 1)) : seed,
    fee: policy.plantingFee ?? 0,
    fine:
      reasons.length && finable
        ? Math.ceil((policy.plantingFine ?? 0) * sale)
        : 0,
    reasons,
    ...(blocked ? { blocked } : {}),
  };
}

/**
 * The least a planting costs now (seed, fee and any fine), at least 1: among unlocked
 * crops the rules allow, this season's first; when every one is blocked, what they will cost.
 * Rotation is per plot, so each crop is quoted on each plot.
 */
export function workThreshold(
  state: MicroState,
  policy: FarmPolicy = {},
  turn = 1,
): number {
  const unlocked = (Object.keys(crops) as CropId[]).filter((crop) =>
    cropUnlocked(state, crop),
  );
  const now = unlocked.filter((crop) => canPlant(crop, turn));
  const at = state.plots.length ? state.plots.map((_, i) => i) : [undefined];
  const quotes = (now.length ? now : unlocked).flatMap((crop) =>
    at.map((plot) => plantQuote(state, crop, policy, turn, false, plot)),
  );
  const open = quotes.filter((q) => !q.blocked);
  return Math.max(
    1,
    Math.min(
      ...(open.length ? open : quotes).map((q) => q.seed + q.fee + q.fine),
    ),
  );
}
/** Delivery work is for a farm with no crops and too few coins to plant, or to open a first plot and plant it. */
export const canWork = (state: MicroState, policy: FarmPolicy = {}, turn = 1) =>
  policy.allowWork !== false &&
  !state.plots.some(Boolean) &&
  state.coins <
    (state.plots.length ? 0 : policyCost(expansionCost(state), policy)) +
      workThreshold(state, policy, turn);

export type SaleQuote = {
  /** Coins the sale earns after tax (0 when over quota). */
  value: number;
  tax: number;
  /** The value waits until next season instead of reaching the coins. */
  held: boolean;
  /** Taken for nothing; it does not count toward harvests. */
  overQuota: boolean;
};
/** Sales counted toward the quota this turn. */
export const salesThisTurn = (state: MicroState, turn: number) =>
  state.seasonSales?.turn === turn ? state.seasonSales.count : 0;
const activeContract = (state: MicroState, turn: number) =>
  state.contract && state.contract.from <= turn && turn <= state.contract.until
    ? state.contract
    : undefined;
/** The shared sale chain: price multipliers, output, relief fund tax and quota. */
function priceSale(
  state: MicroState,
  key: string,
  base: number,
  policy: FarmPolicy,
  turn: number,
  factors: number[] = [],
): Omit<SaleQuote, "held"> {
  let mult = activeContract(state, turn)?.mult ?? policy.cropPrices?.[key] ?? 1;
  if (
    (policy.fixedPrices && Object.hasOwn(policy.fixedPrices, key)) ||
    policy.priceCeiling !== undefined
  )
    mult = Math.min(mult, policy.priceCeiling ?? 1);
  const gross = Math.floor(
    [mult, ...factors, policy.productionMultiplier ?? 1].reduce(
      (value, factor) => value * factor,
      base,
    ),
  );
  if (policy.quota !== undefined && salesThisTurn(state, turn) >= policy.quota)
    return { value: 0, tax: 0, overQuota: true };
  const tax = Math.floor(gross * (policy.harvestTax ?? 0));
  return { value: gross - tax, tax, overQuota: false };
}
/** What selling one crop earns now; `plot` adds its dry and premium condition. */
export function saleQuote(
  state: MicroState,
  crop: CropId,
  policy: FarmPolicy = {},
  turn = 1,
  plot?: number,
): SaleQuote {
  const condition = plot === undefined ? null : state.plots[plot];
  let base = policy.fixedPrices?.[crop] ?? harvestValue(state, crop, policy);
  if (policy.averageCap) base = Math.min(base, crops[crop].sale);
  const sale = priceSale(state, crop, base, policy, turn, [
    policy.yieldMultiplier ?? 1,
    condition?.dry ? 0.5 : 1,
    condition?.premium === "good" ? (policy.premiumSeed?.yield ?? 1) : 1,
  ]);
  const above = policy.sellDelay?.[crop];
  return {
    ...sale,
    held:
      !sale.overQuota &&
      above !== undefined &&
      plantedPlots(state, crop) > above,
  };
}
/** Fruit uses the same chain without yield, dry or premium effects. */
export function fruitQuote(
  state: MicroState,
  tree: Structure,
  policy: FarmPolicy = {},
  turn = 1,
): SaleQuote {
  const base = (tree.kind === "apple" ? 24 : 8) * tree.level;
  return { ...priceSale(state, tree.kind, base, policy, turn), held: false };
}
