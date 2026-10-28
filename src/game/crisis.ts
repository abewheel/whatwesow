import type { FarmPolicy } from "../contracts/farm-policy";
import { mix } from "../contracts/world";
import { content, engine, type Effect } from "../crisis/engine";
import {
  parseMacroState,
  turnNumber,
  type CrisisRecord,
  type MacroState,
} from "../macro/state";
import { applyFarmConsequences } from "../micro/consequences";
import { credit } from "../micro/money";
import { withPermit } from "../micro/rules";
import {
  crops,
  expansionCost,
  harvestValue,
  parseMicroState,
  plantedPlots,
  type CropId,
  type MicroState,
} from "../micro/state";
import { buildings, isTree, type BuildingKind } from "../micro/world";
import {
  aquiferDrained,
  councilLedger,
  cropIds,
  pendingCrisis,
} from "./crisis-rules";
import {
  advanceSeason,
  farmContext,
  parseState,
  seasons,
  type GameState,
} from "./state";
export {
  crisisPolicy,
  crisisRules,
  mergePolicy,
  pendingCrisis,
} from "./crisis-rules";

// Crises from crisis-layer/ during play: the farm decides when the next one in
// content.params.runOrder fires, the engine decides what passes, and these commit it.
const runOrder = content.params.runOrder;
type Season = (typeof seasons)[number];
/**
 * The seasons each crisis can fire in, and a farm condition that can only pick between them.
 * Every crisis lands while it can hurt: a summer drought or blight finds crops in the ground,
 * and a summer price crash covers the summer and fall harvests. Once an earlier policy has
 * drained the valley's water, a drought comes in spring so both of its seasons have crops to dry.
 */
export const crisisTiming: Record<
  string,
  {
    seasons: Season[];
    drained?: Season[];
    ready?: (state: GameState) => boolean;
  }
> = {
  Drought: { seasons: ["summer"], drained: ["spring"] },
  Blight: { seasons: ["summer"] },
  "Eminent domain": {
    seasons: ["spring", "summer"],
    ready: (state) => state.plots.length >= 6,
  },
  Overproduction: { seasons: ["fall"] },
  "Price crash": { seasons: ["summer"] },
};
/**
 * One crisis every four years, from year 2 to year 30, so the last ten years have none.
 * A save that is behind schedule catches up one year apart, and nothing fires after year 30.
 */
export const crisisYears = runOrder.map((_, n) => 2 + 4 * n);
const lastYear = 30,
  catchUp = 4;

/** The next crisis's id when it should fire now, at the start of this season. */
export function crisisDue(state: GameState): string | null {
  const records = state.crises ?? [];
  const id = runOrder[records.length];
  if (!id || state.year > lastYear || pendingCrisis(state)) return null;
  const turn = turnNumber(state);
  const scheduled = (crisisYears[records.length] - 1) * seasons.length + 1;
  const earliest = Math.max(
    scheduled,
    records.length ? records.at(-1)!.turn + catchUp : 0,
  );
  const timing = crisisTiming[id];
  const when =
    timing.drained && aquiferDrained(records) ? timing.drained : timing.seasons;
  if (turn < earliest || !when.includes(state.season)) return null;
  // The condition can delay a crisis to a later season of the year, never past it.
  const later = when.some(
    (season) => seasons.indexOf(season) > seasons.indexOf(state.season),
  );
  return !timing.ready || timing.ready(state) || !later ? id : null;
}

/** First by score, then the higher harvest value, then crop table order; undefined when nothing scores. */
function bestCrop(
  state: MicroState,
  score: (crop: CropId) => number,
  policy: FarmPolicy,
) {
  const [best] = cropIds
    .map((crop) => ({
      crop,
      score: score(crop),
      value: harvestValue(state, crop, policy),
    }))
    .sort((a, b) => b.score - a.score || b.value - a.value);
  return best.score > 0 ? best.crop : undefined;
}
/** The crop earning the most from its planted plots; else the most harvested; else turnip. */
export function topCrop(state: GameState): CropId {
  const { policy } = farmContext(state);
  return (
    bestCrop(
      state,
      (crop) => plantedPlots(state, crop) * harvestValue(state, crop, policy),
      policy,
    ) ??
    bestCrop(state, (crop) => state.harvests[crop], policy) ??
    "turnip"
  );
}
/** The crop on the most plots; else the most harvested; else turnip. */
export function blightCrop(state: GameState): CropId {
  const { policy } = farmContext(state);
  return (
    bestCrop(state, (crop) => plantedPlots(state, crop), policy) ??
    bestCrop(state, (crop) => state.harvests[crop], policy) ??
    "turnip"
  );
}
/** A plot's worth to the county: the price of new land plus its living crop's sale. */
export function tileWorth(
  state: MicroState,
  index: number,
  policy: FarmPolicy = {},
) {
  const plot = state.plots[index];
  return (
    expansionCost(state) +
    (plot && !plot.withered ? harvestValue(state, plot.crop, policy) : 0)
  );
}
/** Plot ids the county takes first: `edge` (east on screen), `random`, or `mostProductive`. */
export function selectPlots(
  state: MicroState,
  selection: string,
  count: number,
  turn: number,
  policy: FarmPolicy = {},
): number[] {
  const plots = state.plotIds.map((id, i) => {
    const plot = state.plots[i];
    return {
      id,
      ...state.plotCells[i],
      value:
        plot && !plot.withered ? harvestValue(state, plot.crop, policy) : -1,
    };
  });
  type Lot = (typeof plots)[number];
  const orders: Record<string, (a: Lot, b: Lot) => number> = {
    edge: (a, b) =>
      b.col - b.row - (a.col - a.row) || a.row - b.row || a.id - b.id,
    random: (a, b) => mix(a.id, turn) - mix(b.id, turn) || a.id - b.id,
    mostProductive: (a, b) => b.value - a.value || a.id - b.id,
  };
  if (!Object.hasOwn(orders, selection))
    throw new Error(`Unknown land selection: ${selection}.`);
  return plots
    .sort(orders[selection])
    .slice(0, Math.max(0, count))
    .map((p) => p.id);
}

// Both parts come from a parsed save, whose lots are already enlarged.
const compose = (current: GameState, micro: MicroState, macro: MacroState) =>
  parseState({
    version: 3,
    buildingLayout: 2,
    farmerVariant: current.farmerVariant,
    ...micro,
    ...macro,
  });
const heading = (n: number, id: string) =>
  engine.text.fill(content.strings.crisisHeading, {
    n,
    total: runOrder.length,
    title: engine.crisisById[id].title,
  });
/** Start the due crisis: record it and apply its trigger. Blight kills every plot of its crop now. */
export function fireCrisis(state: GameState): GameState {
  const current = parseState(state);
  const id = crisisDue(current);
  if (!id) throw new Error("No crisis is due this season.");
  const crop =
    id === "Blight"
      ? blightCrop(current)
      : id === "Overproduction"
        ? topCrop(current)
        : undefined;
  const record: CrisisRecord = {
    id,
    turn: turnNumber(current),
    ...(crop ? { crop } : {}),
    shiftFirst: true,
  };
  const farm =
    id === "Blight"
      ? applyFarmConsequences(current, {
          clearPlotIds: current.plotIds.filter(
            (_, i) => current.plots[i]?.crop === crop,
          ),
        }).state
      : parseMicroState(current);
  return compose(current, farm, {
    ...parseMacroState(current),
    crises: [...(current.crises ?? []), record],
  });
}
/** End turn: the season change, then the next crisis when it is due. Save the result once. */
export function endTurn(state: GameState): {
  state: GameState;
  message: string;
} {
  const result = advanceSeason(state);
  const id = crisisDue(result.state);
  if (!id) return result;
  const next = fireCrisis(result.state);
  return {
    state: next,
    message: `${result.message} ${heading(next.crises!.length, id)}.`,
  };
}

/** Answer the waiting crisis with a card from the hand, applying the passed policy's one-time effects. */
export function answerCrisis(
  state: GameState,
  cardId: string,
): { state: GameState; message: string } {
  const current = parseState(state);
  const records = current.crises ?? [];
  const record = records.at(-1);
  if (!record || record.pick)
    throw new Error("No crisis is waiting for your answer.");
  if (!engine.hand(record.id, records.length - 1).some((c) => c.id === cardId))
    throw new Error("Choose one of the arguments in your hand.");
  return commit(current, { ...record, pick: cardId }, false);
}
/** Take or refuse the deal the council offered; taking it applies the deal's one-time effects. */
export function answerOffer(
  state: GameState,
  accept: boolean,
): { state: GameState; message: string } {
  const current = parseState(state);
  const records = current.crises ?? [];
  const record = records.at(-1);
  const entry = record?.pick ? councilLedger(records).at(-1) : undefined;
  if (!record?.pick || !entry?.offer || entry.accepted !== null)
    throw new Error("No deal is waiting for your answer.");
  const { cardId } = engine.parsePick(record.pick);
  return commit(
    current,
    { ...record, pick: `${cardId}:${accept ? "accept" : "decline"}` },
    true,
  );
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
/** The plots a land effect takes, their cells, and the cash paid for them. */
function landSale(
  farm: MicroState,
  effect: Effect,
  turn: number,
  policy: FarmPolicy,
) {
  const ids = selectPlots(
    farm,
    String(effect.selection),
    Number(effect.count),
    turn,
    policy,
  );
  const indices = ids.map((id) => farm.plotIds.indexOf(id));
  return {
    ids,
    cells: indices.map((i) => farm.plotCells[i]),
    cash: indices.reduce(
      (sum, i) =>
        sum +
        Math.floor(Number(effect.cashPerTile) * tileWorth(farm, i, policy)),
      0,
    ),
  };
}
/** Living plots of the crop past the first `keep`, by plot index. */
const plotsPast = (farm: MicroState, crop: CropId, keep: number) =>
  farm.plotIds
    .filter((_, i) => {
      const plot = farm.plots[i];
      return !!plot && plot.crop === crop && !plot.withered;
    })
    .slice(keep);
/** How many of each building kind stand or are planned; trees are not zoned. */
const buildingCounts = (farm: MicroState) =>
  Object.fromEntries(
    (Object.keys(buildings) as BuildingKind[])
      .filter((kind) => !isTree(kind))
      .map((kind) => [
        kind,
        farm.structures.filter((s) => s.kind === kind).length,
      ]),
  );
/**
 * Store the answer, then apply the once effects it commits (a deal: only the ones it unlocks),
 * recording loans, land, frozen prices and building counts. Atomic: the whole state is checked.
 */
function commit(
  current: GameState,
  answered: CrisisRecord,
  deal: boolean,
): { state: GameState; message: string } {
  const records = [...current.crises!.slice(0, -1), answered];
  const entry = councilLedger(records).at(-1)!;
  const effects = engine
    .effectsFor(entry)
    .filter((e) => !deal || e.onAccept === true);
  const turn = turnNumber(current),
    { policy } = farmContext(current);
  let record = answered,
    farm = parseMicroState(current),
    income = 0;
  const notes: string[] = [],
    removePlotIds: number[] = [],
    clearPlotIds: number[] = [];
  const find = (type: string) => effects.find((e) => e.type === type);
  const loan = find("loan");
  if (loan) {
    const amount = Math.max(100, 20 * farm.plots.length);
    record = { ...record, loan: amount };
    income += amount;
    notes.push(
      `Loan: +${amount} coins, repaid over ${plural(Number(loan.repayOverSeasons), "season")}.`,
    );
  }
  const land = find("removeTiles") ?? find("sellTiles");
  if (land) {
    const sale = landSale(farm, land, record.turn, policy);
    if (sale.ids.length) record = { ...record, cells: sale.cells };
    removePlotIds.push(...sale.ids);
    income += sale.cash;
    notes.push(
      `The county ${land.type === "sellTiles" ? "bought" : "took"} ${plural(sale.ids.length, "plot")}: +${sale.cash} coins.`,
    );
  }
  const destroy = find("destroyCrop"),
    crop = record.crop as CropId | undefined;
  if (destroy && crop) {
    const ids = plotsPast(farm, crop, Number(destroy.aboveTiles));
    clearPlotIds.push(...ids);
    if (ids.length)
      notes.push(
        `${plural(ids.length, `${crops[crop].name.toLowerCase()} plot`)} plowed under.`,
      );
  }
  if (find("priceFixed"))
    record = {
      ...record,
      prices: Object.fromEntries(
        cropIds.map((id) => [id, harvestValue(farm, id, policy)]),
      ),
    };
  if (find("buildingCap")) record = { ...record, limits: buildingCounts(farm) };
  // A permit rule passed now still lets the player plant this season.
  if (find("permitDelay"))
    farm = { ...farm, permits: withPermit(farm.permits, turn) };
  if (removePlotIds.length || clearPlotIds.length)
    farm = applyFarmConsequences(farm, { removePlotIds, clearPlotIds }).state;
  const paid = credit(farm, income);
  if (paid.toOwed) notes.push(`${paid.toOwed} paid toward what you owe.`);
  const next = compose(current, paid.state, {
    ...parseMacroState(current),
    crises: [...records.slice(0, -1), record],
  });
  return {
    state: next,
    message: [
      deal ? engine.text.offerResult(entry) : `Passed: ${entry.enactedName}.`,
      ...notes,
    ]
      .filter(Boolean)
      .join(" "),
  };
}
