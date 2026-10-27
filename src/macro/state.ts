/** Lifetime progression owns the clock, narrative, and community. */
export const seasons = ["spring", "summer", "fall", "winter"] as const;
export type MacroState = { year: number; season: (typeof seasons)[number] };
export const initialMacroState = (): MacroState => ({
  year: 1,
  season: "spring",
});
export function parseMacroState(value: unknown): MacroState {
  const s = value as Partial<MacroState> | null;
  if (
    !s ||
    !Number.isInteger(s.year) ||
    Number(s.year) < 1 ||
    Number(s.year) > 40 ||
    !seasons.includes(s.season as MacroState["season"])
  )
    throw new Error("Use year 1–40 and a valid season.");
  return { year: s.year!, season: s.season! };
}
