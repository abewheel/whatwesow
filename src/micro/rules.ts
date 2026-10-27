import {
  crops,
  expansionCost,
  harvestValue,
  parseMicroState,
  soilCost,
  type CropId,
  type MicroState,
} from "./state";
export type FarmAction =
  | { type: "plant"; plot: number; crop: CropId }
  | { type: "harvest"; plot: number }
  | { type: "grow" }
  | { type: "work" }
  | { type: "expand" }
  | { type: "improve" };
export function actOnFarm(
  current: MicroState,
  action: FarmAction,
): { state: MicroState; message: string } {
  const state = parseMicroState(current);
  let message: string;
  if (action.type === "plant" || action.type === "harvest") {
    if (
      !Number.isInteger(action.plot) ||
      action.plot < 0 ||
      action.plot >= state.plots.length
    )
      throw new Error("That plot is not available.");
    const plot = state.plots[action.plot];
    if (action.type === "plant") {
      if (!Object.hasOwn(crops, action.crop)) throw new Error("Unknown crop.");
      if (plot) throw new Error("This plot is already planted.");
      const crop = crops[action.crop];
      if (state.coins < crop.seed)
        throw new Error("Not enough coins for those seeds.");
      state.coins -= crop.seed;
      state.plots[action.plot] = { crop: action.crop, growth: 0 };
      message = `${crop.name} planted. −${crop.seed} coins.`;
    } else {
      if (!plot || plot.growth < crops[plot.crop].steps)
        throw new Error("This crop is not ready yet.");
      const value = harvestValue(state, plot.crop);
      state.coins += value;
      state.plots[action.plot] = null;
      message = `${crops[plot.crop].name} harvested! +${value} coins.`;
    }
  } else if (action.type === "work") {
    if (state.coins >= crops.turnip.seed || state.plots.some(Boolean))
      throw new Error("You already have seeds or crops to keep farming.");
    state.coins += crops.turnip.seed;
    message = "You helped with a delivery. +4 coins for fresh seeds.";
  } else if (action.type === "grow") {
    let count = 0;
    state.plots = state.plots.map((plot) => {
      if (!plot || plot.growth === crops[plot.crop].steps) return plot;
      count++;
      return { ...plot, growth: plot.growth + 1 };
    });
    if (!count) throw new Error("Plant a crop before advancing growth.");
    message = `${count} crop${count === 1 ? "" : "s"} grew. Ready crops keep until you harvest.`;
  } else if (action.type === "expand") {
    if (state.plots.length === 49) throw new Error("All 49 plots are open.");
    const cost = expansionCost(state);
    if (state.coins < cost) throw new Error("Not enough coins to open a plot.");
    state.coins -= cost;
    state.plots.push(null);
    message = `A new plot is ready! −${cost} coins.`;
  } else {
    if (state.soilLevel === 3) throw new Error("Soil is fully improved.");
    const cost = soilCost(state);
    if (state.coins < cost)
      throw new Error("Not enough coins to improve soil.");
    state.coins -= cost;
    state.soilLevel++;
    message = `Soil improved! Every harvest earns 3 more coins. −${cost} coins.`;
  }
  return { state: parseMicroState(state), message };
}
