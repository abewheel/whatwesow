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
export type GameState = { version: 2 } & MicroState & MacroState;
export const initialState = (): GameState => ({
  version: 2,
  ...initialMicroState(),
  ...initialMacroState(),
});
export function parseState(value: unknown): GameState {
  if (!value || typeof value !== "object")
    throw new Error("State must be an object.");
  const saved = value as Record<string, unknown>;
  if (saved.version === 1) {
    return {
      version: 2,
      ...initialMicroState(),
      coins: parseLegacyCoins(saved.coins),
      ...parseMacroState(saved),
    };
  }
  if (saved.version !== 2) throw new Error("Use version 1 or 2.");
  return { version: 2, ...parseMicroState(value), ...parseMacroState(value) };
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
    ...(domain === "micro" ? parseMicroState(value) : parseMacroState(value)),
  });
}

function parseLegacyCoins(coins: unknown): number {
  if (!Number.isSafeInteger(coins) || Number(coins) < 0)
    throw new Error("Use a nonnegative whole coin balance.");
  return coins as number;
}
