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

// Keep the existing save format stable. Only this integration layer joins domains.
export type GameState = { version: 1 } & MicroState & MacroState;
export const initialState = (): GameState => ({
  version: 1,
  ...initialMicroState(),
  ...initialMacroState(),
});
export function parseState(value: unknown): GameState {
  if (!value || typeof value !== "object")
    throw new Error("State must be an object.");
  if ((value as Record<string, unknown>).version !== 1)
    throw new Error("Use version 1.");
  return { version: 1, ...parseMicroState(value), ...parseMacroState(value) };
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
