import { describe, expect, it } from "vitest";
import { actOnFarm } from "./rules";
import {
  crops,
  initialMicroState,
  parseMicroState,
  type CropId,
} from "./state";
describe("farming loop", () => {
  it.each(Object.keys(crops) as CropId[])(
    "plants, grows, harvests, and replants %s without mutation",
    (crop) => {
      const start = initialMicroState();
      let state = actOnFarm(start, { type: "plant", plot: 0, crop }).state;
      expect(state.coins).toBe(100 - crops[crop].seed);
      expect(start).toEqual(initialMicroState());
      expect(() => actOnFarm(state, { type: "harvest", plot: 0 })).toThrow();
      expect(() =>
        actOnFarm(state, { type: "plant", plot: 0, crop }),
      ).toThrow();
      for (let i = 0; i < crops[crop].steps; i++)
        state = actOnFarm(state, { type: "grow" }).state;
      const ripe = state;
      state = actOnFarm(state, { type: "harvest", plot: 0 }).state;
      expect(state.coins).toBe(100 - crops[crop].seed + crops[crop].sale);
      expect(state.plots[0]).toBeNull();
      expect(ripe.plots[0]).not.toBeNull();
      expect(() => actOnFarm(state, { type: "harvest", plot: 0 })).toThrow();
      expect(
        actOnFarm(state, { type: "plant", plot: 0, crop }).state.plots[0]
          ?.growth,
      ).toBe(0);
    },
  );
  it("retains ripe crops while slower crops grow", () => {
    let state = actOnFarm(initialMicroState(), {
      type: "plant",
      plot: 0,
      crop: "turnip",
    }).state;
    state = actOnFarm(state, { type: "plant", plot: 1, crop: "corn" }).state;
    for (let i = 0; i < 3; i++)
      state = actOnFarm(state, { type: "grow" }).state;
    expect(state.plots.slice(0, 2)).toEqual([
      { crop: "turnip", growth: 1 },
      { crop: "corn", growth: 3 },
    ]);
  });
  it("spends earnings on land and permanent harvest improvements", () => {
    let state = { ...initialMicroState(), coins: 500 };
    state = actOnFarm(state, { type: "expand" }).state;
    expect(state.plots).toHaveLength(10);
    expect(state.coins).toBe(470);
    state = actOnFarm(state, { type: "improve" }).state;
    expect(state.coins).toBe(390);
    state = actOnFarm(state, { type: "plant", plot: 9, crop: "turnip" }).state;
    state = actOnFarm(state, { type: "grow" }).state;
    expect(actOnFarm(state, { type: "harvest", plot: 9 }).state.coins).toBe(
      398,
    );
  });
  it("rejects unavailable actions, bad plots, and invalid imported state", () => {
    const poor = { ...initialMicroState(), coins: 0 };
    for (const action of [
      { type: "plant", plot: 0, crop: "corn" },
      { type: "expand" },
      { type: "improve" },
      { type: "grow" },
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
    const state = { ...initialMicroState(), coins: Number.MAX_SAFE_INTEGER };
    state.plots[0] = { crop: "turnip", growth: 1 };
    expect(() => actOnFarm(state, { type: "harvest", plot: 0 })).toThrow();
  });
});
it("offers a bounded way back when no seeds or crops remain", () => {
  const poor = { ...initialMicroState(), coins: 0 };
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
