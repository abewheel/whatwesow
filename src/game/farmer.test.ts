import { describe, expect, it } from "vitest";
import { farmerBlocked, farmerSpawn, farmerWorkRoute } from "./farmer-route";
import type { FarmerWorld } from "./farmer-route";
const world: FarmerWorld = {
  layout: {
    plotCells: [],
    structures: [{ id: 1, kind: "home", level: 1, row: 2, col: 2 }],
  },
};
describe("farmer work routes", () => {
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
  it("handles corner plots and policy restrictions", () => {
    const restricted = {
      ...world,
      policy: { land: [{ row: 0, col: 0, width: 2, height: 2 }] },
    };
    expect(
      farmerWorkRoute({ row: 1, col: 1 }, { row: 0, col: 0 }, restricted)
        ?.route,
    ).toHaveLength(1);
    expect(
      farmerWorkRoute({ row: 1, col: 1 }, { row: 127, col: 127 }, restricted),
    ).toBeUndefined();
  });
  it("uses a reachable front neighbor when the rear neighbor is isolated", () => {
    const split = {
      layout: { plotCells: [], structures: [] },
      policy: {
        land: [
          { row: 2, col: 1, width: 1, height: 1 },
          { row: 2, col: 2, width: 3, height: 1 },
        ],
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
