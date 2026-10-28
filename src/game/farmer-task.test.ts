import { expect, it } from "vitest";
import { homesteadMicroState as initialMicroState } from "../micro/state";
import { actOnFarm, growCrops } from "../micro/rules";
import { farmerTaskForAction } from "./farmer-task";
it("waters the crop that grew rather than an excluded immature crop", () => {
  const previous = initialMicroState();
  previous.plots[0] = { crop: "turnip", growth: 0 };
  previous.plots[1] = { crop: "turnip", growth: 0 };
  const cell = previous.plotCells[1];
  const policy = { land: [{ ...cell, width: 1, height: 1 }] };
  const current = growCrops(previous, policy);
  expect(current.plots[0]?.growth).toBe(0);
  expect(
    farmerTaskForAction({ type: "grow" }, previous, current, policy)?.target,
  ).toEqual(cell);
});
it("keeps building dimensions for perimeter routing", () => {
  const previous = initialMicroState();
  previous.coins = 500;
  previous.harvests.turnip = 3;
  const action = {
    type: "build" as const,
    kind: "shed" as const,
    cell: { row: 0, col: 0 },
  };
  const current = actOnFarm(previous, action).state;
  expect(farmerTaskForAction(action, previous, current)).toMatchObject({
    target: action.cell,
    width: 3,
    height: 3,
  });
});
it("does not queue work at an unrelated cell after removing land or buildings", () => {
  const farm = initialMicroState();
  expect(
    farmerTaskForAction(
      { type: "deletePlot", id: farm.plotIds[0] },
      farm,
      farm,
    ),
  ).toBeUndefined();
  expect(
    farmerTaskForAction(
      { type: "teardown", id: farm.structures[0].id },
      farm,
      farm,
    ),
  ).toBeUndefined();
});
