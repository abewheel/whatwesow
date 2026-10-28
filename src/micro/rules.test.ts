import { describe, expect, it } from "vitest";
import { actOnFarm, growCrops, completeUpgrades } from "./rules";
import {
  crops,
  homesteadMicroState as initialMicroState,
  parseMicroState,
  type CropId,
} from "./state";
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
describe("farming loop", () => {
  it.each(Object.keys(crops) as CropId[])(
    "plants, grows, harvests, and replants %s without mutation",
    (crop) => {
      const start = establishedFarm();
      const context = {
        turn: crops[crop].plantingSeasons[0] === "summer" ? 2 : 1,
      };
      let state = actOnFarm(
        start,
        { type: "plant", plot: 0, crop },
        context,
      ).state;
      expect(state.coins).toBe(100 - crops[crop].seed);
      expect(start).toEqual(establishedFarm());
      expect(() => actOnFarm(state, { type: "harvest", plot: 0 })).toThrow();
      expect(() =>
        actOnFarm(state, { type: "plant", plot: 0, crop }),
      ).toThrow();
      for (let i = 0; i < crops[crop].steps; i++) state = growCrops(state);
      const ripe = state;
      state = actOnFarm(state, { type: "harvest", plot: 0 }).state;
      expect(state.coins).toBe(100 - crops[crop].seed + crops[crop].sale);
      expect(state.plots[0]).toBeNull();
      expect(ripe.plots[0]).not.toBeNull();
      expect(() => actOnFarm(state, { type: "harvest", plot: 0 })).toThrow();
      expect(
        actOnFarm(state, { type: "plant", plot: 0, crop }, context).state
          .plots[0]?.growth,
      ).toBe(0);
    },
  );
  it("retains ripe crops while slower crops grow", () => {
    let state = actOnFarm(establishedFarm(), {
      type: "plant",
      plot: 0,
      crop: "turnip",
    }).state;
    state = actOnFarm(state, { type: "plant", plot: 1, crop: "corn" }).state;
    for (let i = 0; i < 3; i++) state = growCrops(state);
    expect(state.plots.slice(0, 2)).toEqual([
      { crop: "turnip", growth: 1 },
      { crop: "corn", growth: 2 },
    ]);
  });
  it("spends earnings on land and permanent harvest improvements", () => {
    let state = { ...establishedFarm(), coins: 500 };
    state = actOnFarm(state, { type: "expand" }).state;
    expect(state.plots).toHaveLength(10);
    expect(state.coins).toBe(470);
    state = actOnFarm(state, { type: "improve" }).state;
    expect(state.coins).toBe(390);
    state = actOnFarm(state, { type: "plant", plot: 9, crop: "turnip" }).state;
    state = completeUpgrades(growCrops(state));
    expect(actOnFarm(state, { type: "harvest", plot: 9 }).state.coins).toBe(
      398,
    );
  });
  it("rejects unavailable actions, bad plots, and invalid imported state", () => {
    const poor = { ...establishedFarm(), coins: 0 };
    for (const action of [
      { type: "plant", plot: 0, crop: "corn" },
      { type: "expand" },
      { type: "improve" },
    ] as const)
      expect(() => actOnFarm(poor, action)).toThrow();
    for (const plot of [-1, 9, 0.5])
      expect(() => actOnFarm(poor, { type: "harvest", plot })).toThrow();
    expect(() =>
      actOnFarm({ ...poor, plots: Array(49).fill(null) }, { type: "expand" }),
    ).toThrow();
    expect(() =>
      actOnFarm({ ...poor, soilLevel: 3 }, { type: "improve" }),
    ).toThrow();
    for (const fields of [
      { plots: [null] },
      { soilLevel: 4 },
      { plots: Array(9).fill({ crop: "corn", growth: 4 }) },
      { plots: Array(9).fill({ crop: "__proto__", growth: 0 }) },
    ])
      expect(() => parseMicroState({ ...poor, ...fields })).toThrow();
  });
  it("rejects unsafe money totals on harvest", () => {
    const state = { ...establishedFarm(), coins: Number.MAX_SAFE_INTEGER };
    state.plots[0] = { crop: "turnip", growth: 1 };
    expect(() => actOnFarm(state, { type: "harvest", plot: 0 })).toThrow();
  });
});
it("offers a bounded way back when no seeds or crops remain", () => {
  const poor = { ...establishedFarm(), coins: 0 };
  const recovered = actOnFarm(poor, { type: "work" }).state;
  expect(recovered.coins).toBe(4);
  expect(() => actOnFarm(recovered, { type: "work" })).toThrow();
  expect(
    actOnFarm(recovered, { type: "plant", plot: 0, crop: "turnip" }).state
      .coins,
  ).toBe(0);
  poor.plots[0] = { crop: "corn", growth: 0 };
  expect(() => actOnFarm(poor, { type: "work" })).toThrow();
});

it.each(Object.keys(crops) as CropId[])(
  "enforces every planting season for %s",
  (crop) => {
    for (const [index, season] of [
      "spring",
      "summer",
      "fall",
      "winter",
    ].entries()) {
      const plant = () =>
        actOnFarm(
          establishedFarm(),
          { type: "plant", plot: 0, crop },
          { turn: index + 1 },
        );
      if ((crops[crop].plantingSeasons as readonly string[]).includes(season))
        expect(plant().state.plots[0]?.crop).toBe(crop);
      else expect(plant).toThrow(/can be planted/);
    }
  },
);
it("winter clears ripe and growing crops even on restricted land without touching trees", () => {
  const state = establishedFarm();
  for (const [index, crop] of (Object.keys(crops) as CropId[]).entries())
    state.plots[index] = { crop, growth: 0 };
  state.plots[0] = { crop: "turnip", growth: 1 };
  const winter = growCrops(state, { land: [] }, true);
  expect(winter.plots.every((plot) => plot === null)).toBe(true);
  expect(winter.structures).toEqual(state.structures);
  expect(state.plots[0]).not.toBeNull();
});
