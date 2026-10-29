import { describe, expect, it } from "vitest";
import type { FarmPolicy } from "../contracts/farm-policy";
import {
  canWork,
  charge,
  credit,
  fruitQuote,
  plantQuote,
  previewSaleQuote,
  saleQuote,
  salesThisTurn,
  workThreshold,
} from "./money";
import { actOnFarm as farmAction, growCrops, waterCrops } from "./rules";
import {
  canPlant,
  crops,
  homesteadMicroState as initialMicroState,
  parseMicroState,
  type CropId,
  type MicroState,
} from "./state";
/** Existing scenarios exercise the full paid shop-to-plot path. */
const actOnFarm: typeof farmAction = (state, action, context = 1) => {
  const bought =
    action.type === "plant"
      ? farmAction(
          state,
          {
            type: "buySeeds",
            crop: action.crop,
            quantity: 1,
            ...(action.premium ? { premium: true as const } : {}),
          },
          context,
        ).state
      : state;
  return farmAction(bought, action, context);
};
function establishedFarm() {
  return parseMicroState({
    ...initialMicroState(),
    harvests: {
      radish: 0,
      tomato: 0,
      pumpkin: 0,
      turnip: 300,
      carrot: 1,
      corn: 12,
    },
    opportunities: ["well", "market", "hall", "greenhouse"],
  });
}
describe("owed coins", () => {
  it("charges coins first and owes the shortfall without overdrawing", () => {
    const start = { ...establishedFarm(), coins: 10 };
    expect(charge(start, 4)).toMatchObject({
      state: { coins: 6 },
      toOwed: 0,
    });
    expect(charge(start, 4).state.owed).toBeUndefined();
    const short = charge(start, 15);
    expect(short).toMatchObject({ state: { coins: 0, owed: 5 }, toOwed: 5 });
    expect(charge(short.state, 3)).toMatchObject({
      state: { coins: 0, owed: 8 },
      toOwed: 3,
    });
    expect(charge(start, 0).state).toEqual(start);
    expect(start.coins).toBe(10);
    expect(parseMicroState(short.state).owed).toBe(5);
  });
  it("credits income to what is owed before coins", () => {
    const owing = { ...establishedFarm(), coins: 0, owed: 5 };
    const partly = credit(owing, 3);
    expect(partly).toMatchObject({ state: { coins: 0, owed: 2 }, toOwed: 3 });
    const paid = credit(partly.state, 10);
    expect(paid).toMatchObject({ state: { coins: 8 }, toOwed: 2 });
    expect("owed" in paid.state).toBe(false);
    expect(credit(establishedFarm(), 7)).toMatchObject({
      state: { coins: 107 },
      toOwed: 0,
    });
    expect(owing.owed).toBe(5);
  });
  it("keeps other fields and rejects amounts that are not whole coins", () => {
    const game = { coins: 1, owed: 4, year: 3 };
    expect(credit(game, 6).state).toEqual({ coins: 3, year: 3 });
    expect(charge(game, 2).state).toEqual({ coins: 0, owed: 5, year: 3 });
    for (const amount of [-1, 0.5, Number.NaN, Infinity]) {
      expect(() => charge(game, amount)).toThrow(/whole/);
      expect(() => credit(game, amount)).toThrow(/whole/);
    }
  });
});
describe("council quotes", () => {
  it("pays every advertised healthy seed value after buying, planting and growing", () => {
    const policies: FarmPolicy[] = [
      {},
      { cropPrices: { tomato: 0.6 }, harvestTax: 0.1, yieldMultiplier: 0.9 },
    ];
    for (const crop of Object.keys(crops) as CropId[])
      for (const policy of policies) {
        const turn = crops[crop].plantingSeasons[0] === "summer" ? 2 : 1;
        const start = { ...establishedFarm(), soilLevel: 2 };
        const advertised = previewSaleQuote(start, crop, policy, turn).value;
        let planted = actOnFarm(
          start,
          { type: "plant", crop, plot: 0 },
          { turn, policy },
        ).state;
        while (planted.plots[0]!.growth < crops[crop].steps)
          planted = growCrops(planted, policy);
        const harvested = farmAction(
          planted,
          { type: "harvest", plot: 0 },
          { turn: turn + 1, policy },
        );
        expect(harvested.state.coins - planted.coins).toBe(advertised);
      }
  });
  it("explains tomato drought losses and forecasts the actual dry payout", () => {
    const start = establishedFarm();
    expect(previewSaleQuote(start, "tomato", {}, 2).value).toBe(21);
    const bought = farmAction(
      start,
      { type: "buySeeds", crop: "tomato", quantity: 1 },
      2,
    ).state;
    const planted = farmAction(
      bought,
      { type: "plant", crop: "tomato", plot: 0 },
      2,
    ).state;
    const dried = waterCrops(planted, {
      drought: true,
      protectedFromDrought: false,
    }).state;
    const ripe = growCrops(dried);
    const harvested = farmAction(ripe, { type: "harvest", plot: 0 }, 3);
    const forecast = previewSaleQuote(
      start,
      "tomato",
      {},
      2,
      false,
      true,
      true,
    );
    expect(forecast.value).toBe(10);
    expect(harvested.state.coins - ripe.coins).toBe(forecast.value);
    const owing = farmAction(
      { ...ripe, owed: 6 },
      { type: "harvest", plot: 0 },
      3,
    );
    expect(owing.state.coins - ripe.coins).toBe(4);
    expect(owing.message).toContain("6 paid toward what you owe");
  });
  it("combines projected drought with the owned premium batch and policy rounding", () => {
    const farm = establishedFarm();
    farm.premiumSeedBatches = {
      tomato: [{ quantity: 1, yield: 1.3, failOneIn: 8 }],
    };
    const policy = { harvestTax: 0.1, cropPrices: { tomato: 0.8 } };
    const quote = previewSaleQuote(farm, "tomato", policy, 2, true, true, true);
    farm.plots[0] = {
      crop: "tomato",
      growth: 1,
      dry: true,
      premium: "good",
      premiumYield: 1.3,
    };
    expect(quote).toEqual(saleQuote(farm, "tomato", policy, 2, 0));
    expect(quote.value).toBe(9);
  });
  it("prices seed with multipliers, premium, fees and fines", () => {
    const farm = establishedFarm();
    expect(plantQuote(farm, "corn")).toEqual({
      seed: 12,
      fee: 0,
      fine: 0,
      reasons: [],
    });
    expect(
      plantQuote(farm, "corn", { costMultiplier: 2, seedMultiplier: 1.5 }).seed,
    ).toBe(36);
    expect(plantQuote(farm, "corn", { seedMultiplier: 0 }).seed).toBe(0);
    const premiumSeed = { seed: 1.5, yield: 1.3, failOneIn: 8 };
    expect(
      plantQuote(farm, "corn", { seedMultiplier: 1.5, premiumSeed }, 1, true)
        .seed,
    ).toBe(27);
    expect(
      plantQuote(farm, "corn", {
        plantingFee: 2,
        bannedCrops: ["corn"],
        plantingFine: 3,
      }),
    ).toEqual({ seed: 12, fee: 2, fine: 102, reasons: ["Corn is banned"] });
    expect(plantQuote(farm, "corn", { bannedCrops: ["corn"] })).toMatchObject({
      fine: 0,
      blocked: "Corn is banned.",
    });
  });
  it("names hard blocks and every finable rule in check order", () => {
    const farm = establishedFarm();
    farm.plots[0] = { crop: "corn", growth: 0 };
    farm.lastCrops = { "2": "corn" };
    const quote = plantQuote(
      farm,
      "corn",
      {
        bannedCrops: ["corn"],
        cropLimits: { corn: 1 },
        assignedCrops: ["turnip", "carrot"],
        rotation: true,
        fallowShare: 1,
        permitsRequired: true,
        plantingFine: 0.5,
      },
      1,
      false,
      1,
    );
    expect(quote.reasons).toEqual([
      "Corn is banned",
      "Corn is limited to 1 plot",
      "only turnip or carrot may be planted",
      "Corn grew here last",
      "9 plots must rest empty",
      "no planting permit this season",
    ]);
    expect(quote.fine).toBe(17);
    expect(quote.blocked).toBeUndefined();
    expect(
      plantQuote(farm, "corn", { recoveringCrops: ["corn"] }).blocked,
    ).toBe("Corn is still recovering from blight.");
    expect(
      plantQuote(farm, "corn", { agreedCropLimits: { corn: 1 } }).blocked,
    ).toBe("Your deal limits corn to 1 plot.");
    expect(
      plantQuote(farm, "corn", { assignedCrops: ["turnip"] }).blocked,
    ).toBe("Only turnip may be planted.");
  });
  it("lets the assigned crop follow itself in a plot under rotation", () => {
    const farm = {
      ...establishedFarm(),
      lastCrops: { "1": "turnip" as const },
    };
    const policy = { rotation: true, plantingFine: 3 };
    expect(plantQuote(farm, "turnip", policy, 2, false, 0).reasons).toEqual([
      "Turnip grew here last",
    ]);
    expect(
      plantQuote(
        farm,
        "turnip",
        { ...policy, assignedCrops: ["turnip"] },
        2,
        false,
        0,
      ),
    ).toMatchObject({ fine: 0, reasons: [] });
  });
  it("prices sales without plot conditions for forecasts", () => {
    const farm = establishedFarm();
    expect(saleQuote(farm, "corn")).toEqual({
      value: 34,
      tax: 0,
      held: false,
      overQuota: false,
    });
    expect(
      saleQuote(farm, "corn", { cropPrices: { corn: 0.6 }, harvestTax: 0.1 }),
    ).toEqual({ value: 18, tax: 2, held: false, overQuota: false });
    expect(
      saleQuote({ ...farm, seasonSales: { turn: 2, count: 3 } }, "corn", {
        quota: 3,
      }),
    ).toMatchObject({ value: 34, overQuota: false });
    expect(
      saleQuote(
        { ...farm, seasonSales: { turn: 2, count: 3 } },
        "corn",
        {
          quota: 3,
        },
        2,
      ),
    ).toEqual({ value: 0, tax: 0, held: false, overQuota: true });
    expect(
      salesThisTurn({ ...farm, seasonSales: { turn: 2, count: 3 } }, 3),
    ).toBe(0);
    farm.plots[0] = { crop: "corn", growth: 2 };
    farm.plots[1] = { crop: "corn", growth: 0 };
    expect(saleQuote(farm, "corn", { sellDelay: { corn: 1 } }).held).toBe(true);
    farm.plots[1] = { crop: "corn", growth: 0, withered: true };
    expect(saleQuote(farm, "corn", { sellDelay: { corn: 1 } }).held).toBe(
      false,
    );
  });
  it("prices fruit through the same chain without crop yield effects", () => {
    const farm = establishedFarm();
    const tree = { id: 9, kind: "apple" as const, row: 0, col: 0, level: 2 };
    expect(fruitQuote(farm, tree).value).toBe(48);
    expect(
      fruitQuote(farm, tree, {
        cropPrices: { apple: 0.5 },
        yieldMultiplier: 0,
        averageCap: true,
        harvestTax: 0.1,
      }),
    ).toEqual({ value: 22, tax: 2, held: false, overQuota: false });
    expect(
      fruitQuote(farm, tree, { cropPrices: { apple: 2 }, priceCeiling: 1 })
        .value,
    ).toBe(48);
  });
});

describe("delivery work", () => {
  it("pays up to the cheapest planting now, with fee and fine", () => {
    const farm = establishedFarm();
    // Spring radish, summer turnip; in fall, whatever is cheapest next.
    expect([1, 2, 3, 4].map((turn) => workThreshold(farm, {}, turn))).toEqual([
      3, 4, 3, 3,
    ]);
    expect(workThreshold(farm, { plantingFee: 2 }, 2)).toBe(6);
    expect(workThreshold(farm, { recoveringCrops: ["radish"] }, 1)).toBe(4);
    // Corn is the assigned crop: 12 coins beats radish at 3 with a 21-coin fine.
    expect(
      workThreshold(farm, { assignedCrops: ["corn"], plantingFine: 3 }, 1),
    ).toBe(12);
    // Every crop blocked: what planting will cost once it can.
    expect(
      workThreshold(farm, { recoveringCrops: Object.keys(crops) }, 1),
    ).toBe(3);
    expect(workThreshold(farm, { seedMultiplier: 0 }, 1)).toBe(1);
    expect(canWork({ ...farm, coins: 2 })).toBe(true);
    expect(canWork({ ...farm, coins: 3 })).toBe(false);
    expect(canWork({ ...farm, coins: 0 }, { allowWork: false })).toBe(false);
    farm.plots[0] = { crop: "corn", growth: 0 };
    expect(canWork({ ...farm, coins: 0 })).toBe(false);
  });
  it("lets a broke farm with a planting fee work until it can plant", () => {
    // Blight 0's planting fee, no shed, no coins.
    const policy = { plantingFee: 2 };
    for (const [turn, crop] of [
      [1, "radish"],
      [2, "turnip"],
    ] as const) {
      let state = { ...establishedFarm(), coins: 0 };
      state = actOnFarm(state, { type: "work" }, { turn, policy }).state;
      state = actOnFarm(state, { type: "work" }, { turn, policy }).state;
      expect(state.coins).toBe(8);
      expect(() =>
        actOnFarm(state, { type: "work" }, { turn, policy }),
      ).toThrow("You already have seeds or crops to keep farming.");
      expect(
        actOnFarm(state, { type: "plant", plot: 0, crop }, { turn, policy })
          .state.plots[0],
      ).toEqual({ crop, growth: 0 });
    }
  });
  it("quotes rotation on each plot, so a broke farm under rotation can plant or work", () => {
    // Blight 0's rules in summer, with turnip last grown in every plot.
    const policy: FarmPolicy = {
      plantingFee: 2,
      seedMultiplier: 1.25,
      rotation: true,
      yieldMultiplier: 0.9,
      plantingFine: 3,
    };
    const farm = establishedFarm();
    const lastCrops = Object.fromEntries(
      farm.plotIds.map((id): [string, CropId] => [String(id), "turnip"]),
    );
    let state: MicroState = { ...farm, coins: 7, lastCrops };
    // Turnip costs 7 coins and a 27-coin fine anywhere; tomato costs 12 and the fee.
    expect(plantQuote(state, "turnip", policy, 2, false, 0).fine).toBe(27);
    expect(workThreshold(state, policy, 2)).toBe(14);
    expect(canWork(state, policy, 2)).toBe(true);
    while (canWork(state, policy, 2))
      state = actOnFarm(state, { type: "work" }, { turn: 2, policy }).state;
    expect(state.coins).toBe(15);
    expect(
      actOnFarm(
        state,
        { type: "plant", plot: 0, crop: "tomato" },
        { turn: 2, policy },
      ).state.plots[0],
    ).toEqual({ crop: "tomato", growth: 0 });
    // One plot that grew something else makes turnip the cheapest planting again.
    expect(
      workThreshold(
        { ...state, lastCrops: { ...lastCrops, [farm.plotIds[4]]: "carrot" } },
        policy,
        2,
      ),
    ).toBe(7);
  });
  it("never leaves a farm with no crops unable both to plant and to work", () => {
    const policies: FarmPolicy[] = [
      {},
      { plantingFee: 2 },
      { plantingFee: 2, seedMultiplier: 1.5, costMultiplier: 2 },
      { recoveringCrops: ["radish", "turnip"] },
      { assignedCrops: ["pumpkin"], plantingFine: 3 },
      { bannedCrops: ["radish", "turnip"], plantingFine: 3 },
      { permitsRequired: true, rotation: true, plantingFine: 3 },
      { fallowShare: 0.2, plantingFine: 3, plantingFee: 2 },
    ];
    const plantsSomething = (
      state: MicroState,
      turn: number,
      policy: FarmPolicy,
    ) =>
      (Object.keys(crops) as CropId[]).some((crop) => {
        try {
          actOnFarm(state, { type: "plant", plot: 0, crop }, { turn, policy });
          return true;
        } catch {
          return false;
        }
      });
    for (const policy of policies)
      for (const turn of [1, 2, 5, 6]) {
        let state = { ...establishedFarm(), coins: 0 };
        for (let i = 0; canWork(state, policy, turn) && i < 100; i++)
          state = actOnFarm(state, { type: "work" }, { turn, policy }).state;
        expect(canWork(state, policy, turn)).toBe(false);
        expect(
          (Object.keys(crops) as CropId[]).some((crop) => canPlant(crop, turn)),
        ).toBe(true);
        expect(plantsSomething(state, turn, policy)).toBe(true);
      }
  });
});
