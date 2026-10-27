import { parseFarmPolicy, type FarmPolicy } from "../contracts/farm-policy";
/** Lifetime progression owns the clock, narrative, and community. */
export const seasons = ["spring", "summer", "fall", "winter"] as const;
export type MacroState = {
  year: number;
  farmPolicy?: FarmPolicy;
  season: (typeof seasons)[number];
};
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
  return {
    year: s.year!,
    season: s.season!,
    ...(s.farmPolicy === undefined
      ? {}
      : { farmPolicy: parseFarmPolicy(s.farmPolicy) }),
  };
}

export const turnNumber = (state: MacroState) =>
  (state.year - 1) * 4 + seasons.indexOf(state.season) + 1;
export function nextSeason(state: MacroState): MacroState {
  const current = parseMacroState(state);
  const turn = turnNumber(current);
  if (turn === 160) throw new Error("You are in the final season.");
  return {
    ...current,
    year: Math.floor(turn / 4) + 1,
    season: seasons[turn % 4],
  };
}
