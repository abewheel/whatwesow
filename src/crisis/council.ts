import type { FarmPolicy } from "../contracts/farm-policy";
import { councilState } from "../game/crisis-rules";
import type { WaterOutlook } from "../game/state";
import type { CrisisRecord } from "../macro/state";
import { salesThisTurn } from "../micro/money";
import { crops, thirstyPlots, type MicroState } from "../micro/state";
import { buildings, type BuildingKind } from "../micro/world";

// The farmhouse's "Council rules": the council's standing rules in its own words, what
// they mean for the farm this season, and the trades a crisis opens up.
type Context = {
  turn: number;
  policy: FarmPolicy;
  drought?: boolean;
  /** What End turn does to the thirsty crops; without it, no water facts are stated. */
  water?: WaterOutlook;
};
const seasonNames = ["spring", "summer", "fall", "winter"];
const when = (turn: number) =>
  `year ${Math.ceil(turn / 4)} ${seasonNames[(turn - 1) % 4]}`;
const percent = (mult: number) => `${Math.round(mult * 100)}%`;
const nameOf = (id: string) =>
  Object.hasOwn(crops, id)
    ? crops[id as keyof typeof crops].name
    : Object.hasOwn(buildings, id)
      ? buildings[id as BuildingKind].name
      : id;
const names = (ids: string[]) => ids.map(nameOf).join(", ");
const thirstyCrops = (n: number) => `${n} thirsty crop${n === 1 ? "" : "s"}`;
const others = (n: number) => `${n} other${n === 1 ? "" : "s"}`;
/** The verb for a count: `verb(1, "gets", "get")`. */
const verb = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * What End turn does to the thirsty crops growing now, in the outlook's own numbers:
 * a drought dries them unless something waters them, and a water limit withers the rest.
 */
export function waterFact(
  state: MicroState,
  { drought = false, water, policy }: Context,
) {
  if (!water || (!drought && !water.withering)) return undefined;
  const { thirsty, drying, withering } = water;
  const lead = drought ? "Drought this season: " : "Water limit: ";
  if (!thirsty) return `${lead}no thirsty crops are growing.`;
  if (drought && water.sold) {
    const losses = [
      drying && `${thirstyCrops(drying)} will dry to half yield`,
      withering && `${withering} will wither`,
    ].filter(Boolean);
    return `${lead}you sold your water${losses.length ? `, so ${losses.join(" and ")}` : ""}.`;
  }
  // A limit waters only some thirsty crops; in a drought, those dry unless protected.
  const fed = thirsty - withering;
  if (!fed)
    return `${lead}your ${thirstyCrops(thirsty)} ${verb(thirsty, "gets", "get")} no water and ${verb(thirsty, "withers", "wither")} at End turn.`;
  if (withering)
    return `${lead}${drought ? "" : "only "}${fed} of your ${thirstyCrops(thirsty)} ${verb(fed, "gets", "get")} water${drought && water.well && !water.atCost ? " from your well" : ""}${drying === fed ? ", but only enough to survive at half yield" : drying ? `, and ${drying} of those dry to half yield` : ""}${drought ? "" : " at End turn"}; the other ${withering === 1 ? "one withers" : `${withering} wither`}.${water.atCost ? " Water at cost is 1 coin per thirsty crop at End turn." : ""}`;
  if (water.atCost)
    return `${lead}your ${thirstyCrops(thirsty)} ${verb(thirsty, "is", "are")} watered, 1 coin each at End turn.`;
  if (water.well)
    return `${lead}your well waters your ${thirstyCrops(thirsty)}.`;
  // Otherwise each thirsty crop has bought water, dries now, or dried before.
  const plots = thirstyPlots(state).map((i) => ({
    id: state.plotIds[i],
    dry: !!state.plots[i]!.dry,
  }));
  const bought = plots.filter(
      (p) => !p.dry && water.bought.includes(p.id),
    ).length,
    dried = plots.filter((p) => p.dry).length;
  const unless = policy.waterTrade ? " unless you buy water" : "";
  return `${lead}${[
    bought && `the water you bought keeps ${thirstyCrops(bought)} from drying`,
    drying &&
      `${bought ? others(drying) : thirstyCrops(drying)} will dry to half yield${unless}`,
    dried &&
      `${bought || drying ? others(dried) : `your ${thirstyCrops(dried)}`} already dried`,
  ]
    .filter(Boolean)
    .join("; ")}.`;
}

/** Facts the player needs this season, plus the water and price trades on offer. */
export function councilFacts(
  state: MicroState & { crises?: CrisisRecord[] },
  context: Context,
) {
  const { turn, policy, drought = false } = context;
  const facts: string[] = [];
  const water = waterFact(state, context);
  if (water) facts.push(water);
  if (state.owed)
    facts.push(`You owe ${state.owed} coins. Income pays it first.`);
  if (state.held)
    facts.push(`Held sales: ${state.held} coins, paid next season.`);
  if (policy.quota !== undefined)
    facts.push(
      `Sales allowed: ${salesThisTurn(state, turn)} of ${policy.quota} this season.`,
    );
  if (policy.permitsRequired)
    facts.push(
      `Planting permit: ${state.permits?.includes(turn) ? "granted for this season" : "none this season"}; next season's ${state.permits?.includes(turn + 1) ? "is filed" : "is not filed"}.`,
    );
  if (state.contract && state.contract.until >= turn)
    facts.push(
      `Price locked at ${percent(state.contract.mult)} through ${when(state.contract.until)}.`,
    );
  if (policy.assignedCrops?.length)
    facts.push(
      `Crop you may plant this season: ${names(policy.assignedCrops)}.`,
    );
  if (policy.recoveringCrops?.length)
    facts.push(
      `Recovering from blight: ${names(policy.recoveringCrops)}. It cannot be planted yet.`,
    );
  // The multiplier a sale uses: fixed prices cap it, as in priceSale.
  const prices = Object.entries(policy.cropPrices ?? {})
    .map(([id, mult]): [string, number] =>
      policy.priceCeiling !== undefined ||
      Object.hasOwn(policy.fixedPrices ?? {}, id)
        ? [id, Math.min(mult, policy.priceCeiling ?? 1)]
        : [id, mult],
    )
    .filter(([, mult]) => mult !== 1);
  const locked =
    state.contract &&
    state.contract.from <= turn &&
    turn <= state.contract.until;
  if (prices.length && !locked)
    facts.push(
      `Sale prices: ${
        new Set(prices.map(([, mult]) => mult)).size === 1 &&
        prices.length >= Object.keys(crops).length
          ? `everything at ${percent(prices[0][1])}`
          : prices
              .map(([id, mult]) => `${nameOf(id)} ${percent(mult)}`)
              .join(", ")
      }.`,
    );
  if (policy.waterTrade && !drought)
    facts.push(
      `In a drought you can buy water at ${policy.waterTrade.buy} coins or sell your rights at ${policy.waterTrade.sell} per thirsty crop.`,
    );
  if (policy.droughtWells)
    facts.push(
      `A working well waters your thirsty crops in a drought${policy.waterTrade ? ", unless you sell your water rights" : ""}.`,
    );
  if (policy.premiumSeed)
    facts.push(
      "Premium seed is offered when you plant an empty plot: it costs more and yields more, but some plantings fail.",
    );
  const trade = drought ? policy.waterTrade : undefined;
  const contract = state.contract && state.contract.until >= turn;
  const offer = contract ? undefined : policy.forwardContract;
  // Bought water reaches the crops growing when it was bought; a sale gives up the season's water.
  const traded = state.water?.turn === turn ? state.water : undefined;
  const thirsty = thirstyPlots(state)
    .filter((i) => !state.plots[i]!.dry)
    .map((i) => state.plotIds[i]);
  const unwatered =
    traded?.choice === "bought"
      ? thirsty.filter((id) => !traded.plots.includes(id)).length
      : thirsty.length;
  return {
    facts,
    standing: councilState(state.crises).standing,
    water: trade && {
      thirsty: thirsty.length,
      /** Thirsty crops that bought water does not reach yet. */
      unwatered,
      buy: trade.buy * unwatered,
      sell: trade.sell * thirsty.length,
      traded: traded?.choice,
      /** A well or water at cost already keeps every thirsty crop from drying. */
      covered:
        traded?.choice !== "sold" &&
        !!(context.water?.atCost || context.water?.well),
    },
    lock: offer && {
      label: `Lock in ${percent(offer.mult)} for ${Math.min(offer.seasons, 161 - turn)} season${Math.min(offer.seasons, 161 - turn) === 1 ? "" : "s"}`,
    },
  };
}
