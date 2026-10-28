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

function councilState() {
  const state = initialMicroState();
  state.plots[0] = { crop: "corn", growth: 1, dry: true, premium: "good" };
  state.plots[1] = { crop: "tomato", growth: 0, withered: true };
  state.structures.push({
    id: 2,
    kind: "barn",
    row: 0,
    col: 0,
    level: 1,
    pendingConstruction: true,
    wait: 2,
  });
  return {
    ...state,
    nextStructureId: 3,
    owed: 12,
    held: 31,
    permits: [5, 6],
    lastCrops: { "1": "corn" as const, "2": "tomato" as const },
    seasonSales: { turn: 5, count: 0 },
    water: { turn: 6, choice: "bought" as const, plots: [1] },
    contract: { from: 9, until: 12, mult: 0.85 },
  };
}
it("round trips council fields, crop conditions and permit delays", () => {
  const state = councilState();
  expect(parseMicroState(JSON.parse(JSON.stringify(state)))).toEqual({
    ...state,
    opportunities: ["corn", "barn"],
  });
  const bare = parseMicroState(initialMicroState());
  for (const key of [
    "owed",
    "held",
    "permits",
    "lastCrops",
    "seasonSales",
    "water",
    "contract",
  ])
    expect(key in bare).toBe(false);
  expect(
    parseMicroState({ ...state, permits: [], lastCrops: { "99": "corn" } }),
  ).not.toHaveProperty("permits");
  expect(
    parseMicroState({ ...state, lastCrops: { "99": "corn", "2": "corn" } })
      .lastCrops,
  ).toEqual({ "2": "corn" });
  expect(
    parseMicroState({
      ...state,
      plots: [{ crop: "corn", growth: 0, extra: 1 }, ...state.plots.slice(1)],
    }).plots[0],
  ).toEqual({ crop: "corn", growth: 0 });
});
it("keeps bought water on the plots it reached", () => {
  const state = councilState();
  // Plot 2's tomato withered, so it is not thirsty; plot 99 is not on the farm.
  expect(
    parseMicroState({
      ...state,
      water: { turn: 6, choice: "bought", plots: [99, 1] },
    }).water,
  ).toEqual({ turn: 6, choice: "bought", plots: [1] });
  // Water bought before it was counted per plot reached the thirsty crops growing then.
  expect(
    parseMicroState({ ...state, water: { turn: 6, choice: "bought" } }).water,
  ).toEqual({ turn: 6, choice: "bought", plots: [1] });
  expect(
    parseMicroState({ ...state, water: { turn: 6, choice: "sold" } }).water,
  ).toEqual({ turn: 6, choice: "sold" });
});
it.each([
  { owed: 0 },
  { owed: -1 },
  { owed: 1.5 },
  { held: 0 },
  { held: "31" },
  { permits: [6, 5] },
  { permits: [5, 5] },
  { permits: [4, 5, 6] },
  { permits: [0] },
  { permits: [161] },
  { permits: 5 },
  { lastCrops: { "1": "wheat" } },
  { lastCrops: ["corn"] },
  { seasonSales: { turn: 0, count: 1 } },
  { seasonSales: { turn: 5, count: -1 } },
  { water: { turn: 5, choice: "stolen" } },
  { water: { turn: 161, choice: "sold" } },
  { water: { turn: 6, choice: "sold", plots: [1] } },
  { water: { turn: 6, choice: "bought", plots: 1 } },
  { water: { turn: 6, choice: "bought", plots: [1, 1] } },
  { water: { turn: 6, choice: "bought", plots: [0] } },
  { contract: { from: 9, until: 8, mult: 0.85 } },
  { contract: { from: 9, until: 161, mult: 0.85 } },
  { contract: { from: 9, until: 12, mult: 11 } },
  { contract: { from: 9, until: 12 } },
  { plots: [{ crop: "corn", growth: 0, dry: false }] },
  { plots: [{ crop: "corn", growth: 0, withered: 1 }] },
  { plots: [{ crop: "corn", growth: 0, premium: "great" }] },
  {
    structures: [{ id: 1, kind: "home", row: 11, col: 14, level: 1, wait: 1 }],
  },
  {
    structures: [
      {
        id: 1,
        kind: "home",
        row: 11,
        col: 14,
        level: 1,
        pendingConstruction: true,
        wait: 5,
      },
    ],
  },
])("rejects invalid council fields: %j", (patch) => {
  const state = { ...councilState(), ...patch };
  if (patch.plots) {
    state.plotCells = state.plotCells.slice(0, 1);
    state.plotIds = state.plotIds.slice(0, 1);
  }
  expect(() => parseMicroState(state)).toThrow();
});
