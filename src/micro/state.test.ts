import { expect, it } from "vitest";
import { initialMicroState, parseMicroState } from "./state";
it("accepts arbitrary farming balances and rejects unsafe money", () => {
  expect(parseMicroState({ coins: 5000 })).toEqual({ coins: 5000 });
  expect(() => parseMicroState({ coins: -1 })).toThrow();
  expect(() =>
    parseMicroState({ coins: Number.MAX_SAFE_INTEGER + 1 }),
  ).toThrow();
  expect(initialMicroState()).toEqual({ coins: 100 });
});
