import { expect, it } from "vitest";
import { actOnFarm, growCrops, completeUpgrades } from "./rules";
import {
  crops,
  homesteadMicroState as initialMicroState,
  parseMicroState,
  type MicroState,
  type CropId,
} from "./state";
import { canBuild, canPlant, totalHarvests } from "./progression";

function harvest(s: MicroState, crop: CropId = "turnip") {
  let next = actOnFarm(s, { type: "plant", plot: 0, crop }).state;
  while (next.plots[0]!.growth < crops[crop].steps) next = growCrops(next);
  return actOnFarm(next, { type: "harvest", plot: 0 });
}
it("earns corn and early story offers through real harvests, not money or time", () => {
  let s = { ...initialMicroState(), coins: 10000 };
  expect(() =>
    actOnFarm(s, { type: "plant", plot: 0, crop: "corn" }, 160),
  ).toThrow(/turnip and a carrot/);
  expect(() =>
    actOnFarm(
      s,
      { type: "build", kind: "shed", cell: { row: 1, col: 1 } },
      157,
    ),
  ).toThrow(/Harvest 3/);
  s = harvest(s).state;
  const trial = harvest(s, "carrot");
  expect(trial.message).toContain("Eli, baker");
  s = trial.state;
  expect(canPlant(s, "corn")).toBe(true);
  s = harvest(s, "corn").state;
  expect(totalHarvests(s)).toBe(3);
  expect(canBuild(s, "shed")).toBe(true);
  expect(s.opportunities).toContain("soil1");
  expect(JSON.parse(JSON.stringify(s))).toEqual(parseMicroState(s));
});
it("requires harvests after each individual building level, and corn for a mill", () => {
  let s = parseMicroState({
    ...initialMicroState(),
    coins: 10000,
    harvests: { turnip: 30, carrot: 1, corn: 12 },
  });
  s = actOnFarm(s, {
    type: "build",
    kind: "mill",
    cell: { row: 1, col: 1 },
  }).state;
  s = completeUpgrades(s);
  const id = s.structures.at(-1)!.id;
  expect(() => actOnFarm(s, { type: "upgrade", id }, 157)).toThrow(
    /12 more corn/,
  );
  for (let i = 0; i < 12; i++) s = harvest(s).state;
  expect(() => actOnFarm(s, { type: "upgrade", id })).toThrow(/12 more corn/);
  for (let i = 0; i < 12; i++) s = harvest(s, "corn").state;
  s = actOnFarm(s, { type: "upgrade", id }).state;
  s = completeUpgrades(s);
  expect(s.structures.at(-1)!.level).toBe(2);
  expect(() => actOnFarm(s, { type: "upgrade", id })).toThrow(/24 more corn/);
  const second = completeUpgrades(
    actOnFarm(s, {
      type: "build",
      kind: "mill",
      cell: { row: 5, col: 1 },
    }).state,
  );
  expect(() =>
    actOnFarm(second, { type: "upgrade", id: second.structures.at(-1)!.id }),
  ).toThrow(/Construction|12 more corn/);
});
it("keeps earned opportunities after land and building losses and enforces soil milestones", () => {
  let s = parseMicroState({
    ...initialMicroState(),
    coins: 1000,
    harvests: { turnip: 90, carrot: 1, corn: 12 },
  });
  expect(canBuild(s, "well")).toBe(false);
  s = actOnFarm(s, { type: "expand" }).state;
  expect(canBuild(s, "well")).toBe(true);
  s = parseMicroState({
    ...s,
    plots: s.plots.slice(0, 9),
    plotCells: s.plotCells.slice(0, 9),
    plotIds: s.plotIds.slice(0, 9),
  });
  expect(canBuild(s, "well")).toBe(true);
  for (let i = 0; i < 3; i++)
    s = completeUpgrades(actOnFarm(s, { type: "improve" }).state);
  expect(s.soilLevel).toBe(3);
  expect(canBuild(s, "greenhouse")).toBe(true);
});
it("migrates old saves without inventing harvest history and rejects corrupt progression", () => {
  const old = {
    ...initialMicroState(),
    harvests: undefined,
    opportunities: undefined,
  };
  expect(parseMicroState(old).opportunities).toContain("corn");
  expect(totalHarvests(parseMicroState(old))).toBe(0);
  for (const patch of [
    { harvests: { turnip: -1, carrot: 0, corn: 0 } },
    { harvests: [] },
    { opportunities: ["unknown"] },
    { harvests: { turnip: Number.MAX_SAFE_INTEGER, carrot: 1, corn: 0 } },
  ])
    expect(() =>
      parseMicroState({ ...initialMicroState(), ...patch }),
    ).toThrow();
});
it("checks every later opportunity at its farming boundary", () => {
  const farm = (turnip: number, carrot = 0, corn = 0, soilLevel = 0) =>
    parseMicroState({
      ...initialMicroState(),
      harvests: { turnip, carrot, corn },
      soilLevel,
    });
  expect(canBuild(farm(5), "apple")).toBe(false);
  expect(canBuild(farm(6), "apple")).toBe(true);
  expect(canBuild(farm(23), "barn")).toBe(false);
  expect(canBuild(farm(24), "barn")).toBe(true);
  expect(canBuild(farm(100, 0, 11), "mill")).toBe(false);
  expect(canBuild(farm(0, 0, 12), "mill")).toBe(true);
  expect(canBuild(farm(80), "greenhouse")).toBe(false);
  expect(canBuild(farm(79, 0, 0, 1), "greenhouse")).toBe(false);
  expect(canBuild(farm(80, 0, 0, 1), "greenhouse")).toBe(true);
  expect(canBuild(farm(160), "market")).toBe(false);
  expect(canBuild(farm(157, 1, 1), "market")).toBe(false);
  expect(canBuild(farm(158, 1, 1), "market")).toBe(true);
  const s = farm(300);
  expect(canBuild(s, "hall")).toBe(false);
  const withMarket = {
    ...s,
    structures: [
      ...s.structures,
      { id: 2, kind: "market", level: 1, row: 0, col: 0 },
    ],
    nextStructureId: 3,
  };
  expect(canBuild(parseMicroState(withMarket), "hall")).toBe(true);
  expect(
    canBuild(
      parseMicroState({
        ...withMarket,
        harvests: { turnip: 299, carrot: 0, corn: 0 },
      }),
      "hall",
    ),
  ).toBe(false);
});
