import { initialState as newFarmState } from "../game/state";
import { canBuild } from "../micro/progression";
import { parseState } from "../game/state";
import { type BuildingKind } from "../micro/world";
import {
  homesteadState as initialState,
  applyMacroChange,
  type GameState,
} from "../game/state";
import { crops, type CropId, type Plot } from "../micro/state";
import { seasons, type CrisisRecord } from "../macro/state";
import { content } from "../crisis/engine";
export const farmPresets = [
  "planting",
  "growing",
  "harvesting",
  "reinvesting",
] as const;

// One End turn before each crisis of the run order fires. In the first family, earlier
// crises were answered with Ada Kessler's "your rights" argument, which passes each
// crisis's freest policy. In the second, with Nora Delgado's card: picked every time, it
// passes 0 at crises 2–5 and −40 at crises 6–8, so the council's harsher rules show.
const runOrder = content.params.runOrder;
export const crisisTurns = [6, 22, 37, 55, 70, 86, 101, 119];
/** Nora Delgado's first answer drains the valley's water, so the second drought comes in spring. */
export const controlTurns = [6, 22, 37, 55, 69, 86, 101, 119];
const crisisName = (n: number) =>
  `${runOrder.indexOf(runOrder[n]) < n ? "second " : ""}${runOrder[n].toLowerCase()}`;
type CrisisPreset = { id: string; label: string; n: number; key: string };
export const crisisPresets: CrisisPreset[] = [
  ...runOrder.map((_, n) => ({
    id: `crisis-${n + 1}`,
    label: `Crisis · ${crisisName(n)} next turn`,
    n,
    key: "OBJ",
  })),
  // Blight 0, Drought 0, Eminent domain −40 and Overproduction −40 when answered with her card.
  ...[1, 4, 6, 7].map((n) => ({
    id: `crisis-${n + 1}-control`,
    label: `Crisis · ${crisisName(n)}, toward control`,
    n,
    key: "PRO-M",
  })),
];
const crisisCrops: Record<string, CropId> = {
  Blight: "turnip",
  Overproduction: "pumpkin",
};
function crisisPreset({ n, key }: CrisisPreset): GameState {
  const state = initialState();
  const turns = key === "OBJ" ? crisisTurns : controlTurns;
  const turn = turns[n] - 1;
  state.year = Math.ceil(turn / 4);
  state.season = seasons[(turn - 1) % 4];
  state.coins = 300 + 200 * n;
  state.harvests = {
    turnip: 12 + 6 * n,
    carrot: 6 + 2 * n,
    corn: 4 + 3 * n,
    radish: 0,
    tomato: 2 + n,
    pumpkin: 2 + n,
  };
  // A shed but no well: a well would ripen corn before a drought could touch it. Before the
  // second drought leaning to control, a well built since the first, for the council to seal.
  state.structures.push({ id: 2, kind: "shed", row: 14, col: 10, level: 1 });
  if (key !== "OBJ" && n === 4)
    state.structures.push({ id: 3, kind: "well", row: 20, col: 20, level: 1 });
  state.nextStructureId = state.structures.length + 1;
  // Spring corn and carrots growing into a summer drought, blight or price crash; summer
  // pumpkins and tomatoes ripening into a fall glut.
  const sown: Record<string, CropId[]> = {
    spring: ["corn", "corn", "corn", "corn", "corn", "carrot", "carrot"],
    summer: ["pumpkin", "pumpkin", "pumpkin", "pumpkin", "tomato", "tomato"],
  };
  state.plots = state.plots.map((_, i): Plot =>
    sown[state.season]?.[i] ? { crop: sown[state.season][i], growth: 0 } : null,
  );
  state.crises = runOrder.slice(0, n).map((id, k): CrisisRecord => ({
    id,
    turn: turns[k],
    pick: content.cards.find((c) => c.crisis === id && c.key === key)!.id,
    ...(crisisCrops[id] ? { crop: crisisCrops[id] } : {}),
  }));
  state.opportunities = parseState(state).opportunities;
  return parseState(state);
}

export function presetState(id: string): GameState {
  if (id === "new") return newFarmState();
  const crisis = crisisPresets.find((p) => p.id === id);
  if (crisis) return crisisPreset(crisis);
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
    state.plots.push({ crop: "corn", growth: 2 });
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
      radish: 0,
      tomato: 0,
      pumpkin: 0,
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
    state.harvests = {
      radish: 0,
      tomato: 0,
      pumpkin: 0,
      turnip: 2,
      carrot: 1,
      corn: 0,
    };
  }
  return parseState(state);
}
