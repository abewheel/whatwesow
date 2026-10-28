import { describe, expect, it } from "vitest";
import {
  advanceSeason,
  initialState,
  parseState,
  applyMacroChange,
} from "./state";
import { actOnFarm } from "../micro/rules";
import { serviceLocations, canPlace } from "../micro/world";

describe("permanent beehive", () => {
  it("rescues a broke farm once per season, persists collection, and renews in winter", () => {
    let farm = { ...initialState(), coins: 0 };
    for (let season = 0; season < 4; season++) {
      const before = farm.coins;
      farm = { ...farm, ...actOnFarm(farm, { type: "collectHoney" }).state };
      expect(farm.coins).toBe(before + 12);
      farm = parseState(JSON.parse(JSON.stringify(farm)));
      expect(() => actOnFarm(farm, { type: "collectHoney" })).toThrow(
        "Return next season",
      );
      farm = advanceSeason(farm).state;
      expect(farm.honeyReady).toBe(true);
    }
  });
  it("adds ready honey to old saves and validates its saved state", () => {
    expect(parseState(initialState()).honeyReady).toBe(true);
    expect(
      parseState({ version: 1, coins: 0, year: 1, season: "spring" })
        .honeyReady,
    ).toBe(true);
    expect(() => parseState({ ...initialState(), honeyReady: "yes" })).toThrow(
      "honey",
    );
  });
  it("keeps the wild hive fixed at the top vertex without consuming land, even on occupied estates", () => {
    const farm = initialState();
    const hive = serviceLocations(farm).find((s) => s.id === "hive")!;
    expect(hive.tent).toBe(false);
    expect(hive).toMatchObject({ row: -1, col: -1 });
    expect(canPlace(farm, { row: 0, col: 0 }, 1, 1)).toBe(true);
    expect(
      serviceLocations({ ...farm, plotCells: [{ row: 0, col: 0 }] }).find(
        (s) => s.id === "hive",
      ),
    ).toEqual(hive);
    expect(canPlace(farm, hive, 1, 1)).toBe(false);
    const changed = applyMacroChange(farm, {
      ...farm,
      farmPolicy: { allowWork: false, productionMultiplier: 0 },
    }).state;
    expect(serviceLocations(changed).find((s) => s.id === "hive")).toEqual(
      hive,
    );
    expect(
      actOnFarm(
        changed,
        { type: "collectHoney" },
        { turn: 1, policy: changed.farmPolicy },
      ).state.coins,
    ).toBe(farm.coins + 12);
  });
});

describe("buildable wooden hives", () => {
  it("charges 120 coins, finishes next season, and pays 15 per seasonal collection", () => {
    const start = initialState();
    const built = actOnFarm(start, {
      type: "build",
      kind: "beehive",
      cell: { row: 6, col: 6 },
    }).state;
    expect(built.coins).toBe(start.coins - 120);
    expect(built.structures[0]).toMatchObject({
      kind: "beehive",
      pendingConstruction: true,
      footprint: { width: 2, height: 2 },
    });
    const id = built.structures[0].id;
    expect(() => actOnFarm(built, { type: "collectHive", id })).toThrow();
    expect(() =>
      actOnFarm(
        { ...start, coins: 119 },
        { type: "build", kind: "beehive", cell: { row: 6, col: 6 } },
      ),
    ).toThrow("Not enough coins");
    let farm = advanceSeason({ ...start, ...built }).state;
    expect(farm.coins).toBe(built.coins);
    for (let harvest = 0; harvest < 8; harvest++) {
      const before = farm.coins;
      farm = { ...farm, ...actOnFarm(farm, { type: "collectHive", id }).state };
      expect(farm.coins).toBe(before + 15);
      expect(farm.honeyReady).toBe(true);
      expect(() => actOnFarm(farm, { type: "collectHive", id })).toThrow(
        "Return next season",
      );
      farm = parseState(JSON.parse(JSON.stringify(farm)));
      expect(farm.structures[0].product).toBe(false);
      farm = advanceSeason(farm).state;
    }
    expect(farm.coins).toBe(start.coins);
  });
  it("keeps collection state through movement and applies normal production policies", () => {
    const start = initialState();
    const built = actOnFarm(start, {
      type: "build",
      kind: "beehive",
      cell: { row: 6, col: 6 },
    }).state;
    const farm = advanceSeason({ ...start, ...built }).state;
    const id = farm.structures[0].id;
    const collected = actOnFarm(
      farm,
      { type: "collectHive", id },
      { turn: 2, policy: { productionMultiplier: 2 } },
    ).state;
    expect(collected.coins).toBe(farm.coins + 30);
    const moved = actOnFarm(collected, {
      type: "move",
      id,
      cell: { row: 9, col: 6 },
    }).state;
    expect(moved.structures[0].product).toBe(false);
    expect(() => actOnFarm(moved, { type: "collectHive", id })).toThrow();
    expect(() =>
      parseState({
        ...farm,
        structures: [{ ...farm.structures[0], product: "ready" }],
      }),
    ).toThrow("readiness");
  });
});

it("sells built-hive honey through council tax, debt and quotas while wild honey stays available", () => {
  const start = { ...initialState(), coins: 1000 };
  let built = actOnFarm(start, {
    type: "build",
    kind: "beehive",
    cell: { row: 6, col: 6 },
  }).state;
  built = actOnFarm(built, {
    type: "build",
    kind: "beehive",
    cell: { row: 9, col: 6 },
  }).state;
  const farm = advanceSeason({ ...start, ...built, coins: 0, owed: 20 }).state;
  const context = { turn: 2, policy: { harvestTax: 0.2, quota: 1 } };
  const first = actOnFarm(farm, { type: "collectHive", id: 1 }, context).state;
  expect(first.coins).toBe(0);
  expect(first.owed).toBe(8);
  expect(first.seasonSales).toEqual({ turn: 2, count: 1 });
  const second = actOnFarm(
    first,
    { type: "collectHive", id: 2 },
    context,
  ).state;
  expect(second.coins).toBe(0);
  expect(second.owed).toBe(8);
  const wild = actOnFarm(second, { type: "collectHoney" }, context).state;
  expect(wild.coins).toBe(12);
  expect(wild.owed).toBe(8);
});
