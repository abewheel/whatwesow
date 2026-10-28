import { describe, expect, it } from "vitest";
import type { FarmPolicy } from "../contracts/farm-policy";
import { mix } from "../contracts/world";
import {
  actOnFarm,
  completeUpgrades,
  growCrops,
  waterCrops,
  withPermit,
} from "./rules";
import {
  homesteadMicroState as initialMicroState,
  harvestValue,
  parseMicroState,
  seedCost,
  type MicroState,
} from "./state";
import { buildingLevel, seasonalIncome } from "./world";
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
const plant = (
  state: MicroState,
  plot: number,
  policy: FarmPolicy = {},
  crop: "corn" | "turnip" | "tomato" = "corn",
  turn = 1,
) => actOnFarm(state, { type: "plant", plot, crop }, { turn, policy });
const harvest = (
  state: MicroState,
  plot: number,
  policy: FarmPolicy = {},
  turn = 1,
) => actOnFarm(state, { type: "harvest", plot }, { turn, policy });
function ripeCorn(plots = 1, coins = 100) {
  const state = { ...establishedFarm(), coins };
  for (let i = 0; i < plots; i++) state.plots[i] = { crop: "corn", growth: 2 };
  return state;
}

describe("planting under council rules", () => {
  it("blocks recovering crops and accepted deal limits outright", () => {
    const farm = { ...establishedFarm(), coins: 1000 };
    expect(() => plant(farm, 0, { recoveringCrops: ["corn"] })).toThrow(
      "Corn is still recovering from blight.",
    );
    expect(
      plant(farm, 0, { recoveringCrops: ["carrot"] }).state.plots[0]?.crop,
    ).toBe("corn");
    const one = plant(farm, 0).state;
    const deal = { agreedCropLimits: { corn: 1 }, plantingFine: 3 };
    expect(() => plant(one, 1, deal)).toThrow(
      "Your deal limits corn to 1 plot.",
    );
    one.plots[0] = { crop: "corn", growth: 1, withered: true };
    expect(plant(one, 1, deal).state.coins).toBe(1000 - 24);
  });
  it.each([
    [{ bannedCrops: ["corn"] }, "Corn is banned."],
    [{ cropLimits: { corn: 0 } }, "Corn is limited to 0 plots."],
    [{ assignedCrops: ["turnip"] }, "Only turnip may be planted."],
    [{ permitsRequired: true }, "No planting permit this season."],
    [{ fallowShare: 1 }, "9 plots must rest empty."],
  ] as [FarmPolicy, string][])(
    "blocks a finable rule without a fine: %j",
    (policy, error) => {
      const farm = { ...establishedFarm(), coins: 200 };
      expect(() => plant(farm, 0, policy)).toThrow(error);
      expect(plant(farm, 0, { ...policy, plantingFine: 3 }).state.coins).toBe(
        200 - 12 - 102,
      );
    },
  );
  it("charges one fine for every broken rule on top of seed and fee", () => {
    const farm = { ...establishedFarm(), coins: 200 };
    const policy = {
      bannedCrops: ["corn"],
      permitsRequired: true,
      plantingFine: 3,
      plantingFee: 2,
    };
    const result = plant(farm, 0, policy);
    expect(result.state.coins).toBe(200 - 12 - 2 - 102);
    expect(result.message).toBe(
      "Corn planted. −14 coins, including a 2-coin planting fee. Planted against the rules (Corn is banned; no planting permit this season). Fine −102 coins.",
    );
    expect(() => plant({ ...farm, coins: 115 }, 0, policy)).toThrow(
      /Not enough coins/,
    );
    expect(
      plant({ ...farm, permits: [1] }, 0, { permitsRequired: true }).state
        .plots[0],
    ).toEqual({ crop: "corn", growth: 0 });
  });
  it("forbids the same crop twice in a row on one plot", () => {
    let state = plant(establishedFarm(), 0).state;
    expect(state.lastCrops).toEqual({ "1": "corn" });
    state = harvest(growCrops(growCrops(state)), 0).state;
    expect(() => plant(state, 0, { rotation: true })).toThrow(
      "Corn grew here last.",
    );
    expect(plant(state, 1, { rotation: true }).state.lastCrops).toEqual({
      "1": "corn",
      "2": "corn",
    });
    state = plant(state, 0, { rotation: true }, "turnip").state;
    expect(state.lastCrops).toEqual({ "1": "turnip" });
  });
  it("keeps a share of plots resting, counting withered plots as empty", () => {
    const farm = establishedFarm();
    for (let i = 0; i < 7; i++) farm.plots[i] = { crop: "turnip", growth: 0 };
    const policy = { fallowShare: 0.2 };
    const eight = plant(farm, 7, policy, "turnip").state;
    expect(() => plant(eight, 8, policy, "turnip")).toThrow(
      "1 plot must rest empty.",
    );
    eight.plots[0] = { crop: "turnip", growth: 0, withered: true };
    expect(plant(eight, 8, policy, "turnip").state.plots[8]?.crop).toBe(
      "turnip",
    );
  });
  it("prices seed by multiplier and fee", () => {
    const farm = establishedFarm();
    expect(plant(farm, 0, { seedMultiplier: 1.5 }).state.coins).toBe(82);
    expect(plant(farm, 0, { seedMultiplier: 0 }).state.coins).toBe(100);
    const fee = plant(farm, 0, { plantingFee: 2 });
    expect(fee.state.coins).toBe(86);
    expect(fee.message).toBe(
      "Corn planted. −14 coins, including a 2-coin planting fee.",
    );
    expect(plant(farm, 0).message).toBe("Corn planted. −12 coins.");
  });
  it("sells premium seed that yields more or dies at its first growth", () => {
    const farm = establishedFarm();
    const premiumSeed = { seed: 1.5, yield: 1.3, failOneIn: 8 };
    const premium = (plot: number, policy: FarmPolicy, turn = 5) =>
      actOnFarm(
        farm,
        { type: "plant", plot, crop: "corn", premium: true },
        { turn, policy },
      );
    expect(() => premium(0, {})).toThrow(/Premium seed/);
    expect(mix(1, 5) % 8).not.toBe(0);
    expect(mix(4, 5) % 8).toBe(0);
    const good = premium(0, { premiumSeed });
    expect(good.state.coins).toBe(82);
    expect(good.message).toBe("Premium corn planted. −18 coins.");
    expect(good.state.plots[0]).toEqual({
      crop: "corn",
      growth: 0,
      premium: "good",
    });
    const ripe = growCrops(growCrops(good.state));
    expect(harvest(ripe, 0, { premiumSeed }, 6).state.coins).toBe(82 + 44);
    expect(harvest(ripe, 0, {}, 6).state.coins).toBe(82 + 34);
    const bad = growCrops(premium(3, { premiumSeed }).state);
    expect(bad.plots[3]).toEqual({
      crop: "corn",
      growth: 0,
      premium: "bad",
      withered: true,
    });
    expect(growCrops(bad).plots[3]).toEqual(bad.plots[3]);
    const cleared = harvest(bad, 3);
    expect(cleared.state.plots[3]).toBeNull();
    expect(cleared.state.coins).toBe(bad.coins);
    expect(cleared.state.harvests).toEqual(bad.harvests);
    expect(cleared.message).toBe("The withered corn was cleared for nothing.");
  });
});

describe("the harvest sale chain", () => {
  it("replaces the base with fixed prices and caps multipliers above 1", () => {
    const fixed = { fixedPrices: { corn: 20 }, cropPrices: { corn: 1.5 } };
    expect(harvest(ripeCorn(), 0, fixed).state.coins).toBe(120);
    expect(
      harvest(ripeCorn(), 0, { ...fixed, cropPrices: { corn: 0.5 } }).state
        .coins,
    ).toBe(110);
    expect(
      harvest(ripeCorn(), 0, { cropPrices: { corn: 2 }, priceCeiling: 1.5 })
        .state.coins,
    ).toBe(151);
  });
  it("caps the base at the valley average before multipliers", () => {
    const farm = { ...ripeCorn(), soilLevel: 2 };
    expect(harvest(farm, 0).state.coins).toBe(140);
    expect(harvest(farm, 0, { averageCap: true }).state.coins).toBe(134);
    expect(
      harvest(farm, 0, { averageCap: true, cropPrices: { corn: 0.5 } }).state
        .coins,
    ).toBe(117);
  });
  it("uses a forward contract instead of crop prices while it runs", () => {
    const farm = { ...ripeCorn(), contract: { from: 1, until: 4, mult: 0.85 } };
    const crash = { cropPrices: { corn: 0.6 } };
    expect(harvest(farm, 0, crash, 4).state.coins).toBe(128);
    expect(harvest(farm, 0, {}, 4).state.coins).toBe(128);
    expect(harvest(farm, 0, crash, 5).state.coins).toBe(120);
  });
  it("applies yield, dry, premium and output multipliers, then rounds down", () => {
    expect(harvest(ripeCorn(), 0, { yieldMultiplier: 0.8 }).state.coins).toBe(
      127,
    );
    const dry = ripeCorn();
    dry.plots[0] = { crop: "corn", growth: 2, dry: true };
    expect(harvest(dry, 0).state.coins).toBe(117);
    expect(
      harvest(dry, 0, {
        cropPrices: { corn: 0.6 },
        yieldMultiplier: 0.8,
        productionMultiplier: 0.5,
      }).state.coins,
    ).toBe(104);
  });
  it("pays the relief fund its share and names it", () => {
    const result = harvest(ripeCorn(), 0, { harvestTax: 0.1 });
    expect(result.state.coins).toBe(131);
    expect(result.message).toBe(
      "Corn harvested! +31 coins (−3 to the relief fund).",
    );
    expect(harvest(ripeCorn(), 0).message).toBe("Corn harvested! +34 coins.");
  });
  it("takes sales over the season's limit for nothing and does not count them", () => {
    const policy = { quota: 1 };
    let result = harvest(ripeCorn(2), 0, policy, 2);
    expect(result.state.seasonSales).toEqual({ turn: 2, count: 1 });
    expect(result.state.coins).toBe(134);
    result = harvest(result.state, 1, policy, 2);
    expect(result.state.coins).toBe(134);
    expect(result.state.plots[1]).toBeNull();
    expect(result.state.harvests.corn).toBe(13);
    expect(result.state.seasonSales).toEqual({ turn: 2, count: 1 });
    expect(result.message).toBe(
      "Corn harvested. Over this season's sales limit: taken for nothing.",
    );
    const nextSeason = harvest(
      { ...ripeCorn(), seasonSales: { turn: 2, count: 1 } },
      0,
      policy,
      3,
    );
    expect(nextSeason.state.coins).toBe(134);
    expect(nextSeason.state.seasonSales).toEqual({ turn: 3, count: 1 });
    expect(harvest(ripeCorn(), 0, { quota: 0 }).state.harvests.corn).toBe(12);
    expect(harvest(ripeCorn(), 0).state.seasonSales).toBeUndefined();
  });
  it("holds sales of an oversized crop until next season", () => {
    const policy = { sellDelay: { corn: 1 }, harvestTax: 0.1 };
    const held = harvest(ripeCorn(2), 0, policy);
    expect(held.state.coins).toBe(100);
    expect(held.state.held).toBe(31);
    expect(held.state.harvests.corn).toBe(13);
    expect(held.message).toBe(
      "Corn harvested! +31 coins held until next season (−3 to the relief fund).",
    );
    const sold = harvest(held.state, 1, policy);
    expect(sold.state.coins).toBe(131);
    expect(sold.state.held).toBe(31);
  });
  it("pays what is owed before coins", () => {
    const result = harvest({ ...ripeCorn(1, 0), owed: 10 }, 0);
    expect(result.state.coins).toBe(24);
    expect(result.state.owed).toBeUndefined();
    expect(result.message).toBe(
      "Corn harvested! +34 coins. 10 paid toward what you owe.",
    );
    const work = actOnFarm(
      { ...establishedFarm(), coins: 0, owed: 6 },
      {
        type: "work",
      },
    );
    expect(work.state).toMatchObject({ coins: 0, owed: 2 });
  });
  it("sells fruit through the same prices, tax, quota and debts", () => {
    const farm = {
      ...establishedFarm(),
      coins: 0,
      owed: 5,
      nextStructureId: 3,
      structures: [
        ...establishedFarm().structures,
        {
          id: 2,
          kind: "apple" as const,
          row: 0,
          col: 0,
          level: 1,
          age: 12,
          product: true,
        },
      ],
    };
    const tree = { type: "harvestTree", id: 2 } as const;
    const policy = {
      cropPrices: { apple: 0.5 },
      harvestTax: 0.1,
      yieldMultiplier: 0,
      quota: 1,
    };
    const result = actOnFarm(farm, tree, { turn: 3, policy });
    expect(result.state).toMatchObject({
      coins: 6,
      seasonSales: { turn: 3, count: 1 },
    });
    expect(result.state.owed).toBeUndefined();
    expect(result.message).toBe(
      "Apples harvested! +11 coins (−1 to the relief fund). 5 paid toward what you owe.",
    );
    const over = actOnFarm(
      { ...farm, seasonSales: { turn: 3, count: 1 } },
      tree,
      { turn: 3, policy },
    );
    expect(over.state.coins).toBe(0);
    expect(over.state.structures.at(-1)?.product).toBe(false);
  });
});

describe("water at the season change", () => {
  function thirstyFarm() {
    const farm = establishedFarm();
    farm.plots[0] = { crop: "corn", growth: 0 };
    farm.plots[1] = { crop: "turnip", growth: 0 };
    farm.plots[2] = { crop: "tomato", growth: 0 };
    farm.plots[3] = { crop: "pumpkin", growth: 0 };
    farm.plots[4] = { crop: "corn", growth: 2 };
    farm.plots[5] = { crop: "corn", growth: 1, withered: true };
    return farm;
  }
  it("waters every thirsty growing crop and leaves the rest alone", () => {
    const result = waterCrops(thirstyFarm(), {
      drought: false,
      protectedFromDrought: false,
    });
    expect(result).toMatchObject({ watered: 3, dried: 0, withered: 0 });
    expect(result.state.plots).toEqual(thirstyFarm().plots);
  });
  it("dries watered crops in an unprotected drought", () => {
    const result = waterCrops(thirstyFarm(), {
      drought: true,
      protectedFromDrought: false,
    });
    expect(result).toMatchObject({ watered: 3, dried: 3, withered: 0 });
    expect(result.state.plots.slice(0, 6)).toEqual([
      { crop: "corn", growth: 0, dry: true },
      { crop: "turnip", growth: 0 },
      { crop: "tomato", growth: 0, dry: true },
      { crop: "pumpkin", growth: 0, dry: true },
      { crop: "corn", growth: 2 },
      { crop: "corn", growth: 1, withered: true },
    ]);
    expect(
      waterCrops(result.state, { drought: true, protectedFromDrought: false })
        .dried,
    ).toBe(0);
    expect(
      waterCrops(thirstyFarm(), { drought: true, protectedFromDrought: true })
        .dried,
    ).toBe(0);
  });
  it("keeps only the plots watered with bought water from drying", () => {
    const result = waterCrops(thirstyFarm(), {
      drought: true,
      protectedFromDrought: false,
      wateredPlots: [1, 4],
    });
    expect(result).toMatchObject({ watered: 3, dried: 1, withered: 0 });
    expect(result.state.plots.slice(0, 4)).toEqual([
      { crop: "corn", growth: 0 },
      { crop: "turnip", growth: 0 },
      { crop: "tomato", growth: 0, dry: true },
      { crop: "pumpkin", growth: 0 },
    ]);
  });
  it("withers thirsty crops past the irrigation cap by plot order, rounding the share", () => {
    const result = waterCrops(thirstyFarm(), {
      drought: true,
      protectedFromDrought: false,
      irrigationCap: 0.4,
    });
    expect(result).toMatchObject({ watered: 1, dried: 1, withered: 2 });
    expect(result.state.plots.slice(0, 4)).toEqual([
      { crop: "corn", growth: 0, dry: true },
      { crop: "turnip", growth: 0 },
      { crop: "tomato", growth: 0, withered: true },
      { crop: "pumpkin", growth: 0, withered: true },
    ]);
    // About 60% of three crops is two; 60% of one crop rounds up to that crop.
    const cap = (farm: MicroState, irrigationCap: number) =>
      waterCrops(farm, {
        drought: false,
        protectedFromDrought: false,
        irrigationCap,
      });
    expect(cap(thirstyFarm(), 0.6)).toMatchObject({ watered: 2, withered: 1 });
    const lone = establishedFarm();
    lone.plots[0] = { crop: "tomato", growth: 0 };
    expect(cap(lone, 0.6)).toMatchObject({ watered: 1, withered: 0 });
    expect(cap(lone, 0.4)).toMatchObject({ watered: 0, withered: 1 });
    expect(() =>
      waterCrops(thirstyFarm(), {
        drought: false,
        protectedFromDrought: false,
        irrigationCap: 1.5,
      }),
    ).toThrow(/irrigation cap/);
  });
  it("grows dry crops, skips withered ones and clears everything in winter", () => {
    const farm = establishedFarm();
    farm.plots[0] = { crop: "corn", growth: 0, dry: true };
    farm.plots[1] = { crop: "corn", growth: 0, withered: true };
    const grown = growCrops(farm);
    expect(grown.plots.slice(0, 2)).toEqual([
      { crop: "corn", growth: 1, dry: true },
      { crop: "corn", growth: 0, withered: true },
    ]);
    expect(growCrops(grown, {}, true).plots.every((p) => p === null)).toBe(
      true,
    );
    const ripe = growCrops(grown);
    const dry = harvest(ripe, 0);
    expect(dry.state.coins).toBe(117);
    expect(dry.state.harvests.corn).toBe(13);
  });
});

describe("council rules for buildings", () => {
  it("delays construction and upgrades by permit seasons", () => {
    let state: MicroState = { ...establishedFarm(), coins: 10000 };
    const result = actOnFarm(
      state,
      { type: "build", kind: "barn", cell: { row: 0, col: 0 } },
      { turn: 1, policy: { buildDelay: 1 } },
    );
    expect(result.message).toBe(
      "Harvest barn construction started. Ready in 2 seasons. −600 coins.",
    );
    state = result.state;
    const id = state.structures.at(-1)!.id;
    expect(state.structures.at(-1)).toMatchObject({
      pendingConstruction: true,
      wait: 1,
    });
    state = completeUpgrades(state);
    expect(state.structures.at(-1)?.pendingConstruction).toBe(true);
    expect(state.structures.at(-1)?.wait).toBeUndefined();
    expect(harvestValue(state, "turnip")).toBe(9);
    state = completeUpgrades(state);
    expect(state.structures.at(-1)?.pendingConstruction).toBeUndefined();
    expect(harvestValue(state, "turnip")).toBe(11);
    state.harvests.turnip += 12;
    const upgrade = actOnFarm(
      state,
      { type: "upgrade", id },
      { turn: 3, policy: { buildDelay: 2 } },
    );
    expect(upgrade.message).toContain("Level 2 completes in 3 seasons.");
    state = upgrade.state;
    for (const wait of [1, undefined, undefined]) {
      expect(state.structures.at(-1)).toMatchObject({
        level: 1,
        pendingUpgrade: true,
      });
      state = completeUpgrades(state);
      expect(state.structures.at(-1)?.wait).toBe(wait);
    }
    expect(state.structures.at(-1)).toMatchObject({ level: 2 });
    expect(state.structures.at(-1)?.pendingUpgrade).toBeUndefined();
  });
  it("does not delay saplings", () => {
    const state = actOnFarm(
      { ...establishedFarm(), coins: 1000 },
      { type: "build", kind: "apple", cell: { row: 0, col: 0 } },
      { turn: 1, policy: { buildDelay: 2 } },
    ).state;
    expect(state.structures.at(-1)?.wait).toBeUndefined();
  });
  it("freezes upgrades but still allows construction", () => {
    let state = { ...establishedFarm(), coins: 10000 };
    state = completeUpgrades(
      actOnFarm(state, {
        type: "build",
        kind: "barn",
        cell: { row: 0, col: 0 },
      }).state,
    );
    state.harvests.turnip += 12;
    const id = state.structures.at(-1)!.id;
    const frozen = { turn: 2, policy: { frozenUpgrades: true } };
    expect(() => actOnFarm(state, { type: "upgrade", id }, frozen)).toThrow(
      "Upgrades are frozen by the council.",
    );
    expect(
      actOnFarm(
        state,
        { type: "build", kind: "barn", cell: { row: 4, col: 0 } },
        frozen,
      ).state.structures,
    ).toHaveLength(3);
  });
  it("unlocks buildings without their milestone", () => {
    const farm = { ...initialMicroState(), coins: 1000 };
    const well = {
      type: "build",
      kind: "well",
      cell: { row: 0, col: 0 },
    } as const;
    expect(() => actOnFarm(farm, well)).toThrow(/Harvest 12/);
    const state = actOnFarm(farm, well, {
      turn: 1,
      policy: { unlockedBuildings: ["well"] },
    }).state;
    expect(state.structures.at(-1)?.kind).toBe("well");
    expect(() =>
      actOnFarm(farm, well, {
        turn: 1,
        policy: { unlockedBuildings: ["well"], blockedBuildings: ["well"] },
      }),
    ).toThrow(/restricted/);
  });
  it("seals building benefits without removing the buildings", () => {
    let state = { ...establishedFarm(), coins: 100000 };
    for (const [i, kind] of (
      ["well", "shed", "market", "mill"] as const
    ).entries())
      state = actOnFarm(
        state,
        { type: "build", kind, cell: { row: 0, col: i * 4 } },
        1,
      ).state;
    state = completeUpgrades(state);
    const sealed = { sealedBuildings: ["well", "shed", "market", "mill"] };
    expect(buildingLevel(state, "well")).toBe(1);
    expect(buildingLevel(state, "well", sealed)).toBe(0);
    expect(harvestValue(state, "corn")).toBe(34 + 1 + 15);
    expect(harvestValue(state, "corn", sealed)).toBe(34);
    expect(seedCost(state, "corn", sealed)).toBe(12);
    expect(seasonalIncome(state, sealed)).toBe(0);
    state = plant(state, 0).state;
    expect(growCrops(state).plots[0]?.growth).toBe(2);
    expect(growCrops(state, sealed).plots[0]?.growth).toBe(1);
    expect(growCrops(state, sealed).structures).toEqual(state.structures);
  });
});

describe("council actions", () => {
  function droughtFarm(coins = 100) {
    const farm = { ...establishedFarm(), coins };
    farm.plots[0] = { crop: "corn", growth: 0 };
    farm.plots[1] = { crop: "tomato", growth: 0 };
    farm.plots[2] = { crop: "turnip", growth: 0 };
    farm.plots[3] = { crop: "corn", growth: 2 };
    return farm;
  }
  const trade = { waterTrade: { buy: 12, sell: 6 } };
  it("buys water for thirsty growing crops only in a drought", () => {
    const buy = { type: "buyWater" } as const;
    expect(() =>
      actOnFarm(droughtFarm(), buy, { turn: 2, policy: trade }),
    ).toThrow(/only during a drought/);
    expect(() =>
      actOnFarm(droughtFarm(), buy, { turn: 2, drought: true }),
    ).toThrow("The council's rules don't allow trading water.");
    const bought = actOnFarm(droughtFarm(), buy, {
      turn: 2,
      policy: trade,
      drought: true,
    });
    expect(bought.state.coins).toBe(76);
    expect(bought.state.water).toEqual({
      turn: 2,
      choice: "bought",
      plots: [1, 2],
    });
    expect(bought.message).toBe("Water bought for 2 thirsty crops. −24 coins.");
    expect(() =>
      actOnFarm(bought.state, buy, { turn: 2, policy: trade, drought: true }),
    ).toThrow("Your thirsty crops already have water.");
    // A crop planted after the purchase needs water of its own, and only it is charged.
    const planted = plant(bought.state, 4, {}, "tomato", 2).state;
    const again = actOnFarm(planted, buy, {
      turn: 2,
      policy: trade,
      drought: true,
    });
    expect(planted.coins - again.state.coins).toBe(12);
    expect(again.state.water).toEqual({
      turn: 2,
      choice: "bought",
      plots: [1, 2, 5],
    });
    expect(again.message).toBe("Water bought for 1 thirsty crop. −12 coins.");
    expect(() =>
      actOnFarm(
        bought.state,
        { type: "sellWater" },
        {
          turn: 2,
          policy: trade,
          drought: true,
        },
      ),
    ).toThrow("You bought water this season, so you cannot sell it.");
    // Last season's purchase waters nothing now.
    expect(
      actOnFarm(bought.state, buy, { turn: 6, policy: trade, drought: true })
        .state.water,
    ).toEqual({ turn: 6, choice: "bought", plots: [1, 2] });
    expect(() =>
      actOnFarm(droughtFarm(23), buy, {
        turn: 2,
        policy: trade,
        drought: true,
      }),
    ).toThrow(/Not enough coins/);
    expect(() =>
      actOnFarm(establishedFarm(), buy, {
        turn: 2,
        policy: trade,
        drought: true,
      }),
    ).toThrow(/no thirsty crops/);
  });
  it("leaves crops that already dried out of water trades", () => {
    const farm = droughtFarm();
    farm.plots[0] = { crop: "corn", growth: 1, dry: true };
    const context = { turn: 3, policy: trade, drought: true };
    const bought = actOnFarm(farm, { type: "buyWater" }, context);
    expect(bought.state.water).toEqual({
      turn: 3,
      choice: "bought",
      plots: [2],
    });
    expect(bought.message).toBe("Water bought for 1 thirsty crop. −12 coins.");
    expect(actOnFarm(farm, { type: "sellWater" }, context).message).toBe(
      "Water rights sold for 1 thirsty crop. +6 coins.",
    );
    farm.plots[1] = { crop: "tomato", growth: 0, dry: true };
    expect(() => actOnFarm(farm, { type: "buyWater" }, context)).toThrow(
      "Your thirsty crops already dried; water cannot help them now.",
    );
  });
  it("sells water rights and pays debts first", () => {
    const sold = actOnFarm(
      { ...droughtFarm(0), owed: 5 },
      { type: "sellWater" },
      { turn: 2, policy: trade, drought: true },
    );
    expect(sold.state).toMatchObject({
      coins: 7,
      water: { turn: 2, choice: "sold" },
    });
    expect(sold.state.owed).toBeUndefined();
    expect(sold.message).toBe(
      "Water rights sold for 2 thirsty crops. +12 coins. 5 paid toward what you owe.",
    );
    for (const type of ["buyWater", "sellWater"] as const)
      expect(() =>
        actOnFarm(
          sold.state,
          { type },
          { turn: 2, policy: trade, drought: true },
        ),
      ).toThrow("You already sold your water rights this season.");
  });
  it("files next season's permit at the council office", () => {
    const file = { type: "filePermit" } as const;
    const policy = { permitsRequired: true };
    expect(() => actOnFarm(establishedFarm(), file, 4)).toThrow(/not required/);
    let state = actOnFarm(establishedFarm(), file, { turn: 4, policy }).state;
    expect(state.permits).toEqual([5]);
    expect(() => actOnFarm(state, file, { turn: 4, policy })).toThrow(
      /already filed/,
    );
    state = actOnFarm({ ...state, permits: [4, 5] }, file, {
      turn: 5,
      policy,
    }).state;
    expect(state.permits).toEqual([5, 6]);
    expect(plant(state, 0, policy, "corn", 5).state.plots[0]?.crop).toBe(
      "corn",
    );
    expect(() =>
      actOnFarm(establishedFarm(), file, { turn: 160, policy }),
    ).toThrow(/no next season/);
    expect(withPermit(undefined, 3)).toEqual([3]);
    expect(withPermit([3, 4], 4)).toEqual([3, 4]);
    expect(withPermit([3, 4], 5)).toEqual([4, 5]);
  });
  it("locks one price contract at a time", () => {
    const lock = { type: "lockPrice" } as const;
    const policy = { forwardContract: { mult: 0.85, seasons: 4 } };
    expect(() => actOnFarm(establishedFarm(), lock, 9)).toThrow(/on offer/);
    const locked = actOnFarm(establishedFarm(), lock, { turn: 9, policy });
    expect(locked.state.contract).toEqual({ from: 9, until: 12, mult: 0.85 });
    expect(locked.message).toBe("Price locked at 85% for 4 seasons.");
    expect(() => actOnFarm(locked.state, lock, { turn: 12, policy })).toThrow(
      /already have/,
    );
    expect(
      actOnFarm(locked.state, lock, { turn: 13, policy }).state.contract,
    ).toEqual({ from: 13, until: 16, mult: 0.85 });
    expect(
      actOnFarm(establishedFarm(), lock, { turn: 159, policy }).state.contract,
    ).toEqual({ from: 159, until: 160, mult: 0.85 });
  });
});
