import { expect, it } from "vitest";
import {
  homesteadMicroState as initialMicroState,
  parseMicroState,
} from "./state";
import { completeUpgrades, actOnFarm } from "./rules";
import { seasonTrees } from "./world";
it.each([
  ["apple", 12, 24],
  ["oak", 40, 8],
] as const)(
  "grows %s by seasons and harvests once each fall",
  (kind, maturity, value) => {
    let state = actOnFarm(
      {
        ...initialMicroState(),
        harvests: {
          radish: 0,
          tomato: 0,
          pumpkin: 0,
          turnip: 6,
          carrot: 0,
          corn: 0,
        },
      },
      { type: "build", kind, cell: { row: 0, col: 0 } },
      5,
    ).state;
    expect(state.structures.at(-1)?.age ?? 0).toBe(0);
    expect(() => actOnFarm(state, { type: "harvestTree", id: 2 })).toThrow();
    for (let age = 1; age <= maturity; age++) {
      state = completeUpgrades(state);
      state.structures = seasonTrees(state.structures, "fall");
      expect(state.structures.at(-1)?.product).toBe(age === maturity);
    }
    const before = state.coins;
    state = actOnFarm(state, { type: "harvestTree", id: 2 }).state;
    expect(state.coins).toBe(before + value);
    expect(() => actOnFarm(state, { type: "harvestTree", id: 2 })).toThrow();
    state.structures = seasonTrees(state.structures, "winter");
    expect(state.structures.at(-1)).toMatchObject({
      age: maturity + 1,
      product: false,
    });
    state.structures = seasonTrees(state.structures, "fall");
    state.structures = seasonTrees(state.structures, "winter");
    expect(parseMicroState(state).structures.at(-1)?.product).toBe(true);
  },
);
