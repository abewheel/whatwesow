import { growCrops, completeUpgrades } from "../micro/rules";
import {
  applyFarmConsequences,
  type FarmConsequences,
} from "../micro/consequences";
import { policyProduction } from "../micro/world";
import { initialPlotCells, seasonalIncome } from "../micro/world";
import { seasons, nextSeason, turnNumber } from "../macro/state";
import {
  initialMicroState,
  parseMicroState,
  type MicroState,
} from "../micro/state";
import {
  initialMacroState,
  parseMacroState,
  type MacroState,
} from "../macro/state";
export { seasons } from "../macro/state";

// Only integration joins domains and migrates older save envelopes.
export type GameState = { version: 3 } & MicroState & MacroState;
export const initialState = (): GameState => ({
  version: 3,
  ...initialMicroState(),
  ...initialMacroState(),
});
export function parseState(value: unknown): GameState {
  if (!value || typeof value !== "object")
    throw new Error("State must be an object.");
  const saved = value as Record<string, unknown>;
  if (saved.version === 1) {
    return {
      version: 3,
      ...initialMicroState(),
      coins: parseLegacyCoins(saved.coins),
      ...parseMacroState(saved),
    };
  }
  if (saved.version === 2) {
    if (
      !Array.isArray(saved.plots) ||
      saved.plots.length < 9 ||
      saved.plots.length > 49
    )
      throw new Error("Legacy saves need 9–49 plots.");
    return {
      version: 3,
      ...parseMicroState({
        ...saved,
        plotCells: initialPlotCells(saved.plots.length),
        plotIds: Array.from({ length: saved.plots.length }, (_, i) => i + 1),
        nextPlotId: saved.plots.length + 1,
        nextStructureId: 2,
        structures: initialMicroState().structures,
      }),
      ...parseMacroState(saved),
    };
  }
  if (saved.version !== 3) throw new Error("Use version 1, 2 or 3.");
  return { version: 3, ...parseMicroState(value), ...parseMacroState(value) };
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
      ? { pendingSoilUpgrade: undefined, ...parseMicroState(value) }
      : { farmPolicy: undefined, ...parseMacroState(value) }),
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
  const macro = nextSeason(current);
  const farm = completeUpgrades(growCrops(current, current.farmPolicy));
  const income = policyProduction(seasonalIncome(farm), current.farmPolicy);
  const next = parseState({
    ...current,
    ...farm,
    pendingSoilUpgrade: farm.pendingSoilUpgrade,
    ...macro,
    coins: current.coins + income,
  });
  return {
    state: next,
    message: `Turn ${turnNumber(next)}/160 · Year ${next.year}, ${seasons[(turnNumber(next) - 1) % 4]}. Crops grew. Ready crops keep until harvest. Seasonal income: +${income} coins.`,
  };
}

export const farmContext = (state: GameState) => ({
  turn: turnNumber(state),
  policy: state.farmPolicy ?? {},
});
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
    }),
    losses: result.losses,
  };
}
