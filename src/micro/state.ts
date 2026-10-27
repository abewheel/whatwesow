import {
  buildings,
  buildingLevel,
  cellKey,
  footprint,
  inBounds,
  initialPlotCells,
  type Cell,
  type Structure,
} from "./world";
export const crops = {
  turnip: { name: "Turnip", seed: 4, sale: 9, steps: 1, color: 0xf4d5b6 },
  carrot: { name: "Carrot", seed: 7, sale: 18, steps: 2, color: 0xec8c39 },
  corn: { name: "Corn", seed: 12, sale: 34, steps: 3, color: 0xf1ce55 },
} as const;
export type CropId = keyof typeof crops;
export type Plot = { crop: CropId; growth: number } | null;
export type MicroState = {
  coins: number;
  plots: Plot[];
  soilLevel: number;
  plotCells: Cell[];
  structures: Structure[];
  nextStructureId: number;
  plotIds: number[];
  nextPlotId: number;
};
export const initialMicroState = (): MicroState => ({
  coins: 100,
  plots: Array.from({ length: 9 }, () => null),
  soilLevel: 0,
  plotCells: initialPlotCells(),
  plotIds: Array.from({ length: 9 }, (_, i) => i + 1),
  nextPlotId: 10,
  nextStructureId: 2,
  structures: [{ id: 1, kind: "home", row: 11, col: 14, level: 1 }],
});
export function parseMicroState(value: unknown): MicroState {
  if (!value || typeof value !== "object")
    throw new Error("Farm state must be an object.");
  const s = value as Record<string, unknown>;
  if (!Number.isSafeInteger(s.coins) || Number(s.coins) < 0)
    throw new Error("Use a nonnegative whole coin balance.");
  if (!Array.isArray(s.plots) || s.plots.length < 0 || s.plots.length > 1024)
    throw new Error("Use 0–1024 plots.");
  if (
    !Number.isInteger(s.soilLevel) ||
    Number(s.soilLevel) < 0 ||
    Number(s.soilLevel) > 3
  )
    throw new Error("Use soilLevel 0–3.");
  const plots = s.plots.map((value: unknown): Plot => {
    if (value === null) return null;
    if (!value || typeof value !== "object") throw new Error("Invalid plot.");
    const p = value as Record<string, unknown>;
    if (typeof p.crop !== "string" || !Object.hasOwn(crops, p.crop))
      throw new Error("Unknown crop.");
    const crop = p.crop as CropId;
    if (
      !Number.isInteger(p.growth) ||
      Number(p.growth) < 0 ||
      Number(p.growth) > crops[crop].steps
    )
      throw new Error("Crop growth is outside its grow steps.");
    return { crop, growth: p.growth as number };
  });
  if (
    !Array.isArray(s.plotCells) ||
    s.plotCells.length !== plots.length ||
    !Array.isArray(s.structures) ||
    s.structures.length > 1024
  )
    throw new Error("Provide a cell per plot and at most 1,024 structures.");
  const parseCell = (value: unknown): Cell => {
    if (!value || typeof value !== "object" || !inBounds(value as Cell))
      throw new Error("Cells must be inside the 32 × 32 farm.");
    const { row, col } = value as Cell;
    return { row, col };
  };
  const plotCells = s.plotCells.map(parseCell);
  const structures = s.structures.map((value: unknown): Structure => {
    if (!value || typeof value !== "object")
      throw new Error("Invalid structure.");
    const b = value as Record<string, unknown>;
    if (typeof b.kind !== "string" || !Object.hasOwn(buildings, b.kind))
      throw new Error("Unknown building.");
    const kind = b.kind as Structure["kind"];
    if (
      !Number.isSafeInteger(b.id) ||
      Number(b.id) < 1 ||
      !Number.isInteger(b.level) ||
      Number(b.level) < 1 ||
      Number(b.level) > buildings[kind].levels
    )
      throw new Error("Invalid building ID or level.");
    return {
      ...parseCell(b),
      kind,
      id: b.id as number,
      level: b.level as number,
    };
  });
  if (new Set(structures.map((s) => s.id)).size !== structures.length)
    throw new Error("Building IDs must be unique.");
  const cells = [
    ...plotCells,
    ...structures.flatMap((b) =>
      footprint(b, buildings[b.kind].width, buildings[b.kind].height),
    ),
  ];
  if (
    cells.some((c) => !inBounds(c)) ||
    new Set(cells.map(cellKey)).size !== cells.length
  )
    throw new Error("Plots and buildings cannot overlap or leave the farm.");
  if (
    !Number.isSafeInteger(s.nextStructureId) ||
    Number(s.nextStructureId) < 1 ||
    structures.some((b) => b.id >= Number(s.nextStructureId))
  )
    throw new Error("nextStructureId must exceed all building IDs.");
  if (
    !Array.isArray(s.plotIds) ||
    s.plotIds.length !== plots.length ||
    s.plotIds.some((id) => !Number.isSafeInteger(id) || id < 1) ||
    new Set(s.plotIds).size !== plots.length ||
    !Number.isSafeInteger(s.nextPlotId) ||
    Number(s.nextPlotId) < 1 ||
    s.plotIds.some((id) => id >= Number(s.nextPlotId))
  )
    throw new Error("Plots need unique stable IDs below nextPlotId.");
  return {
    nextStructureId: s.nextStructureId as number,
    nextPlotId: s.nextPlotId as number,
    plotIds: [...s.plotIds] as number[],
    coins: s.coins as number,
    plots,
    soilLevel: s.soilLevel as number,
    plotCells,
    structures,
  };
}
export const expansionCost = (state: MicroState) =>
  30 + Math.max(0, state.plots.length - 9) * 5;
export const soilCost = (state: MicroState) => 80 * (state.soilLevel + 1);
export const harvestValue = (state: MicroState, crop: CropId) =>
  crops[crop].sale +
  state.soilLevel * 3 +
  state.structures.reduce(
    (sum, b) => sum + buildings[b.kind].bonus * b.level,
    0,
  ) +
  (crop === "corn" ? buildingLevel(state, "mill") * 15 : 0);
export const seedCost = (state: MicroState, crop: CropId) =>
  Math.max(1, crops[crop].seed - buildingLevel(state, "shed"));
