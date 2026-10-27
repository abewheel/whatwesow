import { describe, expect, it } from "vitest";
import {
  FARM_SIZE,
  TILE_HEIGHT,
  TILE_WIDTH,
  cropArea,
  gardenArea,
  farmObjects,
  footprint,
  project,
} from "./layout";

describe("farm presentation grid", () => {
  it("uses the same 2:1 axes for land and object footprints", () => {
    expect(project(1, 0)).toEqual({ x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 });
    expect(project(0, 1)).toEqual({ x: -TILE_WIDTH / 2, y: TILE_HEIGHT / 2 });
    expect(footprint({ col: 2, row: 3, width: 3, depth: 2 })).toEqual([
      project(2, 3),
      project(5, 3),
      project(5, 5),
      project(2, 5),
    ]);
  });
  it("keeps buildings, trees, crops, gardens, and paths on separate cells within the farm", () => {
    const occupied = new Set<string>();
    const areas = [...farmObjects, cropArea, gardenArea];
    for (const area of areas) {
      for (let row = area.row; row < area.row + area.depth; row++) {
        for (let col = area.col; col < area.col + area.width; col++) {
          expect(col).toBeGreaterThanOrEqual(0);
          expect(row).toBeGreaterThanOrEqual(0);
          expect(col).toBeLessThan(FARM_SIZE);
          expect(row).toBeLessThan(FARM_SIZE);
          expect(col).not.toBe(5);
          expect(row).not.toBe(5);
          const key = `${col},${row}`;
          expect(occupied.has(key), `Overlap at ${key}`).toBe(false);
          occupied.add(key);
        }
      }
    }
  });
});
