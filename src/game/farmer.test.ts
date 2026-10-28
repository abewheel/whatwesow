import { describe, expect, it } from "vitest";
import {
  farmerBlocked,
  farmerSpawn,
  farmerWorkRoute,
  farmerWalkRoute,
} from "./farmer-route";
import type { FarmerWorld } from "./farmer-route";
const world: FarmerWorld = {
  layout: {
    plotCells: [],
    structures: [{ id: 1, kind: "home", level: 1, row: 2, col: 2 }],
  },
};
describe("farmer work routes", () => {
  it("approaches the wild hive from the estate corner without leaving the grid", () => {
    const result = farmerWorkRoute(
      { row: 4, col: 4 },
      { row: -1, col: -1 },
      world,
    )!;
    expect(result.stance).toEqual({ row: 0, col: 0 });
    expect(result.target).toEqual({ row: -1, col: -1 });
    expect(result.route.every((cell) => cell.row >= 0 && cell.col >= 0)).toBe(
      true,
    );
  });
  it("stops adjacent to the target and avoids placed building footprints", () => {
    const start = { row: 3, col: 1 },
      target = { row: 3, col: 6 };
    const result = farmerWorkRoute(start, target, world)!;
    expect(
      Math.abs(result.stance.row - target.row) +
        Math.abs(result.stance.col - target.col),
    ).toBe(1);
    let previous = start;
    for (const cell of result.route) {
      expect(
        Math.abs(cell.row - previous.row) + Math.abs(cell.col - previous.col),
      ).toBe(1);
      expect(cell).not.toEqual(target);
      expect(farmerBlocked(cell, world)).toBe(false);
      previous = cell;
    }
  });
  it("works from its current adjacent square without stepping on the crop", () => {
    expect(
      farmerWorkRoute({ row: 16, col: 15 }, { row: 16, col: 16 }, world),
    ).toEqual({
      stance: { row: 16, col: 15 },
      target: { row: 16, col: 16 },
      route: [],
    });
  });
  it("handles corner plots and lets the farmer travel beyond farming grants", () => {
    const restricted = {
      ...world,
      policy: { land: [{ row: 0, col: 0, width: 2, height: 2 }] },
    };
    expect(
      farmerWorkRoute({ row: 1, col: 1 }, { row: 0, col: 0 }, restricted)
        ?.route,
    ).toHaveLength(1);
    expect(
      farmerWorkRoute({ row: 1, col: 1 }, { row: 63, col: 63 }, restricted),
    ).toBeDefined();
  });
  it("uses a reachable front neighbor when the rear neighbor is isolated", () => {
    const split: FarmerWorld = {
      layout: {
        plotCells: [],
        structures: [
          [1, 1],
          [3, 1],
          [2, 0],
          [1, 2],
        ].map(([row, col], i) => ({
          id: i + 1,
          kind: "oak",
          level: 1,
          row,
          col,
        })),
      },
    };
    expect(
      farmerWorkRoute({ row: 2, col: 4 }, { row: 2, col: 2 }, split)?.stance,
    ).toEqual({ row: 2, col: 3 });
  });
  it("does not route into a moved structure", () => {
    const moved = {
      layout: {
        plotCells: [],
        structures: [
          { id: 1, kind: "oak" as const, level: 1, row: 16, col: 15 },
        ],
      },
    };
    const result = farmerWorkRoute(
      { row: 15, col: 15 },
      { row: 16, col: 16 },
      moved,
    )!;
    expect(result.route).not.toContainEqual({ row: 16, col: 15 });
  });
});

it("spawns near permitted plots when the first plot is excluded", () => {
  const state = {
    layout: {
      plotCells: [
        { row: 16, col: 16 },
        { row: 25, col: 25 },
      ],
      structures: [],
    },
    policy: { land: [{ row: 24, col: 24, width: 3, height: 3 }] },
  };
  const spawn = farmerSpawn(state)!;
  expect(farmerBlocked(spawn, state)).toBe(false);
  expect(Math.abs(spawn.row - 25) + Math.abs(spawn.col - 25)).toBe(1);
  expect(farmerSpawn({ ...state, policy: { land: [] } })).toBeUndefined();
});
it("routes around the full building footprint at the map corner", () => {
  const state = {
    layout: {
      plotCells: [],
      structures: [{ id: 1, kind: "shed" as const, row: 0, col: 0, level: 1 }],
    },
  };
  const result = farmerWorkRoute(
    { row: 3, col: 3 },
    { row: 0, col: 0 },
    state,
    2,
    2,
  )!;
  expect(result).toBeDefined();
  expect(
    Math.abs(result.stance.row - result.target.row) +
      Math.abs(result.stance.col - result.target.col),
  ).toBe(1);
  expect(result.route.every((cell) => !farmerBlocked(cell, state))).toBe(true);
});

it("walks onto clicked ground, taking single-cell steps around buildings", () => {
  const start = { row: 3, col: 1 },
    target = { row: 3, col: 6 };
  const plan = farmerWalkRoute(start, target, world)!;
  expect(plan.stance).toEqual(target);
  expect(plan.route.at(-1)).toEqual(target);
  let previous = start;
  for (const cell of plan.route) {
    expect(
      Math.abs(cell.row - previous.row) + Math.abs(cell.col - previous.col),
    ).toBe(1);
    expect(farmerBlocked(cell, world)).toBe(false);
    previous = cell;
  }
  expect(farmerWalkRoute(start, { row: 2, col: 2 }, world)).toBeUndefined();
});
it("treats village service footprints as obstacles and visits their front perimeter", () => {
  const target = { row: 7, col: 14 };
  expect(farmerBlocked(target, world)).toBe(true);
  const plan = farmerWorkRoute(
    { row: 13, col: 15 },
    target,
    world,
    3,
    3,
    "front",
  )!;
  expect(plan.stance.row === 10 || plan.stance.col === 17).toBe(true);
  expect(plan.route.every((cell) => !farmerBlocked(cell, world))).toBe(true);
});
it("refuses physically enclosed ground and locations outside the map", () => {
  const enclosed: FarmerWorld = {
    layout: {
      plotCells: [],
      structures: [
        [4, 5],
        [5, 4],
        [5, 6],
        [6, 5],
      ].map(([row, col], i) => ({
        id: i + 1,
        kind: "oak",
        level: 1,
        row,
        col,
      })),
    },
  };
  expect(
    farmerWalkRoute({ row: 0, col: 0 }, { row: 5, col: 5 }, enclosed),
  ).toBeUndefined();
  expect(
    farmerWalkRoute({ row: 0, col: 0 }, { row: 64, col: 0 }, world),
  ).toBeUndefined();
});

it("routes around large debris while leaving the L-shaped tree's inner corner walkable", () => {
  const layout = {
    selfBuilt: true as const,
    plots: [],
    plotCells: [],
    structures: [],
    debris: [
      { kind: "fallenTree" as const, row: 30, col: 30 },
      { kind: "rockpile" as const, row: 40, col: 40 },
    ],
  };
  expect(farmerBlocked({ row: 32, col: 30 }, { layout })).toBe(true);
  expect(farmerBlocked({ row: 30, col: 32 }, { layout })).toBe(true);
  expect(farmerBlocked({ row: 31, col: 31 }, { layout })).toBe(false);
  expect(farmerBlocked({ row: 42, col: 42 }, { layout })).toBe(true);
});

it("crosses a future vacant building lot to stage construction when its rear edges are blocked", () => {
  const target = { row: 10, col: 10 };
  const reserved: FarmerWorld = {
    layout: {
      plotCells: [],
      structures: [
        ...Array.from({ length: 4 }, (_, i) => ({ row: 9, col: 10 + i })),
        ...Array.from({ length: 4 }, (_, i) => ({ row: 10 + i, col: 9 })),
      ].map((cell, i) => ({
        ...cell,
        id: i + 1,
        kind: "oak" as const,
        level: 1,
      })),
    },
  };
  expect(
    farmerWorkRoute(target, target, reserved, 4, 4, "rear"),
  ).toBeUndefined();
  const stage = farmerWorkRoute(target, target, reserved, 4, 4, "rear", true)!;
  expect(stage).toBeDefined();
  expect(stage.route).toHaveLength(4);
  expect(stage.stance.row === 14 || stage.stance.col === 14).toBe(true);
  expect(stage.route.every((cell) => !farmerBlocked(cell, reserved))).toBe(
    true,
  );
  expect(stage.route.some((cell) => cell.row < 14 && cell.col < 14)).toBe(true);
  const occupied: FarmerWorld = {
    layout: {
      ...reserved.layout,
      structures: [
        ...reserved.layout.structures,
        { ...target, id: 9, kind: "coop", level: 1 },
      ],
    },
  };
  const work = farmerWorkRoute({ row: 15, col: 12 }, target, occupied, 4, 4)!;
  expect(work.route.every((cell) => !farmerBlocked(cell, occupied))).toBe(true);
});
