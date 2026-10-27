import { expect, it } from "vitest";
import { presetState } from "./presets";
import { parseState } from "../game/state";
import { turnNumber } from "../macro/state";
it("provides valid construction scenarios with supported layouts at each era", () => {
  for (const [id, turn] of [
    ["homestead", 1],
    ["community", 25],
    ["industry", 81],
    ["legacy", 159],
    ["restricted", 25],
  ] as const) {
    const state = presetState(id);
    expect(parseState(state)).toEqual(state);
    expect(turnNumber(state)).toBe(turn);
  }
});
