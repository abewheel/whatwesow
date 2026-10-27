import { describe, expect, it } from "vitest";
import { initialState, parseState, readDomain, replaceDomain } from "./state";
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

describe("domain integration", () => {
  it("replaces only the owned fields without mutating the source", () => {
    const start = initialState();
    const micro = replaceDomain(start, "micro", { coins: 900, year: 40 });
    expect(micro).toEqual({ ...start, coins: 900 });
    const macro = replaceDomain(micro, "macro", {
      year: 20,
      season: "fall",
      coins: 0,
    });
    expect(macro).toEqual({ ...micro, year: 20, season: "fall" });
    expect(start).toEqual(initialState());
    expect(readDomain(macro, "micro")).toEqual({ coins: 900 });
    expect(readDomain(macro, "macro")).toEqual({ year: 20, season: "fall" });
    expect(() => replaceDomain(macro, "micro", { coins: -1 })).toThrow();
  });
});
