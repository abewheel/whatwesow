import { expect, it } from "vitest";
import {
  homesteadMicroState as initialMicroState,
  parseMicroState,
  seedCost,
  harvestValue,
} from "./state";
import { actOnFarm, growCrops, completeUpgrades } from "./rules";
import { applyFarmConsequences } from "./consequences";
function establishedFarm() {
  return parseMicroState({
    ...initialMicroState(),
    harvests: {
      radish: 0,
      tomato: 0,
      pumpkin: 0,
      turnip: 300,
      carrot: 1,
      corn: 12,
    },
    opportunities: ["well", "market", "hall", "greenhouse"],
  });
}
it("allows repeated builds and aggregates benefits without one-per-type caps", () => {
  let state = { ...establishedFarm(), coins: 10000 };
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
  const state = { ...establishedFarm(), coins: 1000 };
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
    { turn: 1, policy: { costMultiplier: 0.5 } },
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
  let state = { ...establishedFarm(), coins: 1000 };
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
  let state = actOnFarm(establishedFarm(), {
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
it("drops the crop history of removed plots and refuses taken cells", () => {
  let state = actOnFarm(establishedFarm(), {
    type: "plant",
    plot: 0,
    crop: "turnip",
  }).state;
  state = actOnFarm(state, { type: "plant", plot: 1, crop: "turnip" }).state;
  expect(state.lastCrops).toEqual({ "1": "turnip", "2": "turnip" });
  const removed = applyFarmConsequences(state, { removePlotIds: [1] }).state;
  expect(removed.lastCrops).toEqual({ "2": "turnip" });
  const taken = { takenCells: [state.plotCells[1], { row: 0, col: 0 }] };
  expect(applyFarmConsequences(state, {}, taken).losses.plots).toEqual([2]);
  expect(() =>
    actOnFarm(state, { type: "harvest", plot: 1 }, { turn: 1, policy: taken }),
  ).toThrow(/outside/);
  expect(() =>
    actOnFarm(
      state,
      { type: "expand", cell: { row: 0, col: 0 } },
      { turn: 1, policy: taken },
    ),
  ).toThrow(/unoccupied/);
  expect(growCrops(state, taken).plots[1]).toEqual(state.plots[1]);
});
it("clears crops by stable ID while keeping their plots", () => {
  const state = {
    ...establishedFarm(),
    plots: [
      { crop: "corn" as const, growth: 1 },
      { crop: "turnip" as const, growth: 1 },
      ...establishedFarm().plots.slice(2),
    ],
  };
  const result = applyFarmConsequences(state, {
    clearPlotIds: [state.plotIds[0], 99],
  });
  expect(result.state.plots.slice(0, 2)).toEqual([
    null,
    { crop: "turnip", growth: 1 },
  ]);
  expect(result.state.plotIds).toEqual(state.plotIds);
  expect(result.losses).toEqual({ structures: [], plots: [] });
  expect(() => applyFarmConsequences(state, { clearPlotIds: [0] })).toThrow(
    /valid IDs/,
  );
});
