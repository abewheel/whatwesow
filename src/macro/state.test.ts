import { expect, it } from "vitest";
import { initialMacroState, parseMacroState } from "./state";
it("accepts every season across the lifetime boundaries", () => {
  for (const year of [1, 20, 40])
    for (const season of ["spring", "summer", "fall", "winter"])
      expect(parseMacroState({ year, season })).toEqual({ year, season });
  expect(() => parseMacroState({ year: 41, season: "spring" })).toThrow();
  expect(initialMacroState()).toEqual({ year: 1, season: "spring" });
});
