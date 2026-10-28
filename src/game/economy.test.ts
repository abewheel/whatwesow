import { expect, it } from "vitest";
import {
  initialState,
  advanceSeason,
  farmContext,
  replaceDomain,
  type GameState,
} from "./state";
import {
  actOnFarm,
  growCrops,
  completeUpgrades,
  type FarmAction,
} from "../micro/rules";
import {
  canBuild,
  totalHarvests,
  upgradeRemaining,
} from "../micro/progression";
import {
  canPlant,
  crops,
  expansionCost,
  seedCost,
  growthSeasons,
  soilCost,
  type CropId,
} from "../micro/state";
import {
  buildings,
  occupiedCells,
  footprint,
  cellKey,
  constructionCost,
  upgradeCost,
  type BuildingKind,
  type Structure,
} from "../micro/world";

it("earns the complete farming progression within a lifetime from the bare starting farm", () => {
  let state = initialState();
  const earned: Partial<Record<BuildingKind, number>> = {};
  const act = (action: FarmAction) => {
    state = replaceDomain(
      state,
      "micro",
      actOnFarm(state, action, farmContext(state)).state,
    );
  };
  const site = (kind: BuildingKind) => {
    const item = buildings[kind];
    const used = occupiedCells(state);
    for (let row = 22; row < 60; row++)
      for (let col = 10; col < 60; col++)
        if (
          footprint({ row, col }, item.width, item.height).every(
            (cell) => !used.has(cellKey(cell)),
          )
        )
          return { row, col };
    throw new Error("No building site");
  };
  act({ type: "build", kind: "home", cell: { row: 10, col: 17 } });
  for (let turn = 1; turn <= 160; turn++) {
    for (let plot = 0; plot < state.plots.length; plot++) {
      const crop = state.plots[plot];
      if (crop && crop.growth === crops[crop.crop].steps)
        act({ type: "harvest", plot });
    }
    if (turn < 150) {
      // Keep enough working cash to sow the next season. No grants or state edits.
      const reserve = Math.max(12, state.plots.length * 12);
      while (
        state.plots.length < 24 &&
        state.coins >= expansionCost(state) + reserve
      ) {
        const n = state.plots.length;
        act({
          type: "expand",
          cell: { row: 14 + Math.floor(n / 6), col: 13 + (n % 6) },
        });
      }
      const soil = `soil${state.soilLevel + 1}` as const;
      if (
        state.soilLevel < 3 &&
        !state.pendingSoilUpgrade &&
        state.opportunities.includes(soil as "soil1") &&
        state.coins >= soilCost(state) + reserve
      )
        act({ type: "improve" });
      for (const kind of [
        "shed",
        "well",
        "barn",
        "mill",
        "greenhouse",
        "market",
        "hall",
      ] as BuildingKind[]) {
        if (
          !state.structures.some((s) => s.kind === kind) &&
          canBuild(state, kind) &&
          state.coins >= constructionCost(state, kind) + reserve
        ) {
          act({ type: "build", kind, cell: site(kind) });
          earned[kind] = turn;
        }
      }
      for (const b of [...state.structures])
        if (
          b.level < buildings[b.kind].levels &&
          !b.pendingConstruction &&
          !b.pendingUpgrade &&
          upgradeRemaining(state, b) === 0 &&
          state.coins >= upgradeCost(b) + reserve
        )
          act({ type: "upgrade", id: b.id });
    }
    for (let plot = 0; plot < state.plots.length; plot++) {
      if (state.plots[plot]) continue;
      const crop: CropId | undefined = (
        ["corn", "carrot", "turnip"] as CropId[]
      ).find(
        (c) =>
          canPlant(c, turn) &&
          (c !== "corn" || state.opportunities.includes("corn")) &&
          // Establish both early crop types before specializing.
          !(c === "carrot" && state.harvests.turnip === 0 && turn === 1) &&
          state.coins >= seedCost(state, c),
      );
      if (crop) {
        act({ type: "buySeeds", crop, quantity: 1 });
        act({ type: "plant", plot, crop });
      }
    }
    expect(state.coins).toBeGreaterThanOrEqual(0);
    if (turn < 160) state = advanceSeason(state).state;
  }
  console.info("Lifetime economy", {
    earned,
    coins: state.coins,
    harvests: totalHarvests(state),
    plots: state.plots.length,
  });
  expect(Object.keys(earned)).toHaveLength(7);
  expect(earned.market).toBeLessThan(120);
  expect(earned.hall).toBeLessThan(150);
  expect(state.year).toBe(40);
  expect(state.season).toBe("winter");
  expect(state.plots.every((p) => p === null)).toBe(true);
  expect(
    state.structures.every((s) => !s.pendingConstruction && !s.pendingUpgrade),
  ).toBe(true);
  expect(() => advanceSeason(state)).toThrow();
}, 15000);

for (const crop of ["turnip", "carrot", "corn"] as CropId[]) {
  it.each([
    ["bare land", []],
    ["a completed well", [{ id: 1, kind: "well", row: 0, col: 0, level: 1 }]],
    [
      "a commissioned well",
      [
        {
          id: 1,
          kind: "well",
          row: 0,
          col: 0,
          level: 1,
          pendingConstruction: true,
        },
      ],
    ],
    [
      "an upgrade underway",
      [{ id: 1, kind: "well", row: 0, col: 0, level: 1, pendingUpgrade: true }],
    ],
    ["a level two well", [{ id: 1, kind: "well", row: 0, col: 0, level: 2 }]],
  ] as [string, Structure[]][])(
    `forecasts ${crop} growth with %s`,
    (_name, structures) => {
      let farm = {
        ...initialState(),
        structures,
        plots: [{ crop, growth: 0 }],
        plotCells: [{ row: 16, col: 16 }],
        plotIds: [1],
        nextPlotId: 2,
        nextStructureId: 2,
      };
      const forecast = growthSeasons(farm, crop);
      let seasons = 0;
      while (farm.plots[0].growth < crops[crop].steps) {
        farm = { ...farm, ...completeUpgrades(growCrops(farm)) } as typeof farm;
        seasons++;
        expect(seasons).toBeLessThanOrEqual(3);
      }
      expect(forecast).toBe(seasons);
    },
  );
}

it("prices repeated facilities against installed and already commissioned capacity", () => {
  const state: GameState = {
    ...initialState(),
    structures: [
      { id: 1, kind: "well", row: 0, col: 0, level: 1, pendingUpgrade: true },
    ],
    nextStructureId: 2,
  };
  expect(constructionCost(state, "well")).toBe(540);
  expect(
    constructionCost(
      {
        ...state,
        structures: [
          { ...state.structures[0], pendingUpgrade: undefined, level: 2 },
        ],
      },
      "well",
    ),
  ).toBe(540);
  expect(
    constructionCost(
      {
        ...state,
        structures: [
          {
            ...state.structures[0],
            pendingUpgrade: undefined,
            pendingConstruction: true,
          },
        ],
      },
      "well",
    ),
  ).toBe(360);
});
