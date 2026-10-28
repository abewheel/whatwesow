import { expect, it } from "vitest";
import {
  homesteadMicroState as initialMicroState,
  parseMicroState,
} from "./state";
it("accepts arbitrary farming balances and rejects unsafe money", () => {
  expect(parseMicroState({ ...initialMicroState(), coins: 5000 })).toEqual({
    ...initialMicroState(),
    coins: 5000,
  });
  expect(() => parseMicroState({ coins: -1 })).toThrow();
  expect(() =>
    parseMicroState({ coins: Number.MAX_SAFE_INTEGER + 1 }),
  ).toThrow();
  expect(initialMicroState().coins).toBe(100);
});

it("loads old harvest histories and ripe corn saves", () => {
  const state = initialMicroState();
  state.plots[0] = { crop: "corn", growth: 3 };
  const loaded = parseMicroState({
    ...state,
    harvests: { turnip: 2, carrot: 1, corn: 4 },
  });
  expect(loaded.harvests).toEqual({
    turnip: 2,
    carrot: 1,
    corn: 4,
    radish: 0,
    tomato: 0,
    pumpkin: 0,
  });
  expect(loaded.plots[0]).toEqual({ crop: "corn", growth: 2 });
});
