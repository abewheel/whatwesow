import { enlargeBuildingLots } from "../micro/building-layout";
import {
  actOnFarm,
  growCrops,
  completeUpgrades,
  waterCrops,
  type FarmAction,
} from "../micro/rules";
import {
  applyFarmConsequences,
  type FarmConsequences,
} from "../micro/consequences";
import { charge, credit } from "../micro/money";
import { seasonTrees, policyProduction } from "../micro/world";
import { initialPlotCells, seasonalIncome } from "../micro/world";
import { nextSeason, turnNumber } from "../macro/state";
import {
  checkCrisisRecords,
  crisisRules,
  mergePolicy,
  pendingCrisis,
  seasonCharges,
  waterInput,
  waterSupply,
  type WaterSupply,
} from "./crisis-rules";
import {
  initialMicroState,
  homesteadMicroState,
  parseMicroState,
  thirstyPlots,
  type MicroState,
} from "../micro/state";
import {
  initialMacroState,
  parseMacroState,
  type MacroState,
} from "../macro/state";
export { seasons } from "../macro/state";

// Only integration joins domains and migrates older save envelopes.
export type GameState = {
  version: 3;
  buildingLayout?: 2;
  farmerVariant?: "male" | "female";
} & MicroState &
  MacroState;
export const initialState = (): GameState => ({
  version: 3,
  buildingLayout: 2,
  ...initialMicroState(),
  ...initialMacroState(),
});
export const homesteadState = (): GameState => ({
  version: 3,
  buildingLayout: 2,
  ...initialMacroState(),
  ...homesteadMicroState(),
});
export function parseState(value: unknown): GameState {
  if (!value || typeof value !== "object")
    throw new Error("State must be an object.");
  const saved = value as Record<string, unknown>;
  if (saved.version === 1) {
    return parseState({
      version: 3,
      ...homesteadMicroState(),
      coins: parseLegacyCoins(saved.coins),
      ...parseMacroState(saved),
    });
  }
  if (saved.version === 2) {
    if (
      !Array.isArray(saved.plots) ||
      saved.plots.length < 9 ||
      saved.plots.length > 49
    )
      throw new Error("Legacy saves need 9–49 plots.");
    return parseState({
      version: 3,
      ...parseMicroState({
        ...saved,
        plotCells: initialPlotCells(saved.plots.length),
        plotIds: Array.from({ length: saved.plots.length }, (_, i) => i + 1),
        nextPlotId: saved.plots.length + 1,
        nextStructureId: 2,
        structures: homesteadMicroState().structures,
      }),
      ...parseMacroState(saved),
    });
  }
  if (saved.version !== 3) throw new Error("Use version 1, 2 or 3.");
  if (saved.buildingLayout !== undefined && saved.buildingLayout !== 2)
    throw new Error("Invalid building layout version.");
  if (
    saved.farmerVariant !== undefined &&
    saved.farmerVariant !== "male" &&
    saved.farmerVariant !== "female"
  )
    throw new Error("Invalid farmer variant.");
  const macro = parseMacro(value),
    farm = parseMicroState(value);
  const state: GameState = {
    version: 3,
    buildingLayout: 2,
    ...farm,
    ...macro,
    ...(saved.farmerVariant
      ? { farmerVariant: saved.farmerVariant as "male" | "female" }
      : {}),
  };
  // Larger lots also keep off land the council's rules have taken.
  return saved.buildingLayout === 2
    ? state
    : { ...state, ...enlargeBuildingLots(farm, farmContext(state).policy) };
}
/** Macro checks record shapes; integration checks them against the crisis layer. */
function parseMacro(value: unknown): MacroState {
  const macro = parseMacroState(value);
  if (macro.crises) checkCrisisRecords(macro.crises, turnNumber(macro));
  return macro;
}
export type Domain = "micro" | "macro";
export function readDomain(
  state: GameState,
  domain: Domain,
): MicroState | MacroState {
  return domain === "micro" ? parseMicroState(state) : parseMacroState(state);
}
export function replaceDomain(
  state: GameState,
  domain: Domain,
  value: unknown,
): GameState {
  return parseState({
    ...state,
    ...(domain === "micro"
      ? {
          debris: undefined,
          pendingSoilUpgrade: undefined,
          owed: undefined,
          held: undefined,
          permits: undefined,
          lastCrops: undefined,
          seasonSales: undefined,
          water: undefined,
          contract: undefined,
          ...parseMicroState(value),
        }
      : {
          farmPolicy: undefined,
          crises: undefined,
          ...parseMacroState(value),
        }),
  });
}

function parseLegacyCoins(coins: unknown): number {
  if (!Number.isSafeInteger(coins) || Number(coins) < 0)
    throw new Error("Use a nonnegative whole coin balance.");
  return coins as number;
}

export function advanceSeason(state: GameState): {
  state: GameState;
  message: string;
} {
  const current = parseState(state);
  if (pendingCrisis(current))
    throw new Error("The council is waiting for your answer.");
  const macro = nextSeason(current);
  const turn = turnNumber(current),
    winter = macro.season === "winter";
  // The rules of the turn being left govern its season change.
  const rules = crisisRules(current, turn);
  const policy = mergePolicy(current.farmPolicy ?? {}, rules.policy);
  const supply = waterSupply(current, rules, policy, turn);
  const water = winter
    ? undefined
    : waterCrops(current, waterInput(rules.drought, supply));
  const { held = 0, ...farm } = completeUpgrades(
    growCrops(water?.state ?? current, policy, winter),
  );
  const income = policyProduction(seasonalIncome(farm, policy), policy);
  let paid = credit(farm, income + held);
  const notes = [
    water?.dried
      ? `Drought: ${plural(water.dried, "thirsty crop")} dried to half yield.`
      : "",
    water?.withered
      ? `${plural(water.withered, "thirsty crop")} withered without water.`
      : "",
    held ? `Held sales paid: +${held} coins.` : "",
    paid.toOwed ? `${paid.toOwed} paid toward what you owe.` : "",
  ];
  let short = 0;
  for (const [name, amount] of seasonCharges(
    current,
    rules,
    water?.watered ?? 0,
    supply.sold,
  )) {
    const bill = charge(paid.state, amount);
    paid = bill;
    short += bill.toOwed;
    notes.push(`${name}: −${amount} coin${amount === 1 ? "" : "s"}.`);
  }
  if (short) notes.push(`${short} added to what you owe.`);
  // Season sales, water trades, used permits and ended contracts belong to the turn left.
  const next = turn + 1,
    { permits, contract } = paid.state;
  const result = parseState({
    version: 3,
    buildingLayout: 2,
    ...paid.state,
    farmerVariant: current.farmerVariant,
    seasonSales: undefined,
    water: undefined,
    permits: permits?.filter((t) => t >= next),
    contract: contract && contract.until >= next ? contract : undefined,
    ...macro,
    honeyReady: true,
    structures: seasonTrees(farm.structures, macro.season),
  });
  return {
    state: result,
    message: [
      `${winter ? "Winter frost cleared all field crops. Trees remain." : "Crops grew. Harvest before winter frost."} Seasonal income: +${income} coins.`,
      ...notes,
    ]
      .filter(Boolean)
      .join(" "),
  };
}
const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** This season's water for thirsty crops, and what End turn will do to the ones growing now. */
export type WaterOutlook = WaterSupply & {
  /** Thirsty crops still growing. */
  thirsty: number;
  /** Of those, how many End turn dries to half yield, and how many wither. */
  drying: number;
  withering: number;
};
/** Farm rules now: the macro policy merged with the council's crisis rules, and this season's water. */
export const farmContext = (state: GameState) => {
  const turn = turnNumber(state);
  const rules = crisisRules(state, turn);
  const policy = mergePolicy(state.farmPolicy ?? {}, rules.policy);
  const supply = waterSupply(state, rules, policy, turn);
  // Winter clears the fields before any water matters, and turn 160 has no season change.
  const change =
    state.season === "fall" || turn === 160
      ? undefined
      : waterCrops(state, waterInput(rules.drought, supply));
  const water: WaterOutlook = {
    ...supply,
    thirsty: thirstyPlots(state).length,
    drying: change?.dried ?? 0,
    withering: change?.withered ?? 0,
  };
  return { turn, policy, drought: rules.drought, water };
};
/** A farm action under the rules now. The farm waits while the council does. */
export function actOnGame(
  state: GameState,
  action: FarmAction,
  context: ReturnType<typeof farmContext> = farmContext(state),
): { state: GameState; message: string } {
  if (pendingCrisis(state))
    throw new Error("The council is waiting for your answer.");
  const farm = actOnFarm(state, action, context);
  return {
    state: replaceDomain(state, "micro", farm.state),
    message: farm.message,
  };
}
/** Macro owns the decision and policy; this boundary commits its farming consequences together. */
export function applyMacroChange(
  state: GameState,
  nextMacro: MacroState,
  effects: FarmConsequences = {},
) {
  const macro = parseMacroState(nextMacro);
  const result = applyFarmConsequences(state, effects, macro.farmPolicy);
  return {
    state: parseState({
      ...state,
      ...result.state,
      ...macro,
      farmPolicy: macro.farmPolicy,
      crises: macro.crises,
    }),
    losses: result.losses,
  };
}
