import { expect, it } from "vitest";
import { initialMicroState, seedCost, harvestValue } from "./state";
import { actOnFarm, growCrops, completeUpgrades } from "./rules";
import { applyFarmConsequences } from "./consequences";
it("allows repeated builds and aggregates benefits without one-per-type caps", () => {
  let state = { ...initialMicroState(), coins: 10000 };
  for (const row of [1, 4, 7, 20])
    state = actOnFarm(
      state,
      { type: "build", kind: "barn", cell: { row, col: 1 } },
      25,
    ).state;
  expect(state.structures.filter((s) => s.kind === "barn")).toHaveLength(4);
  expect(harvestValue(state, "turnip")).toBe(9);
  state = completeUpgrades(state);
  expect(harvestValue(state, "turnip")).toBe(17);
});
it("accepts policy inputs for gates, quantities, land, prices and output", () => {
  const state = { ...initialMicroState(), coins: 1000 };
  expect(() =>
    actOnFarm(
      state,
      { type: "build", kind: "shed", cell: { row: 0, col: 0 } },
      { turn: 1, policy: { blockedBuildings: ["shed"] } },
    ),
  ).toThrow(/restricted/);
  expect(() =>
    actOnFarm(
      state,
      { type: "build", kind: "shed", cell: { row: 0, col: 0 } },
      { turn: 1, policy: { buildingLimits: { shed: 0 } } },
    ),
  ).toThrow(/limits/);
  expect(() =>
    actOnFarm(
      state,
      { type: "expand", cell: { row: 0, col: 0 } },
      { turn: 1, policy: { maxPlots: 9 } },
    ),
  ).toThrow();
  expect(() =>
    actOnFarm(
      state,
      { type: "expand", cell: { row: 0, col: 0 } },
      {
        turn: 1,
        policy: { land: [{ row: 15, col: 15, width: 5, height: 5 }] },
      },
    ),
  ).toThrow();
  const early = actOnFarm(
    state,
    { type: "build", kind: "barn", cell: { row: 0, col: 0 } },
    { turn: 1, policy: { unlockTurns: { barn: 1 }, costMultiplier: 0.5 } },
  ).state;
  expect(early.coins).toBe(700);
  let planted = actOnFarm(
    state,
    { type: "plant", plot: 0, crop: "turnip" },
    { turn: 1, policy: { costMultiplier: 2 } },
  ).state;
  expect(planted.coins).toBe(992);
  planted = growCrops(planted);
  expect(
    actOnFarm(
      planted,
      { type: "harvest", plot: 0 },
      { turn: 1, policy: { productionMultiplier: 0.5 } },
    ).state.coins,
  ).toBe(996);
});
it("removes by stable IDs, revokes land including whole footprints, and stops removed benefits", () => {
  let state = { ...initialMicroState(), coins: 1000 };
  state = actOnFarm(state, {
    type: "build",
    kind: "shed",
    cell: { row: 0, col: 0 },
  }).state;
  state = completeUpgrades(state);
  state = actOnFarm(state, { type: "plant", plot: 0, crop: "corn" }).state;
  const id = state.structures.at(-1)!.id,
    plotId = state.plotIds[0];
  expect(seedCost(state, "corn")).toBe(11);
  const result = applyFarmConsequences(state, {
    removeStructureIds: [id],
    removePlotIds: [plotId],
    coinDelta: -10,
  });
  expect(result.losses).toEqual({ structures: [id], plots: [plotId] });
  expect(result.state.plots).toHaveLength(8);
  expect(result.state.plotIds).not.toContain(plotId);
  expect(seedCost(result.state, "corn")).toBe(12);
  expect(state.plots).toHaveLength(9);
  const rebuilt = actOnFarm(result.state, {
    type: "build",
    kind: "shed",
    cell: { row: 0, col: 0 },
  }).state;
  expect(rebuilt.structures.at(-1)!.id).toBeGreaterThan(id);
  const revoked = applyFarmConsequences(rebuilt, {}, { land: [] });
  expect(revoked.state.structures).toHaveLength(0);
  expect(revoked.state.plots).toHaveLength(0);
  expect(revoked.state.nextStructureId).toBe(rebuilt.nextStructureId);
  let recovering = { ...revoked.state, coins: 0 };
  for (let i = 0; i < 9; i++)
    recovering = actOnFarm(recovering, { type: "work" }).state;
  recovering = actOnFarm(recovering, {
    type: "expand",
    cell: { row: 10, col: 10 },
  }).state;
  expect(recovering.plotIds[0]).toBeGreaterThan(plotId);
  expect(() =>
    actOnFarm(
      { ...state, coins: 0 },
      { type: "work" },
      { turn: 1, policy: { allowWork: false } },
    ),
  ).toThrow();
});
it("relocates planted plots by stable ID without losing crop growth", () => {
  let state = actOnFarm(initialMicroState(), {
    type: "plant",
    plot: 0,
    crop: "corn",
  }).state;
  state = growCrops(state);
  const moved = actOnFarm(state, {
    type: "movePlot",
    id: state.plotIds[0],
    cell: { row: 25, col: 25 },
  }).state;
  expect(moved.plots[0]).toEqual({ crop: "corn", growth: 1 });
  expect(moved.plotCells[0]).toEqual({ row: 25, col: 25 });
  expect(moved.plotIds).toEqual(state.plotIds);
  expect(moved.coins).toBe(state.coins);
});
