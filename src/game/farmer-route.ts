import {
  debrisCells,
  structureSize,
  cellAllowed,
  cellKey,
  footprint,
  serviceLocations,
  serviceOptions,
  WORLD_SIZE,
  inBounds,
  type Cell,
  type Layout,
} from "../micro/world";
import type { FarmPolicy } from "../contracts/farm-policy";
export type FarmerWorld = { layout: Layout; policy?: FarmPolicy };
// Build obstacles once per search rather than once per visited tile.
// The council office stands, and blocks the way, only while permits are required.
const blocker = (world: FarmerWorld) => {
  const occupied = new Set(
    [
      ...debrisCells(world.layout.debris),
      ...world.layout.structures.flatMap((s) =>
        footprint(s, structureSize(s).width, structureSize(s).height),
      ),
      ...serviceLocations(world.layout, serviceOptions(world.policy)).flatMap(
        (s) => footprint(s, s.width, s.height),
      ),
      // Land the county took lies under the reservoir.
      ...(world.policy?.takenCells ?? []),
    ].map(cellKey),
  );
  return (cell: Cell) => !inBounds(cell) || occupied.has(cellKey(cell));
};
export const farmerBlocked = (cell: Cell, world: FarmerWorld) =>
  blocker(world)(cell);
export function farmerSpawn(world: FarmerWorld): Cell | undefined {
  const blocked = blocker(world);
  for (const plot of world.layout.plotCells) {
    if (!cellAllowed(plot, world.policy)) continue;
    for (const cell of neighbors(plot)) if (!blocked(cell)) return cell;
    if (!blocked(plot)) return plot;
  }
  for (let row = 0; row < WORLD_SIZE; row++)
    for (let col = 0; col < WORLD_SIZE; col++) {
      const cell = { row, col };
      if (cellAllowed(cell, world.policy) && !blocked(cell)) return cell;
    }
  return undefined;
}
const neighbors = (cell: Cell) => [
  { row: cell.row, col: cell.col - 1 },
  { row: cell.row - 1, col: cell.col },
  { row: cell.row, col: cell.col + 1 },
  { row: cell.row + 1, col: cell.col },
];
type Candidate = { stance: Cell; target: Cell; preferred: boolean };
type Route = { stance: Cell; target: Cell; route: Cell[] };
function routeTo(
  start: Cell,
  candidates: Map<string, Candidate>,
  blocked: (cell: Cell) => boolean,
  excluded = new Set<string>(),
): Route | undefined {
  if (!candidates.size || blocked(start)) return undefined;
  const hasPreferred = [...candidates.values()].some((c) => c.preferred);
  let fallback: Cell | undefined;
  const frontier = [start];
  const previous = new Map<string, Cell | null>([[cellKey(start), null]]);
  const result = (cell: Cell): Route => {
    const route: Cell[] = [];
    let step: Cell | null = cell;
    while (step && cellKey(step) !== cellKey(start)) {
      route.unshift(step);
      step = previous.get(cellKey(step)) ?? null;
    }
    return {
      stance: cell,
      target: candidates.get(cellKey(cell))!.target,
      route,
    };
  };
  for (let i = 0; i < frontier.length; i++) {
    const cell = frontier[i],
      candidate = candidates.get(cellKey(cell));
    if (candidate && (!hasPreferred || candidate.preferred))
      return result(cell);
    if (candidate && !fallback) fallback = cell;
    for (const next of neighbors(cell)) {
      if (
        !excluded.has(cellKey(next)) &&
        !blocked(next) &&
        !previous.has(cellKey(next))
      ) {
        previous.set(cellKey(next), cell);
        frontier.push(next);
      }
    }
  }
  return fallback ? result(fallback) : undefined;
}
/** Navigation reaches the clicked ground tile, including an empty crop plot. */
export function farmerWalkRoute(
  start: Cell,
  target: Cell,
  world: FarmerWorld,
): Route | undefined {
  const blocked = blocker(world);
  if (blocked(target)) return undefined;
  return routeTo(
    start,
    new Map([[cellKey(target), { stance: target, target, preferred: true }]]),
    blocked,
  );
}
/** Work stays beside crops. Visits prefer the front perimeter of a building. */
export function farmerWorkRoute(
  start: Cell,
  target: Cell,
  world: FarmerWorld,
  width = 1,
  height = 1,
  preference: "rear" | "front" = "rear",
): Route | undefined {
  const work = footprint(target, width, height),
    workKeys = new Set(work.map(cellKey));
  const blocked = blocker(world);
  const candidates = new Map<string, Candidate>();
  for (const tile of work)
    for (const stance of neighbors(tile)) {
      if (workKeys.has(cellKey(stance)) || blocked(stance)) continue;
      const rear = stance.row < tile.row || stance.col < tile.col;
      candidates.set(cellKey(stance), {
        stance,
        target: tile,
        preferred: preference === "rear" ? rear : !rear,
      });
    }
  return routeTo(start, candidates, blocked, workKeys);
}
