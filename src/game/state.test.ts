import { initialMicroState } from "../micro/state";
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
    { ...initialState(), version: 3 },
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
    const micro = replaceDomain(start, "micro", {
      ...start,
      coins: 900,
      year: 40,
    });
    expect(micro).toEqual({ ...start, coins: 900 });
    const macro = replaceDomain(micro, "macro", {
      year: 20,
      season: "fall",
      coins: 0,
    });
    expect(macro).toEqual({ ...micro, year: 20, season: "fall" });
    expect(start).toEqual(initialState());
    expect(readDomain(macro, "micro")).toEqual({
      ...initialMicroState(),
      coins: 900,
    });
    expect(readDomain(macro, "macro")).toEqual({ year: 20, season: "fall" });
    expect(() => replaceDomain(macro, "micro", { coins: -1 })).toThrow();
  });
});

it("migrates a legacy save without losing money or calendar", () => {
  expect(
    parseState({ version: 1, coins: 77, year: 20, season: "fall" }),
  ).toEqual({
    ...initialState(),
    coins: 77,
    year: 20,
    season: "fall",
  });
});
it("requires complete farm data in version 2", () => {
  expect(() =>
    parseState({ version: 2, coins: 77, year: 20, season: "fall" }),
  ).toThrow();
});
it("farm actions compose without changing the macro calendar", async () => {
  const { actOnFarm } = await import("../micro/rules");
  const start = { ...initialState(), year: 20, season: "fall" as const };
  const next = replaceDomain(
    start,
    "micro",
    actOnFarm(start, { type: "plant", plot: 0, crop: "corn" }).state,
  );
  expect(readDomain(next, "macro")).toEqual(readDomain(start, "macro"));
  expect(next.coins).toBe(88);
});
