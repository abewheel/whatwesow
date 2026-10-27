export const seasons = ["spring", "summer", "fall", "winter"] as const;
export type GameState = {
  version: 1;
  year: number;
  season: (typeof seasons)[number];
  coins: number;
};
export const initialState = (): GameState => ({
  version: 1,
  year: 1,
  season: "spring",
  coins: 100,
});
export function parseState(value: unknown): GameState {
  if (!value || typeof value !== "object")
    throw new Error("State must be an object.");
  const s = value as Record<string, unknown>;
  if (
    s.version !== 1 ||
    !Number.isInteger(s.year) ||
    Number(s.year) < 1 ||
    Number(s.year) > 40 ||
    !seasons.includes(s.season as GameState["season"]) ||
    !Number.isSafeInteger(s.coins) ||
    Number(s.coins) < 0
  ) {
    throw new Error(
      "Use version 1, year 1–40, a valid season, and a nonnegative whole coin balance.",
    );
  }
  return {
    version: 1,
    year: s.year as number,
    season: s.season as GameState["season"],
    coins: s.coins as number,
  };
}
