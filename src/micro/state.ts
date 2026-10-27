export const crops = {
  turnip: { name: "Turnip", seed: 4, sale: 9, steps: 1, color: 0xf4d5b6 },
  carrot: { name: "Carrot", seed: 7, sale: 18, steps: 2, color: 0xec8c39 },
  corn: { name: "Corn", seed: 12, sale: 34, steps: 3, color: 0xf1ce55 },
} as const;
export type CropId = keyof typeof crops;
export type Plot = { crop: CropId; growth: number } | null;
export type MicroState = { coins: number; plots: Plot[]; soilLevel: number };
export const initialMicroState = (): MicroState => ({
  coins: 100,
  plots: Array.from({ length: 9 }, () => null),
  soilLevel: 0,
});
export function parseMicroState(value: unknown): MicroState {
  if (!value || typeof value !== "object")
    throw new Error("Farm state must be an object.");
  const s = value as Record<string, unknown>;
  if (!Number.isSafeInteger(s.coins) || Number(s.coins) < 0)
    throw new Error("Use a nonnegative whole coin balance.");
  if (!Array.isArray(s.plots) || s.plots.length < 9 || s.plots.length > 49)
    throw new Error("Use 9–49 plots.");
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
  return { coins: s.coins as number, plots, soilLevel: s.soilLevel as number };
}
export const expansionCost = (state: MicroState) =>
  30 + (state.plots.length - 9) * 5;
export const soilCost = (state: MicroState) => 80 * (state.soilLevel + 1);
export const harvestValue = (state: MicroState, crop: CropId) =>
  crops[crop].sale + state.soilLevel * 3;
