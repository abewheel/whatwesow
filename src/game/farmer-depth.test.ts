import { describe, expect, it } from "vitest";
import { farmerDepth } from "./farmer-depth";

const building = { x: 0, y: 0, size: 200, front: { x: 100, y: 180 } };
describe("farmer building depth", () => {
  it("draws the farmer ahead of either front edge before the bottom corner", () => {
    expect(farmerDepth({ x: 30, y: 150 }, [building])).toBeGreaterThan(180);
    expect(farmerDepth({ x: 170, y: 150 }, [building])).toBeGreaterThan(180);
  });
  it("keeps the farmer behind the building when walking along its rear", () => {
    expect(farmerDepth({ x: 30, y: 140 }, [building])).toBeLessThan(180);
    expect(farmerDepth({ x: 170, y: 140 }, [building])).toBeLessThan(180);
  });
  it("keeps normal depth away from the artwork and beyond its front", () => {
    expect(farmerDepth({ x: 300, y: 150 }, [building])).toBe(150);
    expect(farmerDepth({ x: 100, y: 250 }, [building])).toBe(250);
  });
});
