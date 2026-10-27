import { expect, it } from "vitest";
import { parseFarmPolicy } from "./farm-policy";
import { WORLD_SIZE, WORLD_CELLS } from "./world";
it("uses the same expanded extent for land grants and quotas", () => {
  expect(WORLD_SIZE).toBe(128);
  expect(WORLD_CELLS).toBe(16384);
  const policy = {
    land: [{ row: 0, col: 0, width: 128, height: 128 }],
    maxPlots: 16384,
  };
  expect(parseFarmPolicy(policy)).toEqual(policy);
  expect(() =>
    parseFarmPolicy({ land: [{ row: 127, col: 127, width: 2, height: 1 }] }),
  ).toThrow();
  expect(() => parseFarmPolicy({ maxPlots: 16385 })).toThrow();
  expect(
    parseFarmPolicy({ land: [{ row: 0, col: 0, width: 32, height: 32 }] })
      .land?.[0].width,
  ).toBe(32);
});
