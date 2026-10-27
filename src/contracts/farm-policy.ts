import { WORLD_SIZE, WORLD_CELLS } from "./world";
/** Macro-owned restrictions passed into pure farming rules. Missing fields mean no restriction. */
export type FarmPolicy = {
  land?: { row: number; col: number; width: number; height: number }[];
  blockedBuildings?: string[];
  buildingLimits?: Record<string, number>;
  maxPlots?: number;
  costMultiplier?: number;
  productionMultiplier?: number;
  allowWork?: boolean;
};
export function parseFarmPolicy(value: unknown): FarmPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Farm policy must be an object.");
  const s = value as Record<string, unknown>,
    p: FarmPolicy = {};
  if (s.land !== undefined) {
    if (!Array.isArray(s.land) || s.land.length > WORLD_CELLS)
      throw new Error("Invalid land grants.");
    p.land = s.land.map((value: unknown) => {
      if (!value || typeof value !== "object")
        throw new Error("Invalid land grant.");
      const r = value as Record<string, unknown>;
      if (
        !["row", "col", "width", "height"].every((k) =>
          Number.isInteger(r[k]),
        ) ||
        Number(r.row) < 0 ||
        Number(r.col) < 0 ||
        Number(r.width) < 1 ||
        Number(r.height) < 1 ||
        Number(r.row) + Number(r.height) > WORLD_SIZE ||
        Number(r.col) + Number(r.width) > WORLD_SIZE
      )
        throw new Error("Land grants must fit the farm.");
      return {
        row: r.row as number,
        col: r.col as number,
        width: r.width as number,
        height: r.height as number,
      };
    });
  }
  if (s.blockedBuildings !== undefined) {
    if (
      !Array.isArray(s.blockedBuildings) ||
      s.blockedBuildings.some((k) => typeof k !== "string")
    )
      throw new Error("Invalid blocked building list.");
    p.blockedBuildings = [...s.blockedBuildings] as string[];
  }
  for (const key of ["buildingLimits"] as const)
    if (s[key] !== undefined) {
      const record = s[key];
      if (!record || typeof record !== "object" || Array.isArray(record))
        throw new Error("Invalid policy limits.");
      const entries = Object.entries(record);
      if (entries.some(([, v]) => !Number.isSafeInteger(v) || v < 0))
        throw new Error("Invalid policy limit value.");
      p[key] = Object.fromEntries(entries);
    }
  if (s.maxPlots !== undefined) {
    if (
      !Number.isInteger(s.maxPlots) ||
      Number(s.maxPlots) < 0 ||
      Number(s.maxPlots) > WORLD_CELLS
    )
      throw new Error("Invalid plot limit.");
    p.maxPlots = s.maxPlots as number;
  }
  for (const key of ["costMultiplier", "productionMultiplier"] as const)
    if (s[key] !== undefined) {
      if (
        typeof s[key] !== "number" ||
        !Number.isFinite(s[key]) ||
        s[key] < 0 ||
        s[key] > 1000
      )
        throw new Error("Invalid policy multiplier.");
      p[key] = s[key];
    }
  if (s.allowWork !== undefined) {
    if (typeof s.allowWork !== "boolean")
      throw new Error("Invalid work permission.");
    p.allowWork = s.allowWork;
  }
  return p;
}
