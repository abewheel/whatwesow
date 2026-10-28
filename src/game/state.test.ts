import { homesteadMicroState as initialMicroState } from "../micro/state";
import { describe, expect, it } from "vitest";
import {
  homesteadState as initialState,
  parseState,
  readDomain,
  replaceDomain,
} from "./state";
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
  const start = {
    ...initialState(),
    year: 20,
    season: "fall" as const,
    opportunities: ["corn" as const],
  };
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
it("advances exactly 160 seasons and never pays fruit-tree income automatically", async () => {
  const { advanceSeason } = await import("./state");
  const { turnNumber } = await import("../macro/state");
  let state = initialState();
  state.nextStructureId = 3;
  state.structures.push({ id: 2, kind: "apple", row: 0, col: 0, level: 1 });
  for (let turn = 2; turn <= 160; turn++) {
    state = advanceSeason(state).state;
    expect(turnNumber(state)).toBe(turn);
    expect(state.coins).toBe(100);
  }
  expect(state.year).toBe(40);
  expect(state.season).toBe("winter");
  expect(() => advanceSeason(state)).toThrow(/final/);
});
it("commits a macro policy and its losses atomically, then enforces it on farming", async () => {
  const { applyMacroChange, farmContext } = await import("./state");
  const { actOnFarm } = await import("../micro/rules");
  let state: ReturnType<typeof initialState> = {
    ...initialState(),
    coins: 1000,
    opportunities: ["shed"],
  };
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

it("grows crops only across seasonal turns and pays crop coins at harvest", async () => {
  const { advanceSeason, farmContext } = await import("./state");
  const { actOnFarm } = await import("../micro/rules");
  const start = { ...initialState(), opportunities: ["corn" as const] };
  const planted = replaceDomain(
    start,
    "micro",
    actOnFarm(
      start,
      { type: "plant", plot: 0, crop: "carrot" },
      farmContext(start),
    ).state,
  );
  const summer = advanceSeason(planted).state;
  expect(summer.season).toBe("summer");
  expect(summer.plots[0]?.growth).toBe(1);
  expect(summer.coins).toBe(93);
  expect(() =>
    actOnFarm(
      summer,
      { type: "plant", plot: 1, crop: "corn" },
      farmContext(summer),
    ),
  ).toThrow(/spring/);
  const fall = advanceSeason(summer).state;
  expect(fall.plots[0]?.growth).toBe(2);
  expect(fall.coins).toBe(93);
  expect(
    actOnFarm(fall, { type: "harvest", plot: 0 }, farmContext(fall)).state
      .coins,
  ).toBe(111);
  expect(planted.plots[0]?.growth).toBe(0);
  expect(advanceSeason(fall).state.plots[0]).toBeNull();
});

it("charges upgrades once, persists pending work, then completes before new-turn benefits", async () => {
  const { advanceSeason, farmContext } = await import("./state");
  const { actOnFarm } = await import("../micro/rules");
  const { seedCost, harvestValue } = await import("../micro/state");
  let state = {
    ...initialState(),
    year: 4,
    coins: 1000,
    harvests: {
      radish: 0,
      tomato: 0,
      pumpkin: 0,
      turnip: 30,
      carrot: 1,
      corn: 12,
    },
  };
  state.structures.push(
    { id: 2, kind: "shed", row: 0, col: 0, level: 1 },
    { id: 3, kind: "apple", row: 0, col: 3, level: 1 },
  );
  state.nextStructureId = 4;
  for (const action of [
    { type: "upgrade", id: 2 },
    { type: "upgrade", id: 3 },
    { type: "improve" },
  ] as const)
    state = replaceDomain(
      state,
      "micro",
      actOnFarm(state, action, farmContext(state)).state,
    );
  expect(state.coins).toBe(680);
  expect(seedCost(state, "turnip")).toBe(3);
  expect(harvestValue(state, "turnip")).toBe(9);
  expect(() =>
    actOnFarm(state, { type: "upgrade", id: 2 }, farmContext(state)),
  ).toThrow(/underway/);
  expect(() =>
    actOnFarm(state, { type: "improve" }, farmContext(state)),
  ).toThrow(/underway/);
  const saved = parseState(JSON.parse(JSON.stringify(state)));
  expect(saved.structures[1].pendingUpgrade).toBe(true);
  expect(saved.pendingSoilUpgrade).toBe(true);
  const next = advanceSeason(saved).state;
  expect(next.coins).toBe(680);
  expect(seedCost(next, "turnip")).toBe(2);
  expect(harvestValue(next, "turnip")).toBe(12);
  expect(next.pendingSoilUpgrade).toBeUndefined();
  expect(next.structures[1].pendingUpgrade).toBeUndefined();
  expect(advanceSeason(next).state.soilLevel).toBe(1);
  expect(saved.soilLevel).toBe(0);
  expect(() =>
    actOnFarm({ ...next, coins: 10000 }, { type: "upgrade", id: 2 }, 160),
  ).toThrow(/next season/);
});

it("reserves and saves paid construction, activating benefits only next season", async () => {
  const { actOnFarm } = await import("../micro/rules");
  const { seedCost, harvestValue } = await import("../micro/state");
  const { seasonalIncome } = await import("../micro/world");
  const { advanceSeason, farmContext, applyMacroChange } =
    await import("./state");
  let state = {
    ...initialState(),
    year: 32,
    coins: 20000,
    harvests: {
      radish: 0,
      tomato: 0,
      pumpkin: 0,
      turnip: 160,
      carrot: 1,
      corn: 12,
    },
  };
  for (const [index, kind] of (
    ["shed", "barn", "market", "apple"] as const
  ).entries()) {
    state = replaceDomain(
      state,
      "micro",
      actOnFarm(
        state,
        { type: "build", kind, cell: { row: 0, col: index * 4 } },
        farmContext(state),
      ).state,
    );
  }
  expect(state.coins).toBe(16280);
  expect(seedCost(state, "turnip")).toBe(4);
  expect(harvestValue(state, "turnip")).toBe(9);
  expect(seasonalIncome(state)).toBe(0);
  expect(() =>
    actOnFarm(state, { type: "upgrade", id: 2 }, farmContext(state)),
  ).toThrow(/finish/);
  expect(() =>
    actOnFarm(
      state,
      { type: "build", kind: "shed", cell: { row: 0, col: 0 } },
      farmContext(state),
    ),
  ).toThrow(/occupied/);
  const saved = parseState(JSON.parse(JSON.stringify(state)));
  expect(saved.structures[1].pendingConstruction).toBe(true);
  const moved = replaceDomain(
    saved,
    "micro",
    actOnFarm(
      saved,
      { type: "move", id: 2, cell: { row: 5, col: 0 } },
      farmContext(saved),
    ).state,
  );
  expect(moved.structures[1].pendingConstruction).toBe(true);
  const next = advanceSeason(moved).state;
  expect(next.coins).toBe(16430);
  expect(seedCost(next, "turnip")).toBe(3);
  expect(harvestValue(next, "turnip")).toBe(11);
  expect(next.structures.every((s) => !s.pendingConstruction)).toBe(true);
  const lost = applyMacroChange(saved, saved, {
    removeStructureIds: [2, 3, 4, 5],
  }).state;
  expect(advanceSeason(lost).state.coins).toBe(16280);
  expect(() =>
    actOnFarm(
      next,
      { type: "build", kind: "shed", cell: { row: 10, col: 0 } },
      160,
    ),
  ).toThrow(/next season/);
});

it("harvests mature fruit each fall, keeps the tree, and never pays automatically", async () => {
  const { advanceSeason, farmContext } = await import("./state");
  const { actOnFarm } = await import("../micro/rules");
  const { hasRipeFruit } = await import("../micro/world");
  let state = {
    ...initialState(),
    year: 2,
    coins: 1000,
    harvests: {
      radish: 0,
      tomato: 0,
      pumpkin: 0,
      turnip: 6,
      carrot: 0,
      corn: 0,
    },
  };
  state = replaceDomain(
    state,
    "micro",
    actOnFarm(
      state,
      { type: "build", kind: "apple", cell: { row: 14, col: 18 } },
      farmContext(state),
    ).state,
  );
  const id = state.structures.at(-1)!.id;
  expect(() =>
    actOnFarm(state, { type: "harvestFruit", id }, farmContext(state)),
  ).toThrow(/no ripe product/);
  for (let season = 0; season < 14; season++)
    state = advanceSeason(state).state;
  expect(state.coins).toBe(940);
  expect(hasRipeFruit(state.structures.at(-1)!)).toBe(true);
  state = replaceDomain(
    state,
    "micro",
    actOnFarm(state, { type: "harvestFruit", id }, farmContext(state)).state,
  );
  expect(state.coins).toBe(964);
  expect(state.structures.at(-1)).toMatchObject({
    id,
    kind: "apple",
    product: false,
  });
  state = parseState(JSON.parse(JSON.stringify(state)));
  expect(() =>
    actOnFarm(state, { type: "harvestFruit", id }, farmContext(state)),
  ).toThrow(/no ripe product/);
  state = replaceDomain(
    state,
    "micro",
    actOnFarm(
      state,
      { type: "move", id, cell: { row: 18, col: 16 } },
      farmContext(state),
    ).state,
  );
  expect(hasRipeFruit(state.structures.at(-1)!)).toBe(false);
  for (let season = 0; season < 4; season++) state = advanceSeason(state).state;
  expect(state.coins).toBe(964);
  state.farmPolicy = { productionMultiplier: 0.5 };
  state.structures.at(-1)!.level = 2;
  expect(
    actOnFarm(state, { type: "harvestFruit", id }, farmContext(state)).state
      .coins,
  ).toBe(988);
  const unpicked = advanceSeason(advanceSeason(state).state).state;
  expect(unpicked.coins).toBe(964);
  expect(hasRipeFruit(unpicked.structures.at(-1)!)).toBe(true);
});

describe("crisis records in the save", () => {
  const drought = { id: "Drought", turn: 6, pick: "D-OBJ" };
  const atTurn6 = () => ({
    ...initialState(),
    year: 2,
    season: "summer" as const,
  });
  it("round trips answered and waiting records", () => {
    const state = {
      ...atTurn6(),
      year: 4,
      season: "spring" as const,
      crises: [drought, { id: "Blight", turn: 13, crop: "corn" }],
    };
    expect(parseState(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(readDomain(state, "macro")).toEqual({
      year: 4,
      season: "spring",
      crises: state.crises,
    });
  });
  it("loads saves without crisis records unchanged", () => {
    expect(parseState(initialState())).not.toHaveProperty("crises");
    expect(
      parseState({ version: 1, coins: 5, year: 2, season: "summer" }),
    ).not.toHaveProperty("crises");
  });
  it.each([
    [[{ id: "Blight", turn: 6 }], /run order/],
    [[{ id: "Drought", turn: 6, pick: "B-OBJ" }], /arguments/],
    [[{ id: "Drought", turn: 6, pick: "D-NOBODY" }], /arguments/],
    [[{ id: "Drought", turn: 6, crop: "wheat" }], /farm crop/],
    [
      [
        { id: "Drought", turn: 6 },
        { id: "Blight", turn: 13, pick: "B-OBJ" },
      ],
      /before the next/,
    ],
    [
      [
        drought,
        { id: "Blight", turn: 13, pick: "B-OBJ" },
        { id: "Eminent domain", turn: 17, pick: "E-LIB-P" },
        { id: "Overproduction", turn: 23, pick: "O-OBJ" },
      ],
      /before the next/,
    ],
  ])("rejects records %j", (crises, error) =>
    expect(() => parseState({ ...atTurn6(), year: 12, crises })).toThrow(error),
  );
  it("rejects records that fired after the save's season", async () => {
    const { applyMacroChange } = await import("./state");
    expect(() =>
      parseState({ ...atTurn6(), crises: [{ id: "Drought", turn: 7 }] }),
    ).toThrow("Crisis records cannot be later than the current season.");
    expect(
      parseState({ ...atTurn6(), crises: [{ id: "Drought", turn: 6 }] }).crises,
    ).toHaveLength(1);
    // Moving the clock back past a record in the macro editor is refused too.
    const state = { ...atTurn6(), crises: [drought] };
    expect(() =>
      applyMacroChange(state, { year: 1, season: "fall", crises: [drought] }),
    ).toThrow(/later than the current season/);
  });
  it("clears omitted records when replacing the macro domain and carries them through policy changes", async () => {
    const { applyMacroChange } = await import("./state");
    const state = { ...atTurn6(), crises: [drought] };
    expect(
      replaceDomain(state, "macro", { year: 2, season: "summer" }).crises,
    ).toBeUndefined();
    expect(
      replaceDomain(state, "micro", { ...state, crises: [] }).crises,
    ).toEqual([drought]);
    expect(applyMacroChange(state, state).state.crises).toEqual([drought]);
    expect(
      applyMacroChange(state, { year: 2, season: "summer" }).state.crises,
    ).toBeUndefined();
  });
  it("blocks the season change while the council waits for an answer", async () => {
    const { advanceSeason } = await import("./state");
    expect(() =>
      advanceSeason({ ...atTurn6(), crises: [{ id: "Drought", turn: 6 }] }),
    ).toThrow("The council is waiting for your answer.");
    const sold = [
      drought,
      { id: "Blight", turn: 13, pick: "B-OBJ", crop: "corn" },
      { id: "Eminent domain", turn: 17, pick: "E-LIB-P" },
    ];
    const pending = { ...atTurn6(), year: 5, crises: sold };
    expect(() => advanceSeason(pending)).toThrow(/waiting/);
    sold[2].pick = "E-LIB-P:decline";
    expect(advanceSeason(pending).state.crises).toEqual(sold);
  });
  it("derives the farm rules without writing them into the macro policy", async () => {
    const { farmContext } = await import("./state");
    const state = {
      ...atTurn6(),
      farmPolicy: { seedMultiplier: 2 },
      crises: [drought],
    };
    expect(farmContext(state)).toEqual({
      turn: 6,
      policy: { seedMultiplier: 2, waterTrade: { buy: 12, sell: 6 } },
      drought: true,
      water: {
        bought: [],
        sold: false,
        atCost: false,
        well: false,
        thirsty: 0,
        drying: 0,
        withering: 0,
      },
    });
    expect(state.farmPolicy).toEqual({ seedMultiplier: 2 });
  });
});
