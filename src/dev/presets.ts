import { initialState, type GameState } from "../game/state";
import { crops, type CropId } from "../micro/state";
export const farmPresets = [
  "planting",
  "growing",
  "harvesting",
  "reinvesting",
] as const;
export function presetState(id: string): GameState {
  const state = initialState();
  if (id === "mid" || id === "late")
    return {
      ...state,
      year: id === "mid" ? 20 : 40,
      season: id === "mid" ? "fall" : "winter",
      coins: id === "mid" ? 5000 : 12000,
    };
  if (id === "growing" || id === "harvesting") {
    state.plots = state.plots.map((_, i) => {
      const crop = (["turnip", "carrot", "corn"] as CropId[])[i % 3];
      return { crop, growth: id === "harvesting" ? crops[crop].steps : 0 };
    });
    state.coins = 31;
  }
  if (id === "reinvesting") state.coins = 250;
  return state;
}
