import { parseFarmPolicy, type FarmPolicy } from "../contracts/farm-policy";
import { WORLD_CELLS, WORLD_SIZE } from "../contracts/world";
/** Lifetime progression owns the clock, narrative, and community. */
export const seasons = ["spring", "summer", "fall", "winter"] as const;
/** One council crisis: when it fired, the player's answer, and what was fixed when it passed. */
export type CrisisRecord = {
  /** Crisis id; integration checks it follows the run order. */
  id: string;
  /** Turn it fired, strictly increasing across records. */
  turn: number;
  /** Card id, optionally with ":accept" or ":decline". */
  pick?: string;
  /** Target crop chosen at fire time. */
  crop?: string;
  /** Sale values frozen when a fixed-price policy passed. */
  prices?: Record<string, number>;
  /** Plot cells taken or sold. */
  cells?: { row: number; col: number }[];
  /** Building counts frozen when a building cap passed. */
  limits?: Record<string, number>;
  loan?: number;
};
/** The crisis layer's run order has eight crises. */
export const maxCrises = 8;
export type MacroState = {
  year: number;
  farmPolicy?: FarmPolicy;
  season: (typeof seasons)[number];
  crises?: CrisisRecord[];
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
    ...(s.crises === undefined ? {} : { crises: parseCrises(s.crises) }),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isName = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 40;
const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
function parseCounts(value: unknown): Record<string, number> {
  if (
    !isRecord(value) ||
    Object.entries(value).some(([key, n]) => !isName(key) || !isCount(n))
  )
    throw new Error("Crisis prices and limits must be whole numbers.");
  return { ...value } as Record<string, number>;
}
/** Shapes and bounds only; integration checks ids and picks against the crisis layer. */
function parseCrises(value: unknown): CrisisRecord[] {
  if (!Array.isArray(value) || value.length > maxCrises)
    throw new Error(`Keep at most ${maxCrises} crisis records.`);
  return value.map((item: unknown, i): CrisisRecord => {
    if (!isRecord(item)) throw new Error("Invalid crisis record.");
    const r = item;
    const previous = i ? (value[i - 1] as { turn?: unknown }).turn : 0;
    if (
      !isName(r.id) ||
      !Number.isInteger(r.turn) ||
      Number(r.turn) < 1 ||
      Number(r.turn) > 160 ||
      !(Number(r.turn) > Number(previous))
    )
      throw new Error("Crisis records need an id and increasing turns 1–160.");
    for (const key of ["pick", "crop"] as const)
      if (r[key] !== undefined && !isName(r[key]))
        throw new Error("Crisis picks and crops are short names.");
    if (r.loan !== undefined && !isCount(r.loan))
      throw new Error("A crisis loan is a whole number of coins.");
    if (
      r.cells !== undefined &&
      (!Array.isArray(r.cells) ||
        r.cells.length > WORLD_CELLS ||
        r.cells.some(
          (c) =>
            !isRecord(c) ||
            !Number.isInteger(c.row) ||
            !Number.isInteger(c.col) ||
            Number(c.row) < 0 ||
            Number(c.col) < 0 ||
            Number(c.row) >= WORLD_SIZE ||
            Number(c.col) >= WORLD_SIZE,
        ))
    )
      throw new Error("Crisis cells must be inside the 64 × 64 farm.");
    return {
      id: r.id,
      turn: r.turn as number,
      ...(r.pick === undefined ? {} : { pick: r.pick as string }),
      ...(r.crop === undefined ? {} : { crop: r.crop as string }),
      ...(r.prices === undefined ? {} : { prices: parseCounts(r.prices) }),
      ...(r.cells === undefined
        ? {}
        : {
            cells: (r.cells as { row: number; col: number }[]).map(
              ({ row, col }) => ({ row, col }),
            ),
          }),
      ...(r.limits === undefined ? {} : { limits: parseCounts(r.limits) }),
      ...(r.loan === undefined ? {} : { loan: r.loan as number }),
    };
  });
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
