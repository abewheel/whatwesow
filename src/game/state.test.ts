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
    { ...initialState(), version: 4 },
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
it("migrates version 2 crops, soil, and money to unique placed plots", () => {
  const migrated = parseState({
    version: 2,
    year: 25,
    season: "winter",
    coins: 500,
    plots: Array(49).fill({ crop: "corn", growth: 2 }),
    soilLevel: 2,
  });
  expect(migrated.version).toBe(3);
  expect(migrated.plots).toHaveLength(49);
  expect(migrated.plots[48]).toEqual({ crop: "corn", growth: 2 });
  expect(migrated.soilLevel).toBe(2);
  expect(new Set(migrated.plotCells.map((c) => JSON.stringify(c))).size).toBe(
    49,
  );
  expect(readDomain(migrated, "macro")).toEqual({ year: 25, season: "winter" });
});
it("advances exactly 160 seasons and pays orchard income once per transition", async () => {
  const { advanceSeason } = await import("./state");
  const { turnNumber } = await import("../macro/state");
  let state = initialState();
  state.nextStructureId = 3;
  state.structures.push({ id: 2, kind: "apple", row: 0, col: 0, level: 1 });
  for (let turn = 2; turn <= 160; turn++) {
    state = advanceSeason(state).state;
    expect(turnNumber(state)).toBe(turn);
    expect(state.coins).toBe(100 + 6 * (turn - 1));
  }
  expect(state.year).toBe(40);
  expect(state.season).toBe("winter");
  expect(() => advanceSeason(state)).toThrow(/final/);
});
it("commits a macro policy and its losses atomically, then enforces it on farming", async () => {
  const { applyMacroChange, farmContext } = await import("./state");
  const { actOnFarm } = await import("../micro/rules");
  let state = { ...initialState(), coins: 1000 };
  state = replaceDomain(
    state,
    "micro",
    actOnFarm(state, { type: "build", kind: "shed", cell: { row: 0, col: 0 } })
      .state,
  );
  const result = applyMacroChange(
    state,
    {
      year: 2,
      season: "spring",
      farmPolicy: {
        land: [{ row: 15, col: 15, width: 3, height: 3 }],
        blockedBuildings: ["shed"],
      },
    },
    { removePlotIds: [state.plotIds[0]] },
  );
  expect(result.state.year).toBe(2);
  expect(result.losses.structures).toHaveLength(2);
  expect(result.state.plots).toHaveLength(8);
  expect(() =>
    actOnFarm(
      result.state,
      { type: "build", kind: "shed", cell: { row: 17, col: 17 } },
      farmContext(result.state),
    ),
  ).toThrow(/restricted/);
  expect(parseState(JSON.parse(JSON.stringify(result.state)))).toEqual(
    result.state,
  );
});
it("clears omitted optional macro policy when replacing that domain", () => {
  const state = { ...initialState(), farmPolicy: { allowWork: false } };
  const replaced = replaceDomain(state, "macro", { year: 2, season: "summer" });
  expect(readDomain(replaced, "macro")).toEqual({ year: 2, season: "summer" });
  expect(replaced.farmPolicy).toBeUndefined();
  expect(readDomain(replaced, "micro")).toEqual(readDomain(state, "micro"));
});
