import { expect, it } from "vitest";
import { parseFarmPolicy } from "./farm-policy";
import { WORLD_SIZE, WORLD_CELLS, mix } from "./world";
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
it("hashes deterministically so random-looking choices replay exactly", () => {
  expect(mix(0, 0)).toBe(0);
  expect(mix(1, 1)).toBe(1498594145);
  expect(mix(2, 7)).toBe(1931304665);
  expect(mix(7, 2)).not.toBe(mix(2, 7));
  expect(mix(-1, 2.9)).toBe(mix(-1, 2));
  expect(Number.isSafeInteger(mix(123456, 160))).toBe(true);
});
const councilPolicy = {
  cropPrices: { corn: 0.6, apple: 0.6 },
  fixedPrices: { corn: 40, turnip: 9 },
  priceCeiling: 1,
  bannedCrops: ["corn"],
  recoveringCrops: ["carrot"],
  cropLimits: { corn: 5 },
  agreedCropLimits: { corn: 4 },
  assignedCrops: ["turnip"],
  seedMultiplier: 1.5,
  plantingFee: 2,
  harvestTax: 0.1,
  yieldMultiplier: 0.8,
  averageCap: true,
  quota: 3,
  sellDelay: { corn: 5, pumpkin: 0 },
  permitsRequired: true,
  rotation: true,
  fallowShare: 0.2,
  plantingFine: 3,
  sealedBuildings: ["well"],
  buildDelay: 1,
  frozenUpgrades: true,
  unlockedBuildings: ["well"],
  takenCells: [{ row: 16, col: 16 }],
  waterTrade: { buy: 12, sell: 6 },
  droughtWells: true,
  premiumSeed: { seed: 1.5, yield: 1.3, failOneIn: 8 },
  forwardContract: { mult: 0.85, seasons: 4 },
};
it("round trips every council policy field and drops unknown keys", () => {
  expect(parseFarmPolicy(JSON.parse(JSON.stringify(councilPolicy)))).toEqual(
    councilPolicy,
  );
  expect(
    parseFarmPolicy({
      takenCells: [{ row: 0, col: 63, extra: 1 }],
      waterTrade: { buy: 0, sell: 0, extra: 1 },
      premiumSeed: { seed: 0, yield: 10, failOneIn: 1, extra: 1 },
      forwardContract: { mult: 0, seasons: 160, extra: 1 },
      unknown: true,
    }),
  ).toEqual({
    takenCells: [{ row: 0, col: 63 }],
    waterTrade: { buy: 0, sell: 0 },
    premiumSeed: { seed: 0, yield: 10, failOneIn: 1 },
    forwardContract: { mult: 0, seasons: 160 },
  });
  expect(parseFarmPolicy({ quota: 0, buildDelay: 0 })).toEqual({
    quota: 0,
    buildDelay: 0,
  });
});
it.each([
  { cropPrices: { corn: 11 } },
  { cropPrices: { corn: -0.1 } },
  { cropPrices: [] },
  { fixedPrices: { corn: 1.5 } },
  { fixedPrices: { corn: -1 } },
  { priceCeiling: 10.5 },
  { bannedCrops: "corn" },
  { recoveringCrops: [1] },
  { assignedCrops: [null] },
  { sealedBuildings: {} },
  { unlockedBuildings: [true] },
  { cropLimits: { corn: -1 } },
  { agreedCropLimits: { corn: 0.5 } },
  { seedMultiplier: 10.01 },
  { seedMultiplier: Number.NaN },
  { plantingFee: 1001 },
  { plantingFee: 1.5 },
  { harvestTax: 1.01 },
  { harvestTax: -0.1 },
  { yieldMultiplier: Infinity },
  { averageCap: 1 },
  { quota: -1 },
  { quota: 2.5 },
  // One held crop per key: the old single-crop shape is not a policy.
  { sellDelay: { crop: "corn", above: 5 } },
  { sellDelay: { corn: -1 } },
  { sellDelay: { corn: 1.5 } },
  { sellDelay: { corn: 4097 } },
  { sellDelay: "corn" },
  { permitsRequired: "yes" },
  { rotation: null },
  { fallowShare: 1.2 },
  { plantingFine: 11 },
  { buildDelay: 5 },
  { buildDelay: 0.5 },
  { frozenUpgrades: 0 },
  { takenCells: [{ row: 64, col: 0 }] },
  { takenCells: [{ row: 1 }] },
  { takenCells: { row: 1, col: 1 } },
  { waterTrade: { buy: 12 } },
  { waterTrade: { buy: 1.5, sell: 6 } },
  { droughtWells: "true" },
  { premiumSeed: { seed: 1.5, yield: 1.3, failOneIn: 0 } },
  { premiumSeed: { seed: 11, yield: 1.3, failOneIn: 8 } },
  { forwardContract: { mult: 0.85, seasons: 0 } },
  { forwardContract: { mult: -1, seasons: 4 } },
])("rejects invalid council policy %j", (policy) =>
  expect(() => parseFarmPolicy(policy)).toThrow(),
);
