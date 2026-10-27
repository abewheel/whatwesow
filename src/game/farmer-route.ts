import {
  buildings,
  cellAllowed,
  cellKey,
  footprint,
  WORLD_SIZE,
  type Cell,
  type Layout,
} from "../micro/world";
import type { FarmPolicy } from "../contracts/farm-policy";
export type FarmerWorld = { layout: Layout; policy?: FarmPolicy };
export function farmerBlocked(cell: Cell, world: FarmerWorld): boolean {
  return (
    !cellAllowed(cell, world.policy) ||
    world.layout.structures.some((s) =>
      footprint(s, buildings[s.kind].width, buildings[s.kind].height).some(
        (p) => cellKey(p) === cellKey(cell),
      ),
    )
  );
}
export function farmerSpawn(world: FarmerWorld): Cell | undefined {
  for (const plot of world.layout.plotCells) {
    if (!cellAllowed(plot, world.policy)) continue;
    for (const cell of neighbors(plot))
      if (!farmerBlocked(cell, world)) return cell;
    if (!farmerBlocked(plot, world)) return plot;
  }
  for (let row = 0; row < WORLD_SIZE; row++)
    for (let col = 0; col < WORLD_SIZE; col++) {
      const cell = { row, col };
      if (!farmerBlocked(cell, world)) return cell;
    }
  return undefined;
}
const neighbors = (cell: Cell) => [
  { row: cell.row, col: cell.col - 1 },
  { row: cell.row - 1, col: cell.col },
  { row: cell.row, col: cell.col + 1 },
  { row: cell.row + 1, col: cell.col },
];
/** Routes to a reachable perimeter square and returns the neighboring work square. */
export function farmerWorkRoute(
  start: Cell,
  target: Cell,
  world: FarmerWorld,
  width = 1,
  height = 1,
): { stance: Cell; target: Cell; route: Cell[] } | undefined {
  const work = footprint(target, width, height);
  const workKeys = new Set(work.map(cellKey));
  const candidates = new Map<
    string,
    { stance: Cell; target: Cell; rear: boolean }
  >();
  for (const tile of work)
    for (const stance of neighbors(tile)) {
      if (workKeys.has(cellKey(stance)) || farmerBlocked(stance, world))
        continue;
      candidates.set(cellKey(stance), {
        stance,
        target: tile,
        rear: stance.row < tile.row || stance.col < tile.col,
      });
    }
  if (!candidates.size || farmerBlocked(start, world)) return undefined;
  const hasRear = [...candidates.values()].some((c) => c.rear);
  let fallback: Cell | undefined;
  const frontier = [start];
  const previous = new Map<string, Cell | null>([[cellKey(start), null]]);
  const result = (cell: Cell) => {
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
    if (candidate && (!hasRear || candidate.rear)) return result(cell);
    if (candidate && !fallback) fallback = cell;
    for (const next of neighbors(cell)) {
      if (
        !workKeys.has(cellKey(next)) &&
        !farmerBlocked(next, world) &&
        !previous.has(cellKey(next))
      ) {
        previous.set(cellKey(next), cell);
        frontier.push(next);
      }
    }
  }
  return fallback ? result(fallback) : undefined;
}
