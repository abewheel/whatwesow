import { initialState as newFarmState } from "../game/state";
import { canBuild } from "../micro/progression";
import { parseState } from "../game/state";
import { type BuildingKind } from "../micro/world";
import {
  homesteadState as initialState,
  applyMacroChange,
  type GameState,
} from "../game/state";
import { crops, type CropId } from "../micro/state";
export const farmPresets = [
  "planting",
  "growing",
  "harvesting",
  "reinvesting",
] as const;
export function presetState(id: string): GameState {
  if (id === "new") return newFarmState();
  if (id === "expanse") {
    const state = initialState();
    state.year = 40;
    state.coins = 100000;
    state.structures.push({
      id: state.nextStructureId++,
      kind: "barn",
      row: 60,
      col: 60,
      level: 1,
    });
    state.plots.push({ crop: "corn", growth: 3 });
    state.plotCells.push({ row: 63, col: 63 });
    state.plotIds.push(state.nextPlotId++);
    return parseState(state);
  }
  if (id === "restricted") {
    const base = presetState("community");
    return applyMacroChange(
      base,
      {
        year: base.year,
        season: base.season,
        farmPolicy: {
          land: [{ row: 14, col: 14, width: 6, height: 6 }],
          blockedBuildings: ["barn"],
          buildingLimits: { shed: 1 },
          maxPlots: 12,
          costMultiplier: 1.5,
          productionMultiplier: 0.75,
        },
      },
      { removeStructureIds: [2] },
    ).state;
  }
  const state = initialState();
  const turns: Record<string, number> = {
    homestead: 1,
    community: 25,
    industry: 81,
    legacy: 159,
  };
  if (Object.hasOwn(turns, id)) {
    const turn = turns[id];
    state.year = Math.floor((turn - 1) / 4) + 1;
    state.season = (["spring", "summer", "fall", "winter"] as const)[
      (turn - 1) % 4
    ];
    state.coins =
      id === "homestead"
        ? 500
        : id === "community"
          ? 3000
          : id === "industry"
            ? 15000
            : 150000;
    state.harvests = {
      turnip:
        id === "homestead"
          ? 3
          : id === "community"
            ? 24
            : id === "industry"
              ? 80
              : 300,
      carrot: 1,
      corn: id === "homestead" ? 0 : 12,
    };
    state.soilLevel = id === "industry" || id === "legacy" ? 1 : 0;
    // Presets describe farms with an established history, independent of their date.
    state.opportunities = parseState(state).opportunities;
    if (id === "legacy") state.opportunities.push("market", "hall");
    const kinds = (
      [
        "shed",
        "oak",
        "apple",
        "well",
        "barn",
        "mill",
        "greenhouse",
        "market",
        "hall",
      ] as BuildingKind[]
    ).filter((k) => canBuild(state, k));
    for (const [i, kind] of kinds.entries())
      state.structures.push({
        id: i + 2,
        kind,
        ...[
          { row: 11, col: 9 },
          { row: 14, col: 10 },
          { row: 13, col: 19 },
          { row: 18, col: 18 },
          { row: 8, col: 16 },
          { row: 18, col: 10 },
          { row: 20, col: 15 },
          { row: 13, col: 23 },
          { row: 23, col: 19 },
        ][i],
        level: 1,
      });
    state.nextStructureId = Math.max(...state.structures.map((s) => s.id)) + 1;
    return parseState(state);
  }
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
  if (id === "reinvesting") {
    state.coins = 250;
    state.harvests = { turnip: 2, carrot: 1, corn: 0 };
  }
  return parseState(state);
}
