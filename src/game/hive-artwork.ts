import type { Cell } from "../micro/world";

/** One placement shared by drawing, alpha hits, depth sorting, and action menus. */
export const hiveAnchor = (
  lot: Cell & { width: number; height: number },
): Cell => ({
  row: lot.row + (lot.height - 1) / 2,
  col: lot.col + (lot.width - 1) / 2,
});
export function hiveBounds(point: { x: number; y: number }, wild = false) {
  const width = wild ? 144 : 88;
  const height = wild ? 144 : 104;
  const bottom = point.y + (wild ? 16 : 24);
  return { x: point.x - width / 2, y: bottom - height, width, height, bottom };
}
export const wildHiveTexture = (season: string) => `wild-beehive-${season}`;
export const woodenHiveTexture = (season: string) =>
  season === "winter" ? "beehive-winter" : "beehive";
