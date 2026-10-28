import { expect, it } from "vitest";
import { actOnFarm, growCrops, completeUpgrades } from "./rules";
import { homesteadMicroState, parseMicroState } from "./state";

it("buys out-of-season seeds into a persistent inventory and plants without charging twice", () => {
  const start = homesteadMicroState();
  const bought = actOnFarm(
    start,
    { type: "buySeeds", crop: "carrot", quantity: 3 },
    4,
  ).state;
  expect(bought.coins).toBe(79);
  expect(bought.seeds.carrot).toBe(3);
  expect(start.seeds.carrot).toBe(0);
  const saved = parseMicroState(JSON.parse(JSON.stringify(bought)));
  expect(() =>
    actOnFarm(saved, { type: "plant", crop: "carrot", plot: 0 }, 4),
  ).toThrow(/spring/);
  const planted = actOnFarm(
    { ...saved, coins: 0 },
    { type: "plant", crop: "carrot", plot: 0 },
    5,
  ).state;
  expect(planted.seeds.carrot).toBe(2);
  expect(planted.coins).toBe(0);
  expect(saved.seeds.carrot).toBe(3);
});

it("validates inventory and migrates missing legacy inventory without changing farm progress", () => {
  const start = homesteadMicroState();
  const { seeds: omitted, ...legacy } = start;
  expect(parseMicroState(legacy)).toEqual(start);
  for (const seeds of [
    null,
    [],
    {},
    { ...omitted, turnip: -1 },
    { ...omitted, corn: 0.5 },
    { ...omitted, carrot: Number.MAX_SAFE_INTEGER + 1 },
    { ...omitted, unknown: 0 },
  ])
    expect(() => parseMicroState({ ...start, seeds })).toThrow(/seed/);
});

it("rejects unpaid seeds, locked crops, invalid quantities, overflow, and final-season purchases atomically", () => {
  const start = homesteadMicroState();
  expect(() =>
    actOnFarm(start, { type: "plant", crop: "turnip", plot: 0 }),
  ).toThrow(/Buy seeds/);
  expect(() =>
    actOnFarm(start, { type: "buySeeds", crop: "corn", quantity: 1 }),
  ).toThrow(/turnip and a carrot/);
  for (const quantity of [0, -1, 0.5, Infinity, Number.MAX_SAFE_INTEGER])
    expect(() =>
      actOnFarm(start, { type: "buySeeds", crop: "turnip", quantity }),
    ).toThrow();
  expect(() =>
    actOnFarm(
      { ...start, coins: 0 },
      { type: "buySeeds", crop: "turnip", quantity: 1 },
    ),
  ).toThrow(/coins/);
  expect(() =>
    actOnFarm(
      { ...start, seeds: { ...start.seeds, turnip: Number.MAX_SAFE_INTEGER } },
      { type: "buySeeds", crop: "turnip", quantity: 1 },
    ),
  ).toThrow(/large/);
  expect(() =>
    actOnFarm(start, { type: "buySeeds", crop: "turnip", quantity: 1 }, 160),
  ).toThrow(/growing season/);
  expect(start).toEqual(homesteadMicroState());
});

it("charges policy-adjusted unit prices and reserves recovery work for farms without usable seed inventory", () => {
  const start = homesteadMicroState();
  const bought = actOnFarm(
    start,
    { type: "buySeeds", crop: "turnip", quantity: 3 },
    { turn: 1, policy: { costMultiplier: 1.1 } },
  ).state;
  expect(bought.coins).toBe(85);
  const poor = { ...bought, coins: 0 };
  expect(() => actOnFarm(poor, { type: "work" })).toThrow(/seeds or crops/);
  expect(actOnFarm(poor, { type: "work" }, 4).state.coins).toBe(4);
  const noFields = { ...poor, plots: [], plotCells: [], plotIds: [] };
  expect(actOnFarm(noFields, { type: "work" }).state.coins).toBe(4);
});

it("quotes active council prices at purchase and applies current plot rules only when planting", () => {
  const start = homesteadMicroState();
  const bought = actOnFarm(
    start,
    { type: "buySeeds", crop: "turnip", quantity: 2 },
    {
      turn: 1,
      policy: {
        seedMultiplier: 1.25,
        costMultiplier: 1.1,
        plantingFee: 2,
        plantingFine: 3,
        bannedCrops: ["turnip"],
      },
    },
  ).state;
  expect(bought.coins).toBe(86); // ceil(ceil(4 × 1.1) × 1.25) × 2
  expect(bought.seeds.turnip).toBe(2);
  const policy = {
    seedMultiplier: 10,
    plantingFee: 2,
    plantingFine: 3,
    bannedCrops: ["turnip"],
  };
  const planted = actOnFarm(
    bought,
    { type: "plant", crop: "turnip", plot: 0 },
    { turn: 1, policy },
  ).state;
  expect(planted.coins).toBe(86 - 2 - 27);
  expect(planted.seeds.turnip).toBe(1);
  expect(() =>
    actOnFarm(
      bought,
      { type: "plant", crop: "turnip", plot: 0 },
      { turn: 1, policy: { permitsRequired: true } },
    ),
  ).toThrow(/permit/);
  expect(bought.seeds.turnip).toBe(2);
});
it("retains premium purchase terms across policy expiry, saves, and later premium offers", () => {
  const start = homesteadMicroState();
  const offer = { seed: 1.5, yield: 1.3, failOneIn: 8 };
  const first = actOnFarm(
    start,
    { type: "buySeeds", crop: "turnip", quantity: 1, premium: true },
    { turn: 1, policy: { premiumSeed: offer } },
  ).state;
  const bought = actOnFarm(
    first,
    { type: "buySeeds", crop: "turnip", quantity: 1, premium: true },
    { turn: 1, policy: { premiumSeed: { ...offer, yield: 2 } } },
  ).state;
  const saved = parseMicroState(JSON.parse(JSON.stringify(bought)));
  const planted = actOnFarm(
    saved,
    { type: "plant", crop: "turnip", plot: 0, premium: true },
    5,
  ).state;
  expect(planted.coins).toBe(88);
  expect(planted.premiumSeeds.turnip).toBe(1);
  expect(planted.plots[0]).toMatchObject({
    premium: "good",
    premiumYield: 1.3,
  });
  const ripe = growCrops(planted);
  expect(actOnFarm(ripe, { type: "harvest", plot: 0 }, 6).state.coins).toBe(99);
  const later = actOnFarm(
    planted,
    { type: "plant", crop: "turnip", plot: 1, premium: true },
    5,
  ).state;
  expect(later.plots[1]?.premiumYield).toBe(2);
  expect(saved.premiumSeeds.turnip).toBe(2);
  expect(() =>
    actOnFarm(
      saved,
      { type: "buySeeds", crop: "turnip", quantity: 1, premium: true },
      5,
    ),
  ).toThrow(/not on offer/);
});
it("lets recovery work cover current fees despite stored seeds, and clears delayed teardown next turn", () => {
  const start = homesteadMicroState();
  const bought = actOnFarm(start, {
    type: "buySeeds",
    crop: "turnip",
    quantity: 1,
  }).state;
  expect(
    actOnFarm(
      { ...bought, coins: 0 },
      { type: "work" },
      { turn: 1, policy: { plantingFee: 2 } },
    ).state.coins,
  ).toBe(4);
  const delayed = {
    ...start,
    structures: [
      { ...start.structures[0], pendingConstruction: true as const, wait: 3 },
    ],
  };
  const teardown = actOnFarm(delayed, { type: "teardown", id: 1 }).state;
  expect(teardown.structures[0].wait).toBeUndefined();
  expect(completeUpgrades(teardown).structures).toEqual([]);
});

it("rejects premium counts without matching terms and previews owned yields without changing delayed-sale counts", async () => {
  const { previewSaleQuote } = await import("./money");
  const start = homesteadMicroState();
  expect(() =>
    parseMicroState({
      ...start,
      premiumSeeds: { ...start.premiumSeeds, turnip: 1 },
    }),
  ).toThrow(/terms/);
  const bought = actOnFarm(
    start,
    { type: "buySeeds", crop: "turnip", quantity: 1, premium: true },
    { turn: 1, policy: { premiumSeed: { seed: 1.5, yield: 2, failOneIn: 8 } } },
  ).state;
  const policy = { sellDelay: { turnip: 0 }, harvestTax: 0.25 };
  expect(previewSaleQuote(bought, "turnip", policy, 1, true, true)).toEqual({
    value: 14,
    tax: 4,
    held: false,
    overQuota: false,
  });
  expect(
    previewSaleQuote(bought, "turnip", { quota: 0 }, 1, true, true).overQuota,
  ).toBe(true);
  expect(
    previewSaleQuote(
      bought,
      "turnip",
      { premiumSeed: { seed: 1, yield: 3, failOneIn: 8 } },
      1,
      true,
    ).value,
  ).toBe(27);
  expect(bought.plots.every((p) => p === null)).toBe(true);
});
