import { describe, expect, it, vi } from "vitest";
import { homesteadMicroState } from "../micro/state";
import { councilOffice, footprint } from "../micro/world";
import { cropCondition } from "./crop-sprites";
import {
  farmerBlocked,
  farmerWalkRoute,
  type FarmerWorld,
} from "./farmer-route";
import {
  groundTint,
  outsideTint,
  reservoirColors,
  shoreSides,
  takenCell,
} from "./terrain";

// The ground layer needs a browser; its tint choice does not.
vi.mock("phaser", () => ({ default: {} }));

describe("crisis marks in the scene", () => {
  it("tints dry crops, and tints and shrinks withered ones", () => {
    expect(cropCondition({})).toEqual({ scale: 1 });
    const dry = cropCondition({ dry: true }),
      withered = cropCondition({ withered: true });
    expect(dry).toEqual({
      tint: expect.any(Number),
      shade: expect.any(Number),
      scale: 1,
    });
    expect(withered).toEqual({
      tint: expect.any(Number),
      shade: expect.any(Number),
      scale: 0.7,
    });
    expect(withered.tint).not.toBe(dry.tint);
    // A dry crop that later withers looks withered.
    expect(cropCondition({ dry: true, withered: true })).toEqual(withered);
  });
  it("draws taken land as reservoir water, not as land outside the grant", () => {
    const policy = {
      land: [{ row: 10, col: 10, width: 4, height: 4 }],
      takenCells: [
        { row: 11, col: 11 },
        { row: 11, col: 12 },
        { row: 20, col: 20 },
      ],
    };
    expect(takenCell({ row: 11, col: 11 }, policy)).toBe(true);
    expect(takenCell({ row: 20, col: 20 }, policy)).toBe(true);
    expect(takenCell({ row: 10, col: 10 }, policy)).toBe(false);
    expect(takenCell({ row: 11, col: 11 })).toBe(false);
    // Water covers taken land, so its ground keeps its own colour.
    expect(groundTint({ row: 11, col: 11 }, policy)).toBeUndefined();
    expect(groundTint({ row: 20, col: 20 }, policy)).toBeUndefined();
    expect(groundTint({ row: 10, col: 10 }, policy)).toBeUndefined();
    expect(groundTint({ row: 30, col: 30 }, policy)).toBe(outsideTint);
    expect(groundTint({ row: 30, col: 30 })).toBeUndefined();
    // A bank runs only where the water meets land the county did not take.
    expect(shoreSides({ row: 11, col: 11 }, policy)).toEqual([
      true,
      false,
      true,
      true,
    ]);
    expect(shoreSides({ row: 11, col: 12 }, policy)).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(shoreSides({ row: 20, col: 20 }, policy)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    // Every season has its own water, and a bank darker than the water.
    for (const look of Object.values(reservoirColors))
      expect(look.bank).not.toBe(look.water);
  });
  it("keeps the farmer off land the county took", () => {
    const layout = homesteadMicroState();
    const taken = { row: 15, col: 15 };
    const world: FarmerWorld = { layout, policy: { takenCells: [taken] } };
    expect(farmerBlocked(taken, { layout })).toBe(false);
    expect(farmerBlocked(taken, world)).toBe(true);
    expect(farmerWalkRoute({ row: 9, col: 9 }, taken, world)).toBeUndefined();
  });
  it("blocks the farmer's way through the council office only while permits are required", () => {
    const layout = homesteadMicroState();
    const open: FarmerWorld = { layout },
      council: FarmerWorld = { layout, policy: { permitsRequired: true } };
    for (const cell of footprint(councilOffice, 2, 2)) {
      expect(farmerBlocked(cell, open)).toBe(false);
      expect(farmerBlocked(cell, council)).toBe(true);
    }
    expect(
      farmerWalkRoute({ row: 9, col: 9 }, councilOffice, open),
    ).toBeDefined();
    expect(
      farmerWalkRoute({ row: 9, col: 9 }, councilOffice, council),
    ).toBeUndefined();
  });
});
