import { describe, expect, it } from "vitest";
import {
  initialMicroState,
  parseMicroState,
  harvestValue,
  seedCost,
  type MicroState,
} from "./state";
import { actOnFarm, growCrops, completeUpgrades } from "./rules";
import {
  buildings,
  canPlace,
  upgradeTurn,
  seasonalIncome,
  type BuildingKind,
} from "./world";
describe("estate construction", () => {
  it.each(Object.keys(buildings) as BuildingKind[])(
    "builds and upgrades %s only at its milestones",
    (kind) => {
      let state: MicroState = {
        ...initialMicroState(),
        coins: 1000000,
        structures: [],
      };
      const item = buildings[kind];
      if (item.turn > 1)
        expect(() =>
          actOnFarm(
            state,
            { type: "build", kind, cell: { row: 0, col: 0 } },
            item.turn - 1,
          ),
        ).toThrow(/Unlock/);
      const original = state;
      state = actOnFarm(
        state,
        { type: "build", kind, cell: { row: 0, col: 0 } },
        item.turn,
      ).state;
      expect(original.structures).toHaveLength(0);
      expect(state.coins).toBe(1000000 - item.cost);
      expect(state.structures[0].pendingConstruction).toBe(true);
      state = completeUpgrades(state);
      const id = state.structures[0].id;
      for (let level = 1; level < item.levels; level++) {
        const turn = upgradeTurn(kind, level);
        expect(() =>
          actOnFarm(state, { type: "upgrade", id }, turn - 1),
        ).toThrow(/unlocks/);
        state = actOnFarm(state, { type: "upgrade", id }, turn).state;
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
    const start = { ...initialMicroState(), coins: 1000 };
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
        cell: { row: 127, col: 127 },
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
    let state = { ...initialMicroState(), coins: 1000 };
    state = actOnFarm(state, {
      type: "build",
      kind: "shed",
      cell: { row: 5, col: 5 },
    }).state;
    const id = state.structures.at(-1)!.id;
    state = completeUpgrades(state);
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
  it("applies building bonuses and market income", () => {
    let state = { ...initialMicroState(), coins: 100000 };
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
    expect(harvestValue(state, "corn")).toBe(34 + 1 + 2 + 15 + 8 + 30);
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
    const start = initialMicroState();
    for (const patch of [
      { plotCells: [] },
      { plotCells: Array(9).fill({ row: 16, col: 16 }) },
      { structures: [{ id: 1, kind: "shed", row: 127, col: 127, level: 1 }] },
      { structures: [{ id: 1, kind: "shed", row: 5, col: 5, level: 4 }] },
      { structures: [...start.structures, ...start.structures] },
    ])
      expect(() => parseMicroState({ ...start, ...patch })).toThrow();
  });
  it("continues plot expansion beyond the old 49-plot limit", () => {
    let state = { ...initialMicroState(), coins: 100000 };
    for (let i = 9; i < 55; i++)
      state = actOnFarm(state, { type: "expand" }).state;
    expect(state.plots).toHaveLength(55);
    expect(new Set(state.plotCells.map((c) => JSON.stringify(c))).size).toBe(
      55,
    );
  });
});
it("supports the full 128-square estate and rejects footprints beyond it", () => {
  const start = { ...initialMicroState(), coins: 100000 };
  const far = actOnFarm(
    start,
    { type: "build", kind: "barn", cell: { row: 125, col: 125 } },
    159,
  ).state;
  expect(far.structures.at(-1)).toMatchObject({ row: 125, col: 125 });
  expect(() =>
    actOnFarm(
      start,
      { type: "build", kind: "shed", cell: { row: 127, col: 127 } },
      159,
    ),
  ).toThrow(/outside/);
  const plotted = actOnFarm(start, {
    type: "expand",
    cell: { row: 127, col: 127 },
  }).state;
  expect(plotted.plotCells.at(-1)).toEqual({ row: 127, col: 127 });
  expect(() =>
    actOnFarm(start, { type: "expand", cell: { row: 128, col: 127 } }),
  ).toThrow();
  const many = {
    ...start,
    structures: [],
    plots: Array(1025).fill(null),
    plotCells: Array.from({ length: 1025 }, (_, i) => ({
      row: Math.floor(i / 128),
      col: i % 128,
    })),
    plotIds: Array.from({ length: 1025 }, (_, i) => i + 1),
    nextPlotId: 1026,
  };
  expect(parseMicroState(many).plots).toHaveLength(1025);
});
