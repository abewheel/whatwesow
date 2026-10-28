import { expect, test } from "vitest";
import {
  advanceSeason,
  actOnGame,
  homesteadState,
  parseState,
  replaceDomain,
} from "./state";

test("old saves default to male and reject invalid character variants", () => {
  expect(parseState(homesteadState()).farmerVariant).toBeUndefined();
  expect(() =>
    parseState({ ...homesteadState(), farmerVariant: "unknown" }),
  ).toThrow("Invalid farmer variant.");
});
test("female selection survives actions, season changes, parsing and domain edits", () => {
  const farm = homesteadState();
  const state = parseState({
    ...farm,
    seeds: { ...farm.seeds, turnip: 1 },
    farmerVariant: "female",
  });
  const planted = actOnGame(state, {
    type: "plant",
    plot: 0,
    crop: "turnip",
  }).state;
  expect(planted.farmerVariant).toBe("female");
  expect(advanceSeason(planted).state.farmerVariant).toBe("female");
  expect(
    replaceDomain(state, "macro", { year: 2, season: "spring" }).farmerVariant,
  ).toBe("female");
});
