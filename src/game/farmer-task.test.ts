import { expect, it } from "vitest";
import { initialMicroState } from "../micro/state";
import { actOnFarm } from "../micro/rules";
import { farmerTaskForAction } from "./farmer-task";
it("waters the crop that grew rather than an excluded immature crop", () => {
  const previous = initialMicroState();
  previous.plots[0] = { crop: "turnip", growth: 0 };
  previous.plots[1] = { crop: "turnip", growth: 0 };
  const cell = previous.plotCells[1];
  const policy = { land: [{ ...cell, width: 1, height: 1 }] };
  const current = actOnFarm(
    previous,
    { type: "grow" },
    { turn: 1, policy },
  ).state;
  expect(current.plots[0]?.growth).toBe(0);
  expect(
    farmerTaskForAction({ type: "grow" }, previous, current, policy)?.target,
  ).toEqual(cell);
});
it("keeps building dimensions for perimeter routing", () => {
  const previous = initialMicroState();
  previous.coins = 500;
  const action = {
    type: "build" as const,
    kind: "shed" as const,
    cell: { row: 0, col: 0 },
  };
  const current = actOnFarm(previous, action).state;
  expect(farmerTaskForAction(action, previous, current)).toMatchObject({
    target: action.cell,
    width: 2,
    height: 2,
  });
});
