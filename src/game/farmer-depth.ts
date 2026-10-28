export type BuildingOccluder = {
  x: number;
  y: number;
  size: number;
  height?: number;
  front: { x: number; y: number };
};

/** Compare feet with the two front edges, rather than only the bottom corner. */
export function farmerDepth(
  feet: { x: number; y: number },
  buildings: readonly BuildingOccluder[],
) {
  let depth = feet.y;
  let behind = Infinity;
  for (const building of buildings) {
    if (
      feet.x + 18 < building.x ||
      feet.x - 18 > building.x + building.size ||
      feet.y < building.y ||
      feet.y - 60 > building.y + (building.height ?? building.size)
    )
      continue;
    const frontEdge =
      building.front.y - Math.abs(feet.x - building.front.x) / 2;
    if (feet.y >= frontEdge) depth = Math.max(depth, building.front.y + 0.5);
    else behind = Math.min(behind, building.front.y - 0.5);
  }
  return Math.min(depth, behind);
}
