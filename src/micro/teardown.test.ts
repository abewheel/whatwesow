import { expect, it } from "vitest";
import { actOnFarm, completeUpgrades, growCrops } from "./rules";
import {
  homesteadMicroState,
  parseMicroState,
  seedCost,
  harvestValue,
} from "./state";
import {
  buildingLevel,
  canPlace,
  seasonalIncome,
  serviceLocations,
} from "./world";

it("reserves demolished lots until next season and stops every benefit without refund", () => {
  const start = parseMicroState({
    ...homesteadMicroState(),
    nextStructureId: 6,
    structures: [
      ...homesteadMicroState().structures,
      { id: 2, kind: "shed", row: 0, col: 0, level: 2 },
      { id: 3, kind: "market", row: 0, col: 5, level: 1 },
      { id: 4, kind: "well", row: 5, col: 0, level: 1 },
      { id: 5, kind: "barn", row: 5, col: 5, level: 1 },
    ],
  });
  let pending = start;
  for (const id of [2, 3, 4, 5])
    pending = actOnFarm(pending, { type: "teardown", id }).state;
  expect(pending.coins).toBe(start.coins);
  expect(seedCost(pending, "turnip")).toBe(4);
  expect(harvestValue(pending, "turnip")).toBe(9);
  expect(seasonalIncome(pending)).toBe(0);
  expect(buildingLevel(pending, "well")).toBe(0);
  expect(canPlace(pending, { row: 0, col: 0 })).toBe(false);
  expect(() => actOnFarm(pending, { type: "upgrade", id: 2 })).toThrow(
    /Teardown/,
  );
  expect(() => actOnFarm(pending, { type: "teardown", id: 2 })).toThrow(
    /already/,
  );
  const saved = parseMicroState(JSON.parse(JSON.stringify(pending)));
  const done = completeUpgrades(saved);
  expect(done.structures.map((s) => s.id)).toEqual([1]);
  expect(canPlace(done, { row: 0, col: 0 })).toBe(true);
  expect(done.coins).toBe(start.coins);
  expect(done.nextStructureId).toBe(6);
  expect(start.structures[1].pendingDemolition).toBeUndefined();
});

it("deletes planted fields immediately by stable ID without refund or ID reuse", () => {
  const start = actOnFarm(
    actOnFarm(homesteadMicroState(), {
      type: "buySeeds",
      crop: "carrot",
      quantity: 1,
    }).state,
    {
      type: "plant",
      plot: 0,
      crop: "carrot",
    },
  ).state;
  const id = start.plotIds[0];
  const next = actOnFarm(start, { type: "deletePlot", id }).state;
  expect(next.coins).toBe(start.coins);
  expect(next.plots).toEqual(start.plots.slice(1));
  expect(next.plotCells).toEqual(start.plotCells.slice(1));
  expect(next.plotIds).toEqual(start.plotIds.slice(1));
  expect(next.nextPlotId).toBe(start.nextPlotId);
  expect(canPlace(next, start.plotCells[0])).toBe(true);
  expect(start.plots[0]?.crop).toBe("carrot");
  expect(() => actOnFarm(next, { type: "deletePlot", id })).toThrow(/existing/);
  expect(growCrops(next).plots).toHaveLength(8);
});

it("supports tearing down unfinished work, blocks last-turn teardown, and returns tent services", () => {
  const start = homesteadMicroState();
  start.selfBuilt = true;
  const pending = actOnFarm(start, { type: "teardown", id: 1 }).state;
  expect(serviceLocations(pending)[0].tent).toBe(true);
  expect(() => actOnFarm(start, { type: "teardown", id: 1 }, 160)).toThrow(
    /next season/,
  );
  const work = parseMicroState({
    ...start,
    structures: [{ ...start.structures[0], pendingConstruction: true }],
  });
  const cleared = actOnFarm(work, { type: "teardown", id: 1 }).state;
  expect(cleared.structures[0].pendingConstruction).toBeUndefined();
  expect(completeUpgrades(cleared).structures).toHaveLength(0);
  for (const flag of [
    { pendingConstruction: true },
    { pendingUpgrade: true },
    { pendingDemolition: false },
  ]) {
    expect(() =>
      parseMicroState({
        ...start,
        structures: [
          { ...start.structures[0], pendingDemolition: true, ...flag },
        ],
      }),
    ).toThrow();
  }
});

it("discards animal and tree products and paid upgrades during teardown", () => {
  const start = parseMicroState({
    ...homesteadMicroState(),
    nextStructureId: 4,
    structures: [
      ...homesteadMicroState().structures,
      {
        id: 2,
        kind: "coop",
        row: 0,
        col: 0,
        level: 1,
        product: true,
        pendingUpgrade: true,
      },
      {
        id: 3,
        kind: "apple",
        row: 0,
        col: 5,
        level: 1,
        age: 12,
        product: true,
      },
    ],
  });
  const coop = actOnFarm(start, { type: "teardown", id: 2 }).state;
  expect(coop.structures[1].pendingUpgrade).toBeUndefined();
  expect(coop.structures[1].product).toBe(false);
  expect(() => actOnFarm(coop, { type: "collectAnimal", id: 2 })).toThrow(
    /No animal/,
  );
  const orchard = actOnFarm(coop, { type: "teardown", id: 3 }).state;
  expect(orchard.structures[2].product).toBe(false);
  expect(() => actOnFarm(orchard, { type: "harvestTree", id: 3 })).toThrow(
    /no ripe/,
  );
  expect(completeUpgrades(orchard).structures.map((s) => s.id)).toEqual([1]);
  expect(orchard.coins).toBe(start.coins);
});
