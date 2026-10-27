import { WORLD_CELLS } from "../contracts/world";
import { parseFarmPolicy, type FarmPolicy } from "../contracts/farm-policy";
import {
  buildings,
  buildingLevel,
  canPlace,
  WORLD_SIZE,
  occupiedCells,
  cellKey,
  upgradeTurn,
  upgradeCost,
  buildUnlock,
  cellAllowed,
  policyCost,
  policyProduction,
  type Cell,
  type BuildingKind,
} from "./world";
import {
  crops,
  expansionCost,
  harvestValue,
  parseMicroState,
  soilCost,
  seedCost,
  type CropId,
  type MicroState,
} from "./state";
export type FarmAction =
  | { type: "plant"; plot: number; crop: CropId }
  | { type: "harvest"; plot: number }
  | { type: "grow" }
  | { type: "work" }
  | { type: "expand"; cell?: Cell }
  | { type: "build"; kind: BuildingKind; cell: Cell }
  | { type: "upgrade"; id: number }
  | { type: "move"; id: number; cell: Cell }
  | { type: "movePlot"; id: number; cell: Cell }
  | { type: "improve" };
export type FarmContext = { turn: number; policy?: FarmPolicy };
export function actOnFarm(
  current: MicroState,
  action: FarmAction,
  context: number | FarmContext = 1,
): { state: MicroState; message: string } {
  const turn = typeof context === "number" ? context : context.turn;
  const policy = parseFarmPolicy(
    typeof context === "number" ? {} : (context.policy ?? {}),
  );
  if (!Number.isInteger(turn) || turn < 1 || turn > 160)
    throw new Error("Use turn 1–160.");
  const state = parseMicroState(current);
  let message: string;
  if (action.type === "plant" || action.type === "harvest") {
    if (
      !Number.isInteger(action.plot) ||
      action.plot < 0 ||
      action.plot >= state.plots.length
    )
      throw new Error("That plot is not available.");
    if (!cellAllowed(state.plotCells[action.plot], policy))
      throw new Error("This plot is outside the current land grant.");
    const plot = state.plots[action.plot];
    if (action.type === "plant") {
      if (!Object.hasOwn(crops, action.crop)) throw new Error("Unknown crop.");
      if (plot) throw new Error("This plot is already planted.");
      const crop = crops[action.crop];
      if (state.coins < policyCost(seedCost(state, action.crop), policy))
        throw new Error("Not enough coins for those seeds.");
      const price = policyCost(seedCost(state, action.crop), policy);
      state.coins -= price;
      state.plots[action.plot] = { crop: action.crop, growth: 0 };
      message = `${crop.name} planted. −${price} coins.`;
    } else {
      if (!plot || plot.growth < crops[plot.crop].steps)
        throw new Error("This crop is not ready yet.");
      const value = policyProduction(harvestValue(state, plot.crop), policy);
      state.coins += value;
      state.plots[action.plot] = null;
      message = `${crops[plot.crop].name} harvested! +${value} coins.`;
    }
  } else if (action.type === "work") {
    if (
      policy.allowWork === false ||
      state.coins >=
        (state.plots.length
          ? Math.max(1, policyCost(seedCost(state, "turnip"), policy))
          : policyCost(expansionCost(state), policy) +
            Math.max(1, policyCost(seedCost(state, "turnip"), policy))) ||
      state.plots.some(Boolean)
    )
      throw new Error("You already have seeds or crops to keep farming.");
    state.coins += crops.turnip.seed;
    message = "You helped with a delivery. +4 coins for fresh seeds.";
  } else if (action.type === "grow") {
    let count = 0;
    state.plots = state.plots.map((plot, index) => {
      if (!cellAllowed(state.plotCells[index], policy)) return plot;
      if (!plot || plot.growth === crops[plot.crop].steps) return plot;
      count++;
      return {
        ...plot,
        growth: Math.min(
          crops[plot.crop].steps,
          plot.growth + 1 + buildingLevel(state, "well"),
        ),
      };
    });
    if (!count) throw new Error("Plant a crop before advancing growth.");
    message = `${count} crop${count === 1 ? "" : "s"} grew. Ready crops keep until you harvest.`;
  } else if (action.type === "expand") {
    if (state.plots.length >= (policy.maxPlots ?? WORLD_CELLS))
      throw new Error("All 16384 plots are open.");
    const cost = policyCost(expansionCost(state), policy);
    if (state.coins < cost) throw new Error("Not enough coins to open a plot.");
    const occupied = occupiedCells(state);
    const cell =
      action.cell ??
      Array.from({ length: WORLD_SIZE * WORLD_SIZE }, (_, i) => ({
        row: Math.floor(i / WORLD_SIZE),
        col: i % WORLD_SIZE,
      }))
        .sort(
          (a, b) =>
            Math.abs(a.row - 16) +
            Math.abs(a.col - 16) -
            Math.abs(b.row - 16) -
            Math.abs(b.col - 16),
        )
        .find((c) => cellAllowed(c, policy) && !occupied.has(cellKey(c)));
    if (!cell || !canPlace(state, cell, 1, 1, policy))
      throw new Error("Choose unoccupied land inside the farm.");
    state.coins -= cost;
    state.plots.push(null);
    state.plotCells.push(cell);
    state.plotIds.push(state.nextPlotId++);
    message = `A new plot is ready! −${cost} coins.`;
  } else if (action.type === "build") {
    if (!Object.hasOwn(buildings, action.kind))
      throw new Error("Unknown building.");
    const item = buildings[action.kind];
    if (policy.blockedBuildings?.includes(action.kind))
      throw new Error("This building is restricted by the current policy.");
    const unlock = buildUnlock(action.kind, policy);
    if (turn < unlock) throw new Error(`Unlocks on turn ${unlock}.`);
    const limit = policy.buildingLimits?.[action.kind];
    if (
      limit !== undefined &&
      state.structures.filter((s) => s.kind === action.kind).length >= limit
    )
      throw new Error("The current policy limits this building.");
    if (!canPlace(state, action.cell, item.width, item.height, policy))
      throw new Error("That footprint is occupied or outside the farm.");
    if (state.coins < policyCost(item.cost, policy))
      throw new Error("Not enough coins to build this.");
    state.coins -= policyCost(item.cost, policy);
    const id = state.nextStructureId++;
    state.structures.push({ ...action.cell, id, kind: action.kind, level: 1 });
    message = `${item.name} built! −${policyCost(item.cost, policy)} coins.`;
  } else if (action.type === "movePlot") {
    const index = state.plotIds.indexOf(action.id);
    if (index < 0) throw new Error("Choose an existing plot.");
    if (
      !canPlace(
        { ...state, plotCells: state.plotCells.filter((_, i) => i !== index) },
        action.cell,
        1,
        1,
        policy,
      )
    )
      throw new Error("Choose unoccupied, permitted land.");
    state.plotCells[index] = { ...action.cell };
    message = "Plot moved with its crop intact. No coins spent.";
  } else if (action.type === "upgrade" || action.type === "move") {
    const building = state.structures.find((s) => s.id === action.id);
    if (!building) throw new Error("Choose an existing building.");
    const item = buildings[building.kind];
    if (action.type === "move") {
      if (
        !canPlace(
          {
            ...state,
            structures: state.structures.filter((s) => s.id !== building.id),
          },
          action.cell,
          item.width,
          item.height,
          policy,
        )
      )
        throw new Error("That footprint is occupied or outside the farm.");
      Object.assign(building, action.cell);
      message = `${item.name} moved. No coins spent.`;
    } else {
      if (building.level === item.levels)
        throw new Error("This building is fully upgraded.");
      if (policy.blockedBuildings?.includes(building.kind))
        throw new Error("Upgrades are restricted by the current policy.");
      const unlock = upgradeTurn(building.kind, building.level, policy);
      if (turn < unlock)
        throw new Error(`Next upgrade unlocks on turn ${unlock}.`);
      const cost = policyCost(upgradeCost(building), policy);
      if (state.coins < cost)
        throw new Error("Not enough coins to upgrade this.");
      state.coins -= cost;
      building.level++;
      message = `${item.name} is now level ${building.level}! −${cost} coins.`;
    }
  } else {
    if (state.soilLevel === 3) throw new Error("Soil is fully improved.");
    const unlock = [1, 33, 97][state.soilLevel];
    if (turn < unlock)
      throw new Error(`Next soil improvement unlocks on turn ${unlock}.`);
    const cost = policyCost(soilCost(state), policy);
    if (state.coins < cost)
      throw new Error("Not enough coins to improve soil.");
    state.coins -= cost;
    state.soilLevel++;
    message = `Soil improved! Every harvest earns 3 more coins. −${cost} coins.`;
  }
  return { state: parseMicroState(state), message };
}
