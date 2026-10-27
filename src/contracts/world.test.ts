import { expect, it } from "vitest";
import { parseFarmPolicy } from "./farm-policy";
import { WORLD_SIZE, WORLD_CELLS } from "./world";
it("uses the same expanded extent for land grants and quotas", () => {
  expect(WORLD_SIZE).toBe(64);
  expect(WORLD_CELLS).toBe(4096);
  const policy = {
    land: [{ row: 0, col: 0, width: 64, height: 64 }],
    maxPlots: 4096,
  };
  expect(parseFarmPolicy(policy)).toEqual(policy);
  expect(() =>
    parseFarmPolicy({ land: [{ row: 63, col: 63, width: 2, height: 1 }] }),
  ).toThrow();
  expect(() => parseFarmPolicy({ maxPlots: 4097 })).toThrow();
  expect(
    parseFarmPolicy({ land: [{ row: 0, col: 0, width: 32, height: 32 }] })
      .land?.[0].width,
  ).toBe(32);
});
