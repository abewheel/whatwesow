import { describe, expect, it } from "vitest";
import { initialState, parseState } from "./state";
describe("save boundary", () => {
  it("round trips the initial state", () =>
    expect(parseState(JSON.parse(JSON.stringify(initialState())))).toEqual(
      initialState(),
    ));
  it.each([
    null,
    {},
    { ...initialState(), version: 2 },
    { ...initialState(), year: 41 },
    { ...initialState(), year: 1.5 },
    { ...initialState(), season: "rainy" },
    { ...initialState(), coins: -1 },
    { ...initialState(), coins: Infinity },
  ])("rejects invalid saves: %j", (value) =>
    expect(() => parseState(value)).toThrow(),
  );
  it("drops unknown properties at import", () =>
    expect(parseState({ ...initialState(), extra: true })).toEqual(
      initialState(),
    ));
});
