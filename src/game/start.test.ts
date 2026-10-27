import { expect, it } from "vitest";
import { initialState, advanceSeason, parseState } from "./state";
import { actOnFarm } from "../micro/rules";
import { serviceLocations } from "../micro/world";
import { canBuild } from "../micro/progression";
it("starts from bare land and keeps the tent until the paid house completes", () => {
  const start = initialState();
  expect(start.structures).toEqual([]);
  expect(start.plots).toEqual([]);
  expect(start.coins).toBe(240);
  expect(serviceLocations(start).map((s) => s.name)).toEqual(["Your tent"]);
  expect(canBuild(start, "oak")).toBe(false);
  const building = {
    ...start,
    ...actOnFarm(start, {
      type: "build",
      kind: "home",
      cell: { row: 14, col: 14 },
    }).state,
  };
  expect(building.coins).toBe(120);
  expect(building.structures[0].pendingConstruction).toBe(true);
  expect(serviceLocations(building)).toHaveLength(1);
  expect(() =>
    actOnFarm(building, {
      type: "build",
      kind: "home",
      cell: { row: 20, col: 20 },
    }),
  ).toThrow(/already/);
  const next = advanceSeason(building).state;
  expect(next.season).toBe("summer");
  expect(next.structures[0].pendingConstruction).toBeUndefined();
  expect(serviceLocations(next)).toEqual([]);
  expect(parseState(JSON.parse(JSON.stringify(next)))).toEqual(next);
});
it("can end the first season without commissioning a house", () => {
  const next = advanceSeason(initialState()).state;
  expect(next.season).toBe("summer");
  expect(serviceLocations(next)[0].tent).toBe(true);
});
