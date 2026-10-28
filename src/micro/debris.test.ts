import { expect, it } from "vitest";
import { initialMicroState, parseMicroState } from "./state";
import { actOnFarm } from "./rules";
import { canPlace, debrisTypes, debrisFootprint } from "./world";

it("starts with varied debris and leaves a house-sized starter lot", () => {
  const farm = parseMicroState(initialMicroState());
  expect(farm.debris!.length).toBeGreaterThan(120);
  expect(new Set(farm.debris!.map((d) => d.kind)).size).toBe(7);
  expect(canPlace(farm, { row: 14, col: 16 }, 5, 5)).toBe(true);
});
for (const kind of Object.keys(debrisTypes) as (keyof typeof debrisTypes)[])
  it(`clears ${kind} once for its quoted cost and frees every tile`, () => {
    const farm = initialMicroState();
    const item = farm.debris!.find((d) => d.kind === kind)!;
    const spec = debrisTypes[kind];
    const cell = debrisFootprint(item).at(-1)!;
    expect(canPlace(farm, cell)).toBe(false);
    const result = actOnFarm(farm, { type: "clearDebris", cell }).state;
    expect(result.coins).toBe(farm.coins - spec.cost);
    expect(debrisFootprint(item).every((c) => canPlace(result, c))).toBe(true);
    expect(() => actOnFarm(result, { type: "clearDebris", cell })).toThrow();
    expect(farm.debris).toContain(item);
    expect(parseMicroState(result).debris).toEqual(result.debris);
  });
it("refuses unaffordable clearing and malformed or overlapping debris", () => {
  const farm = initialMicroState();
  const cell = farm.debris!.find((d) => d.kind === "boulder")!;
  expect(() =>
    actOnFarm({ ...farm, coins: 0 }, { type: "clearDebris", cell }),
  ).toThrow("costs 24");
  expect(() => parseMicroState({ ...farm, debris: [cell, cell] })).toThrow(
    "overlap",
  );
  expect(() =>
    parseMicroState({ ...farm, debris: [{ ...cell, kind: "bad" }] }),
  ).toThrow("Unknown debris");
  expect(
    parseMicroState({ ...farm, debris: undefined }).debris,
  ).toBeUndefined();
});

it("reserves exactly nine outcrop tiles and five L-shaped tree tiles", () => {
  const farm = {
    ...initialMicroState(),
    debris: [{ kind: "fallenTree" as const, row: 30, col: 30 }],
  };
  expect(debrisFootprint(farm.debris[0])).toHaveLength(5);
  expect(debrisFootprint({ kind: "rockpile", row: 40, col: 40 })).toHaveLength(
    9,
  );
  for (const cell of debrisFootprint(farm.debris[0]))
    expect(canPlace(farm, cell)).toBe(false);
  expect(canPlace(farm, { row: 31, col: 31 }, 2, 2)).toBe(true);
  expect(() =>
    actOnFarm(farm, { type: "clearDebris", cell: { row: 31, col: 31 } }),
  ).toThrow();
  const result = actOnFarm(farm, {
    type: "clearDebris",
    cell: { row: 32, col: 30 },
  }).state;
  expect(result.coins).toBe(farm.coins - 36);
  expect(canPlace(result, { row: 30, col: 30 }, 3, 3)).toBe(true);
});

it("clears partly revoked debris from retained land without allowing work on taken tiles", () => {
  const state = {
    ...initialMicroState(),
    debris: [{ kind: "boulder" as const, row: 30, col: 30 }],
  };
  const taken = { row: 30, col: 31 };
  const policy = { takenCells: [taken] };
  expect(() =>
    actOnFarm(state, { type: "clearDebris", cell: taken }, { turn: 1, policy }),
  ).toThrow("outside the current land grant");
  const result = actOnFarm(
    state,
    { type: "clearDebris", cell: { row: 30, col: 30 } },
    { turn: 1, policy },
  ).state;
  expect(result.coins).toBe(state.coins - 24);
  expect(result.debris).toEqual([]);
  expect(canPlace(result, { row: 30, col: 30 }, 1, 1, policy)).toBe(true);
  expect(canPlace(result, taken, 1, 1, policy)).toBe(false);
  expect(state.debris).toHaveLength(1);
});
