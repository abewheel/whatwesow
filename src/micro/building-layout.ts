import type { MicroState } from "./state";
import {
  buildings,
  debrisCells,
  cellKey,
  footprint,
  inBounds,
  isTree,
  structureSize,
  cellAllowed,
  WORLD_SIZE,
} from "./world";
import type { FarmPolicy } from "../contracts/farm-policy";

/** Enlarge old farms once, preserving crops, stable IDs, paid work and production. */
export function enlargeBuildingLots(farm: MicroState, policy: FarmPolicy = {}) {
  const structures = farm.structures.map((s) => ({ ...s }));
  const used = new Set(
    [
      ...debrisCells(farm.debris),
      ...farm.plotCells,
      ...structures.flatMap((s) =>
        footprint(s, structureSize(s).width, structureSize(s).height),
      ),
    ].map(cellKey),
  );
  for (const s of [...structures].sort((a, b) => a.id - b.id)) {
    if (isTree(s.kind)) continue;
    const old = structureSize(s),
      next = buildings[s.kind];
    for (const c of footprint(s, old.width, old.height))
      used.delete(cellKey(c));
    const fits = (row: number, col: number) =>
      footprint({ row, col }, next.width, next.height).every(
        (c) => inBounds(c) && cellAllowed(c, policy) && !used.has(cellKey(c)),
      );
    let chosen = fits(s.row, s.col) ? { row: s.row, col: s.col } : undefined;
    for (let distance = 1; !chosen && distance < WORLD_SIZE * 2; distance++) {
      for (let dr = -distance; dr <= distance && !chosen; dr++) {
        const dc = distance - Math.abs(dr);
        for (const sign of dc === 0 ? [1] : [-1, 1]) {
          const row = s.row + dr,
            col = s.col + dc * sign;
          if (fits(row, col)) {
            chosen = { row, col };
            break;
          }
        }
      }
    }
    if (chosen)
      Object.assign(s, chosen, {
        footprint: { width: next.width, height: next.height },
      });
    // Completely packed historical farms keep their compact lot until moved into enough room.
    for (const c of footprint(
      s,
      structureSize(s).width,
      structureSize(s).height,
    ))
      used.add(cellKey(c));
  }
  return { ...farm, structures };
}
