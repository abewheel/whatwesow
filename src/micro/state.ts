/** Farming owns money, plots, crops, buildings, and farming rules. */
export type MicroState = { coins: number };
export const initialMicroState = (): MicroState => ({ coins: 100 });
export function parseMicroState(value: unknown): MicroState {
  const s = value as Partial<MicroState> | null;
  if (!s || !Number.isSafeInteger(s.coins) || Number(s.coins) < 0)
    throw new Error("Use a nonnegative whole coin balance.");
  return { coins: s.coins! };
}
