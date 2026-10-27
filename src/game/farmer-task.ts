import { buildings, cellAllowed, type Cell } from "../micro/world";
import type { MicroState } from "../micro/state";
import type { FarmPolicy } from "../contracts/farm-policy";
import type { FarmAction } from "../micro/rules";
import { farmerSpawn } from "./farmer-route";
export type FarmerTask = {
  target: Cell;
  action: FarmAction["type"] | "grow" | "walk" | "visit";
  width?: number;
  height?: number;
};
export function farmerTaskForAction(
  action: FarmAction | { type: "grow" },
  previous: MicroState,
  current: MicroState,
  policy?: FarmPolicy,
): FarmerTask | undefined {
  let target: Cell | undefined;
  if ("plot" in action) target = current.plotCells[action.plot];
  else if (
    action.type === "harvestFruit" ||
    action.type === "build" ||
    action.type === "move" ||
    action.type === "upgrade" ||
    action.type === "harvestTree"
  ) {
    const structure =
      action.type === "build"
        ? current.structures.at(-1)
        : current.structures.find((s) => s.id === action.id);
    if (!structure) return undefined;
    const { width, height } = buildings[structure.kind];
    return {
      target: { row: structure.row, col: structure.col },
      action: action.type === "harvestFruit" ? "harvest" : action.type,
      width,
      height,
    };
  } else if (action.type === "movePlot")
    target = current.plotCells[current.plotIds.indexOf(action.id)];
  else if (action.type === "expand") target = current.plotCells.at(-1);
  else if (action.type === "grow")
    target = current.plotCells.find((_, i) => {
      const before = previous.plots[i],
        after = current.plots[i];
      return (
        before &&
        after &&
        after.crop === before.crop &&
        after.growth > before.growth
      );
    });
  else
    target =
      current.plotCells.find((cell) => cellAllowed(cell, policy)) ??
      farmerSpawn({ layout: current, policy });
  return target
    ? { target: { row: target.row, col: target.col }, action: action.type }
    : undefined;
}
