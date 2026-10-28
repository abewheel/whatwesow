import { parseFarmPolicy, type FarmPolicy } from "../contracts/farm-policy";
import { mix } from "../contracts/world";
import type { CrisisRecord, MacroState } from "../macro/state";
import {
  canPlant,
  crops,
  plantedPlots,
  thirstyPlots,
  type CropId,
  type MicroState,
} from "../micro/state";
import type { WaterInput } from "../micro/rules";
import {
  buildingLevel,
  buildings,
  isTree,
  type BuildingKind,
} from "../micro/world";
import {
  content,
  engine,
  type Effect,
  type LedgerRecord,
} from "../crisis/engine";

// Crisis records compiled into the farm rules of one turn. Integration only: nothing is
// written into farmPolicy; every rule is derived again from the records and their answers.
type Farm = MicroState & MacroState;
export const cropIds = Object.keys(crops) as CropId[];
const fruitKinds = (Object.keys(buildings) as BuildingKind[]).filter(isTree);

const combine = <T>(
  a: T | undefined,
  b: T | undefined,
  join: (a: T, b: T) => T,
) => (a === undefined ? b : b === undefined ? a : join(a, b));
const perKey = (
  a: Record<string, number>,
  b: Record<string, number>,
  join: (a: number, b: number) => number,
) => {
  const out = { ...a };
  for (const [key, value] of Object.entries(b))
    out[key] = Object.hasOwn(out, key) ? join(out[key], value) : value;
  return out;
};
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
/** Both policies hold at once: multipliers multiply, limits take the lower, lists and switches add up. */
export function mergePolicy(a: FarmPolicy, b: FarmPolicy): FarmPolicy {
  // Land, water prices, premium seed and contracts: the first policy's stands.
  const p: FarmPolicy = { ...b, ...a };
  for (const [key, max] of [
    ["costMultiplier", 1000],
    ["productionMultiplier", 1000],
    ["seedMultiplier", 10],
    ["yieldMultiplier", 10],
  ] as const)
    p[key] = combine(a[key], b[key], (x, y) => Math.min(max, x * y));
  for (const key of ["maxPlots", "quota", "priceCeiling"] as const)
    p[key] = combine(a[key], b[key], Math.min);
  for (const key of ["plantingFine", "fallowShare", "buildDelay"] as const)
    p[key] = combine(a[key], b[key], Math.max);
  p.plantingFee = combine(a.plantingFee, b.plantingFee, (x, y) =>
    Math.min(1000, x + y),
  );
  p.harvestTax = combine(
    a.harvestTax,
    b.harvestTax,
    (x, y) => 1 - (1 - x) * (1 - y),
  );
  for (const key of [
    "blockedBuildings",
    "bannedCrops",
    "recoveringCrops",
    "assignedCrops",
    "sealedBuildings",
    "unlockedBuildings",
  ] as const)
    p[key] = combine(a[key], b[key], union);
  for (const key of [
    "buildingLimits",
    "cropLimits",
    "agreedCropLimits",
    "sellDelay",
  ] as const)
    p[key] = combine(a[key], b[key], (x, y) => perKey(x, y, Math.min));
  p.cropPrices = combine(a.cropPrices, b.cropPrices, (x, y) =>
    perKey(x, y, (u, v) => Math.min(10, u * v)),
  );
  // The earliest frozen price of a crop stands.
  p.fixedPrices = combine(a.fixedPrices, b.fixedPrices, (x, y) => ({
    ...y,
    ...x,
  }));
  for (const key of [
    "averageCap",
    "permitsRequired",
    "rotation",
    "frozenUpgrades",
    "droughtWells",
  ] as const)
    p[key] = combine(a[key], b[key], (x, y) => x || y);
  p.allowWork = combine(a.allowWork, b.allowWork, (x, y) => x && y);
  p.takenCells = combine(a.takenCells, b.takenCells, (x, y) => [
    ...x,
    ...y.filter((c) => !x.some((d) => d.row === c.row && d.col === c.col)),
  ]);
  return parseFarmPolicy(p);
}

/** Ledger entries for the answered records, in record order. */
export function councilLedger(records: CrisisRecord[] = []): LedgerRecord[] {
  const picks = records.flatMap((r) => (r.pick ? [r.pick] : []));
  return picks.length ? engine.replay(picks).ledger : [];
}
/** The crisis waiting for the player: no answer yet, or a deal not yet taken or refused. */
export function pendingCrisis(state: Pick<MacroState, "crises">) {
  const records = state.crises ?? [];
  const last = records.at(-1);
  if (!last?.pick) return last;
  const entry = councilLedger(records).at(-1)!;
  return entry.offer && entry.accepted === null ? last : undefined;
}
/** Integration's check of saved records, at the save's turn, against the crisis layer. */
export function checkCrisisRecords(records: CrisisRecord[], turn: number) {
  const order = content.params.runOrder;
  if (records.some((r, i) => r.id !== order[i]))
    throw new Error("Crises must follow the council's run order.");
  if ((records.at(-1)?.turn ?? 0) > turn)
    throw new Error("Crisis records cannot be later than the current season.");
  if (
    records.some((r) => r.crop !== undefined && !Object.hasOwn(crops, r.crop))
  )
    throw new Error("A crisis crop must be a farm crop.");
  const early = new Error("Answer each crisis before the next one fires.");
  if (records.slice(0, -1).some((r) => !r.pick)) throw early;
  let ledger: LedgerRecord[];
  try {
    ledger = councilLedger(records);
  } catch {
    throw new Error(
      "Each crisis answer must be one of that crisis's arguments.",
    );
  }
  if (
    ledger
      .slice(0, records.length - 1)
      .some((r) => r.offer && r.accepted === null)
  )
    throw early;
}

/** What the records impose on one turn: farm rules, plus the water and bills at its season change. */
export type CrisisRules = {
  policy: FarmPolicy;
  drought: boolean;
  /** Water sold at cost this season protects thirsty crops. */
  waterAtCost: boolean;
  irrigationCap?: number;
  waterBill: boolean;
  waterTax: boolean;
  /** Fees on plots of a crop above a cap. */
  cropFees: { crop: CropId; cap: number }[];
  loanPayment: number;
};
// Seasons a crisis's own effect lasts; drought and blight lengths depend on the answers.
// A blighted crop recovers over its own planting seasons, not calendar seasons.
const crisisSeasons: Record<string, number> = {
  "Price crash": 2,
  Overproduction: 2,
};
const crashMult = 0.6,
  glutMult = 0.75;

/** Replay the answers and compile every record's trigger and policy effects in force at `turn`. */
export function crisisRules(state: Farm, turn: number): CrisisRules {
  const rules: CrisisRules = {
    policy: {},
    drought: false,
    waterAtCost: false,
    waterBill: false,
    waterTax: false,
    cropFees: [],
    loanPayment: 0,
  };
  const records = state.crises ?? [];
  const ledger = councilLedger(records);
  const add = (policy: FarmPolicy) => {
    rules.policy = mergePolicy(rules.policy, policy);
  };
  const bound = new Set<string>();
  let droughtSeasons = 1;
  records.forEach((record, k) => {
    const since = turn - record.turn;
    if (since < 0) return;
    const entry = ledger[k] as LedgerRecord | undefined;
    const effects = entry ? engine.effectsFor(entry) : [];
    const find = (type: string) => effects.find((e) => e.type === type);
    const crop = record.crop as CropId | undefined;
    const span =
      record.id === "Drought"
        ? droughtSeasons
        : record.id === "Blight" && crop
          ? 1 +
            recoveryUntil(
              crop,
              record.turn,
              num(find("recoverySeasons")?.seasons, 2),
            ) -
            record.turn
          : (crisisSeasons[record.id] ?? 0);
    if (since < span) applyTrigger(rules, add, record.id, crop, find);
    // Land, prices and building counts fixed when the answer was committed.
    if (record.cells?.length) add({ takenCells: record.cells });
    if (record.prices) add({ fixedPrices: record.prices, priceCeiling: 1 });
    if (record.limits) add({ buildingLimits: record.limits });
    const loan = find("loan");
    if (record.loan && loan)
      rules.loanPayment += loanPayment(
        record.loan,
        num(loan.repayOverSeasons, 4),
        since,
      );
    // A policy passed again (for the same crop) binds once, as the engine lists it once.
    // A refused deal never took effect, so the same deal taken later still binds.
    const key = `${record.id}@${entry?.enactedPos}@${crop ?? ""}`;
    const repeat = bound.has(key);
    if (entry && (!entry.offer || entry.accepted === true)) bound.add(key);
    for (const effect of effects) {
      const lasts =
        effect.action === "forwardContract" ? "crisis" : effect.duration;
      if (
        lasts === "standing"
          ? !repeat
          : lasts === "season"
            ? since === 0
            : lasts === "crisis" && since < span
      )
        applyEffect(rules, add, effect, { state, turn, crop });
    }
    const drain = find("aquiferDrain");
    if (drain)
      droughtSeasons = Math.max(droughtSeasons, num(drain.droughtSeasons, 2));
  });
  // The assigned crop is never one another rule bans, blocks, caps or charges for,
  // whichever record set it.
  const p = rules.policy;
  if (p.assignedCrops) {
    const assigned = assignedCrop(turn, [
      ...(p.bannedCrops ?? []),
      ...(p.recoveringCrops ?? []),
      ...Object.keys(p.cropLimits ?? {}),
      ...Object.keys(p.agreedCropLimits ?? {}),
      ...Object.keys(p.sellDelay ?? {}),
      ...rules.cropFees.map((fee) => fee.crop),
    ]);
    if (assigned) rules.policy = { ...p, assignedCrops: [assigned] };
  }
  return rules;
}
export const crisisPolicy = (state: Farm, turn: number) =>
  crisisRules(state, turn).policy;

const num = (value: unknown, fallback: number) =>
  typeof value === "number" ? value : fallback;
/** A crisis's own effect while it lasts, from the fire turn; its answer can soften or replace it. */
function applyTrigger(
  rules: CrisisRules,
  add: (policy: FarmPolicy) => void,
  id: string,
  crop: CropId | undefined,
  find: (type: string) => Effect | undefined,
) {
  if (id === "Drought") rules.drought = true;
  if (id === "Blight" && crop) add({ recoveringCrops: [crop] });
  if (id === "Price crash") {
    const mult = find("priceFixed")
      ? 1
      : num(find("priceFloor")?.mult, crashMult);
    if (mult !== 1)
      add({
        cropPrices: Object.fromEntries(
          [...cropIds, ...fruitKinds].map((kind) => [kind, mult]),
        ),
      });
  }
  // An accepted deal's price replaces the glut price.
  if (id === "Overproduction" && crop && !find("priceMult"))
    add({ cropPrices: { [crop]: glutMult } });
}
/** One policy effect while it is in force. Once effects, land and frozen values work through the record. */
function applyEffect(
  rules: CrisisRules,
  add: (policy: FarmPolicy) => void,
  e: Effect,
  { state, turn, crop }: { state: Farm; turn: number; crop?: CropId },
) {
  const p = rules.policy;
  if (e.type === "unlockAction") {
    if (e.action === "tradeWaterRights")
      add({ waterTrade: { buy: num(e.buy, 12), sell: num(e.sell, 6) } });
    if (e.action === "drillWell")
      add({ unlockedBuildings: ["well"], droughtWells: true });
    if (e.action === "premiumSeed")
      add({
        premiumSeed: {
          seed: num(e.seedMult, 1.5),
          yield: num(e.yieldMult, 1.3),
          failOneIn: num(e.failOneIn, 8),
        },
      });
    if (e.action === "forwardContract")
      add({
        forwardContract: {
          mult: num(e.mult, 0.85),
          seasons: num(e.seasons, 4),
        },
      });
  } else if (e.type === "lockAction") {
    if (e.action === "tradeWater") delete p.waterTrade;
    if (e.action === "drillWell") {
      delete p.droughtWells;
      p.unlockedBuildings = p.unlockedBuildings?.filter((k) => k !== "well");
      if (!p.unlockedBuildings?.length) delete p.unlockedBuildings;
      add({ blockedBuildings: ["well"] });
    }
  } else if (e.type === "waterAtCost") rules.waterAtCost = true;
  else if (e.type === "fee") {
    if (e.per === "tick") rules.waterBill = true;
    if (e.per === "planting") add({ plantingFee: 2 });
    if (e.per === "tileAboveCap" && crop)
      rules.cropFees.push({ crop, cap: num(e.cap, 5) });
  } else if (e.type === "waterTax") rules.waterTax = true;
  else if (e.type === "irrigationCap")
    rules.irrigationCap = Math.min(
      rules.irrigationCap ?? 1,
      num(e.fraction, 1),
    );
  else if (e.type === "sealBuilding")
    add({ sealedBuildings: [String(e.building)] });
  else if (e.type === "permitDelay") add({ permitsRequired: true });
  else if (e.type === "cropRotation") add({ rotation: true });
  else if (e.type === "freeSeed") add({ seedMultiplier: 0 });
  else if (e.type === "cropChoiceLocked") {
    const assigned = assignedCrop(turn);
    if (assigned) add({ assignedCrops: [assigned] });
  } else if (e.type === "yieldMult") add({ yieldMultiplier: num(e.mult, 1) });
  else if (e.type === "fine") add({ plantingFine: num(e.perPlanting, 0) });
  else if (e.type === "harvestTax") add({ harvestTax: num(e.rate, 0) });
  else if (e.type === "quota")
    add({ quota: boardQuota(state, turn, e.varies === true) });
  else if (e.type === "seedCostMult") add({ seedMultiplier: num(e.mult, 1) });
  else if (e.type === "buildDelay") add({ buildDelay: num(e.seasons, 0) });
  else if (e.type === "confiscateAboveAverage") add({ averageCap: true });
  else if (e.type === "freezeUpgrades") add({ frozenUpgrades: true });
  else if (e.type === "fallow") add({ fallowShare: num(e.share, 0) });
  else if (crop) {
    if (e.type === "priceMult") add({ cropPrices: { [crop]: num(e.mult, 1) } });
    if (e.type === "maxTilesPerCrop") {
      // A limit the player agreed to in a deal is a hard block, never a fine.
      const limit = { [crop]: num(e.tiles, 5) };
      add(e.onAccept ? { agreedCropLimits: limit } : { cropLimits: limit });
    }
    if (e.type === "sellDelay") add({ sellDelay: { [crop]: 5 } });
    if (e.type === "banCrop") add({ bannedCrops: [crop] });
  }
}

/**
 * The one crop the rules let you plant this season: this season's plantable crops by base
 * sale, one further each year. When `skip` rules that crop out, the next one in that order
 * is named instead, so other years keep their crops; if every crop is skipped, the year's own.
 */
export function assignedCrop(
  turn: number,
  skip: readonly string[] = [],
): CropId | undefined {
  const plantable = cropIds
    .filter((crop) => canPlant(crop, turn))
    .sort((a, b) => crops[a].sale - crops[b].sale);
  // The year's crop, or the next one in order when another rule rules it out.
  const start = Math.floor((turn - 1) / 4) % plantable.length;
  const order = plantable.map(
    (_, k) => plantable[(start + k) % plantable.length],
  );
  return order.find((crop) => !skip.includes(crop)) ?? order[0];
}
/** Sales allowed this season; with `varies`, the allowance changes every season. */
export function boardQuota(state: MicroState, turn: number, varies = true) {
  const base = Math.max(3, Math.ceil(state.plots.length / 2));
  const share = varies ? [0.5, 0.75, 1, 1.25][mix(turn, 7) % 4] : 1;
  return Math.max(1, Math.floor(base * share));
}
/**
 * The last turn a blighted crop stays blocked: through its next `seasons` planting
 * seasons, the fire season counting when the crop is planted then. 0 seasons: no block.
 */
export function recoveryUntil(crop: CropId, fired: number, seasons: number) {
  let until = fired - 1;
  for (let turn = fired, left = seasons; left > 0; turn++)
    if (canPlant(crop, turn)) {
      until = turn;
      left--;
    }
  return until;
}
/** Whether an answered crisis passed a policy that drains the valley's water. */
export const aquiferDrained = (records: CrisisRecord[] = []) =>
  councilLedger(records).some((entry) =>
    engine.effectsFor(entry).some((e) => e.type === "aquiferDrain"),
  );
/** Equal payments; the last one pays the remainder. */
export function loanPayment(loan: number, seasons: number, k: number) {
  const each = Math.ceil(loan / seasons);
  return k < 0 || k >= seasons
    ? 0
    : Math.max(0, Math.min(each, loan - each * k));
}
/** Where thirsty crops get water at this season's change, and what stops it. */
export type WaterSupply = {
  /** Plot IDs watered with water bought this season. */
  bought: number[];
  /** Water rights sold this season: in a drought, nothing waters the crops. */
  sold: boolean;
  /** The council sells water at cost this season, 1 coin per thirsty crop at End turn. */
  atCost: boolean;
  /** A finished, unsealed well waters every thirsty crop, where the council lets it. */
  well: boolean;
  /** Share of thirsty growing crops that get any water; the rest wither. */
  irrigationCap?: number;
};
export function waterSupply(
  state: MicroState,
  rules: CrisisRules,
  policy: FarmPolicy,
  turn: number,
): WaterSupply {
  const water = state.water?.turn === turn ? state.water : undefined;
  return {
    bought: water?.choice === "bought" ? water.plots : [],
    sold: water?.choice === "sold",
    atCost: rules.waterAtCost,
    well:
      policy.droughtWells === true && buildingLevel(state, "well", policy) > 0,
    ...(rules.irrigationCap === undefined
      ? {}
      : { irrigationCap: rules.irrigationCap }),
  };
}
/** The season change's water. Selling your water rights gives up the well and water at cost too. */
export const waterInput = (
  drought: boolean,
  supply: WaterSupply,
): WaterInput => ({
  drought,
  protectedFromDrought: !supply.sold && (supply.atCost || supply.well),
  wateredPlots: supply.bought,
  ...(supply.irrigationCap === undefined
    ? {}
    : { irrigationCap: supply.irrigationCap }),
});
/**
 * Council charges at the season change, named for the message; `watered` thirsty plots pay
 * the water tax. Water at cost is not charged once the water rights are `sold`.
 */
export function seasonCharges(
  state: MicroState,
  rules: CrisisRules,
  watered: number,
  sold = false,
): [string, number][] {
  const charges: [string, number][] = [
    ["Water bill", rules.waterBill ? Math.max(5, state.plots.length) : 0],
    ["Water tax", rules.waterTax ? (watered * (watered + 1)) / 2 : 0],
    [
      "Water at cost",
      rules.waterAtCost && !sold ? thirstyPlots(state).length : 0,
    ],
    ...rules.cropFees.map(({ crop, cap }): [string, number] => [
      `Fee on extra ${crops[crop].name.toLowerCase()}`,
      5 * Math.max(0, plantedPlots(state, crop) - cap),
    ]),
    ["Loan payment", rules.loanPayment],
  ];
  return charges.filter(([, amount]) => amount > 0);
}
