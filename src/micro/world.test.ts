import { describe, expect, it } from "vitest";
import {
  homesteadMicroState as initialMicroState,
  parseMicroState,
  harvestValue,
  seedCost,
  type MicroState,
} from "./state";
import { actOnFarm, growCrops, completeUpgrades } from "./rules";
import {
  buildings,
  canPlace,
  seasonalIncome,
  type BuildingKind,
} from "./world";
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
describe("estate construction", () => {
  it.each(Object.keys(buildings) as BuildingKind[])(
    "builds and upgrades %s only at its milestones",
    (kind) => {
      let state: MicroState = {
        ...establishedFarm(),
        coins: 1000000,
        structures: [],
      };
      if (kind === "oak")
        state.structures.push({
          id: state.nextStructureId++,
          kind: "home",
          row: 40,
          col: 40,
          level: 1,
        });
      const item = buildings[kind];
      const original = state;
      state = actOnFarm(
        state,
        { type: "build", kind, cell: { row: 0, col: 0 } },
        1,
      ).state;
      expect(original.structures).toHaveLength(kind === "oak" ? 1 : 0);
      expect(state.coins).toBe(1000000 - item.cost);
      expect(state.structures.at(-1)!.pendingConstruction).toBe(true);
      state = completeUpgrades(state);
      const id = state.structures.at(-1)!.id;
      for (let level = 1; level < item.levels; level++) {
        expect(() => actOnFarm(state, { type: "upgrade", id }, 159)).toThrow(
          /Harvest/,
        );
        state.harvests.turnip += 12 * level;
        state.harvests.corn += 12 * level;
        state = actOnFarm(state, { type: "upgrade", id }, 1).state;
        expect(state.structures[0].level).toBe(level);
        expect(state.structures[0].pendingUpgrade).toBe(true);
        state = completeUpgrades(state);
        expect(state.structures[0].level).toBe(level + 1);
      }
      expect(() => actOnFarm(state, { type: "upgrade", id }, 160)).toThrow(
        /fully|next season/,
      );
    },
  );
  it("rejects overlaps, edges, duplicate buildings and unavailable funds without charging", () => {
    const start = { ...establishedFarm(), coins: 1000 };
    const built = actOnFarm(start, {
      type: "build",
      kind: "shed",
      cell: { row: 5, col: 5 },
    }).state;
    expect(canPlace(built, { row: 6, col: 6 })).toBe(false);
    expect(() =>
      actOnFarm(built, { type: "expand", cell: { row: 5, col: 5 } }),
    ).toThrow(/unoccupied/);
    const repeated = actOnFarm(built, {
      type: "build",
      kind: "shed",
      cell: { row: 1, col: 1 },
    }).state;
    expect(repeated.structures.filter((s) => s.kind === "shed")).toHaveLength(
      2,
    );
    expect(() =>
      actOnFarm(start, {
        type: "build",
        kind: "shed",
        cell: { row: 63, col: 63 },
      }),
    ).toThrow(/outside/);
    expect(() =>
      actOnFarm(
        { ...start, coins: 1 },
        { type: "build", kind: "shed", cell: { row: 1, col: 1 } },
      ),
    ).toThrow(/coins/);
    expect(start.coins).toBe(1000);
  });
  it("moves structures for free and preserves their level and effect", () => {
    let state = { ...establishedFarm(), coins: 1000 };
    state = actOnFarm(state, {
      type: "build",
      kind: "shed",
      cell: { row: 5, col: 5 },
    }).state;
    const id = state.structures.at(-1)!.id;
    state = completeUpgrades(state);
    state.harvests.turnip += 12;
    state = actOnFarm(state, { type: "upgrade", id }, 9).state;
    state = completeUpgrades(state);
    const moved = actOnFarm(
      state,
      { type: "move", id, cell: { row: 8, col: 8 } },
      9,
    ).state;
    expect(moved.coins).toBe(state.coins);
    expect(moved.structures.at(-1)).toMatchObject({ row: 8, col: 8, level: 2 });
    expect(seedCost(moved, "turnip")).toBe(2);
    expect(() =>
      actOnFarm(moved, { type: "move", id, cell: moved.plotCells[0] }),
    ).toThrow(/occupied/);
  });
  it("applies building bonuses and orchard income", () => {
    let state = { ...establishedFarm(), coins: 100000 };
    for (const [i, kind] of (
      [
        "shed",
        "well",
        "barn",
        "mill",
        "greenhouse",
        "apple",
        "market",
        "hall",
      ] as BuildingKind[]
    ).entries())
      state = actOnFarm(
        state,
        { type: "build", kind, cell: { row: 0, col: i * 4 } },
        159,
      ).state;
    state = completeUpgrades(state);
    expect(harvestValue(state, "corn")).toBe(34 + 1 + 2 + 15 + 10 + 50);
    expect(seasonalIncome(state)).toBe(150);
    expect(seedCost(state, "corn")).toBe(11);
    state = actOnFarm(
      state,
      { type: "plant", plot: 0, crop: "corn" },
      157,
    ).state;
    state = growCrops(state);
    expect(state.plots[0]?.growth).toBe(2);
  });
  it("validates imported footprints, IDs, and layout sizes", () => {
    const start = establishedFarm();
    for (const patch of [
      { plotCells: [] },
      { plotCells: Array(9).fill({ row: 16, col: 16 }) },
      { structures: [{ id: 1, kind: "shed", row: 63, col: 63, level: 1 }] },
      { structures: [{ id: 1, kind: "shed", row: 5, col: 5, level: 4 }] },
      { structures: [...start.structures, ...start.structures] },
    ])
      expect(() => parseMicroState({ ...start, ...patch })).toThrow();
  });
  it("continues plot expansion beyond the old 49-plot limit", () => {
    let state = { ...establishedFarm(), coins: 100000 };
    for (let i = 9; i < 55; i++)
      state = actOnFarm(state, { type: "expand" }).state;
    expect(state.plots).toHaveLength(55);
    expect(new Set(state.plotCells.map((c) => JSON.stringify(c))).size).toBe(
      55,
    );
  });
});
it("supports the full 64-square estate and rejects footprints beyond it", () => {
  const start = { ...establishedFarm(), coins: 100000 };
  const far = actOnFarm(
    start,
    { type: "build", kind: "barn", cell: { row: 61, col: 61 } },
    159,
  ).state;
  expect(far.structures.at(-1)).toMatchObject({ row: 61, col: 61 });
  expect(() =>
    actOnFarm(
      start,
      { type: "build", kind: "shed", cell: { row: 63, col: 63 } },
      159,
    ),
  ).toThrow(/outside/);
  const plotted = actOnFarm(start, {
    type: "expand",
    cell: { row: 63, col: 63 },
  }).state;
  expect(plotted.plotCells.at(-1)).toEqual({ row: 63, col: 63 });
  expect(() =>
    actOnFarm(start, { type: "expand", cell: { row: 64, col: 63 } }),
  ).toThrow();
  const many = {
    ...start,
    structures: [],
    plots: Array(1025).fill(null),
    plotCells: Array.from({ length: 1025 }, (_, i) => ({
      row: Math.floor(i / 64),
      col: i % 64,
    })),
    plotIds: Array.from({ length: 1025 }, (_, i) => i + 1),
    nextPlotId: 1026,
  };
  expect(parseMicroState(many).plots).toHaveLength(1025);
});

it("keeps services at reachable roadside entrances when dense farms fill every lot", async () => {
  const { serviceLocations } = await import("./world");
  const { farmerWorkRoute } = await import("../game/farmer-route");
  const dense = {
    plotCells: Array.from({ length: 1024 }, (_, i) => ({
      row: Math.floor(i / 32) * 2,
      col: (i % 32) * 2,
    })),
    structures: [],
  };
  const locations = serviceLocations(dense);
  expect(locations.map((s) => s.id)).toContain("home");
  expect(
    serviceLocations(dense, { council: true }).find((s) => s.id === "council"),
  ).toMatchObject({ row: -2, col: 29 });
  for (const service of serviceLocations(dense, { council: true })) {
    expect(service.row).toBe(-2);
    expect(
      farmerWorkRoute(
        { row: 0, col: 1 },
        service,
        { layout: dense },
        service.width,
        service.height,
        "front",
      ),
    ).toBeDefined();
  }
  expect(
    serviceLocations(initialMicroState()).some((s) => s.id === "home"),
  ).toBe(false);
});
it("shows the council office only when asked, beside the village services", async () => {
  const { serviceLocations } = await import("./world");
  const farm = establishedFarm();
  expect(serviceLocations(farm).map((s) => s.id)).not.toContain("council");
  expect(serviceLocations(farm, {}).map((s) => s.id)).not.toContain("council");
  const shown = serviceLocations(farm, { council: true });
  expect(shown.slice(0, -1)).toEqual(serviceLocations(farm));
  expect(shown.at(-1)).toMatchObject({
    id: "council",
    name: "Council office",
    row: 7,
    col: 9,
    tent: false,
  });
  const camp = { selfBuilt: true as const, plotCells: [], structures: [] };
  expect(
    serviceLocations(camp, { council: true }).map((s) => [s.id, s.name]),
  ).toEqual([
    ["home", "Your tent"],
    ["council", "Council office"],
  ]);
  const settled = {
    ...camp,
    structures: [{ id: 1, kind: "home" as const, row: 11, col: 14, level: 1 }],
  };
  expect(serviceLocations(settled)).toEqual([]);
  expect(serviceLocations(settled, { council: true })).toHaveLength(1);
  const crowded = {
    ...farm,
    structures: [
      ...farm.structures,
      { id: 2, kind: "shed" as const, row: 7, col: 9, level: 1 },
    ],
  };
  expect(serviceLocations(crowded, { council: true }).at(-1)).not.toMatchObject(
    { row: 7, col: 9 },
  );
  expect(canPlace(farm, { row: 7, col: 9 })).toBe(true);
  expect(
    canPlace(farm, { row: 7, col: 9 }, 1, 1, { permitsRequired: true }),
  ).toBe(false);
  expect(() =>
    actOnFarm(
      { ...farm, coins: 1000 },
      { type: "build", kind: "shed", cell: { row: 7, col: 9 } },
      { turn: 1, policy: { permitsRequired: true } },
    ),
  ).toThrow(/occupied/);
});
