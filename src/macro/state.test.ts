import { expect, it } from "vitest";
import { initialMacroState, parseMacroState } from "./state";
it("accepts every season across the lifetime boundaries", () => {
  for (const year of [1, 20, 40])
    for (const season of ["spring", "summer", "fall", "winter"])
      expect(parseMacroState({ year, season })).toEqual({ year, season });
  expect(() => parseMacroState({ year: 41, season: "spring" })).toThrow();
  expect(initialMacroState()).toEqual({ year: 1, season: "spring" });
});
it("parses crisis records by shape and bounds, dropping unknown fields", () => {
  const record = {
    id: "Price crash",
    turn: 37,
    pick: "P-PRO-M",
    prices: { corn: 34 },
    cells: [{ row: 63, col: 0 }],
    limits: { shed: 1 },
    loan: 180,
  };
  const macro = { year: 10, season: "spring", crises: [record] };
  expect(parseMacroState({ ...macro, crises: [{ ...record, x: 1 }] })).toEqual(
    macro,
  );
  expect(parseMacroState({ year: 1, season: "spring", crises: [] })).toEqual({
    year: 1,
    season: "spring",
    crises: [],
  });
  for (const crises of [
    {},
    Array(9).fill(record),
    [{ ...record, id: "" }],
    [{ ...record, id: "x".repeat(41) }],
    [{ ...record, turn: 0 }],
    [{ ...record, turn: 161 }],
    [record, { ...record, turn: 37 }],
    [{ ...record, pick: 7 }],
    [{ ...record, crop: "c".repeat(41) }],
    [{ ...record, prices: { corn: -1 } }],
    [{ ...record, limits: { shed: 1.5 } }],
    [{ ...record, cells: [{ row: 64, col: 0 }] }],
    [{ ...record, loan: -5 }],
  ])
    expect(() => parseMacroState({ ...macro, crises })).toThrow();
});
