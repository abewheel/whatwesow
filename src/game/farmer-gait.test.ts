import { describe, expect, it } from "vitest";
import { farmerStep } from "./farmer-gait";

describe("alternating walk cycle", () => {
  it("plants one foot while the other swings, then trades support", () => {
    for (const phase of [0.125, 0.25, 0.375]) {
      expect(farmerStep(phase).lift).toBe(0);
      expect(farmerStep(phase + 0.5).lift).toBeGreaterThan(0);
    }
    expect(farmerStep(0).reach).toBe(16);
    expect(farmerStep(0.5).reach).toBe(-16);
  });
  it("moves the planted foot backwards evenly without lifting it", () => {
    const steps = [0, 0.125, 0.25, 0.375, 0.5].map(farmerStep);
    expect(steps.map((step) => step.reach)).toEqual([16, 8, 0, -8, -16]);
    expect(steps.every((step) => step.lift === 0)).toBe(true);
  });
  it("joins successive cycles without a pose jump", () => {
    for (const phase of [0, 0.25, 0.5, 0.75]) {
      expect(farmerStep(phase + 100)).toEqual(farmerStep(phase));
    }
    expect(farmerStep(1 - 1e-6).reach).toBeCloseTo(farmerStep(0).reach);
    expect(farmerStep(1 - 1e-6).lift).toBeCloseTo(0);
  });
});
