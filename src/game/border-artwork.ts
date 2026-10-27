import type { MacroState } from "../macro/state";

export const seasonFrame = (season: MacroState["season"]) =>
  ({ spring: 0, summer: 1, fall: 2, winter: 3 })[season];

// The source has wider rock clusters and uneven gutters. Preserve whole sprites.
export function borderDetailRect(frame: number, width: number, height: number) {
  const columns = [0, 316, 636, 1002, 1254];
  const rows = [0, 323, 637, 946, 1254];
  const col = frame % 4,
    row = Math.floor(frame / 4);
  const x = Math.round((columns[col] * width) / 1254);
  const y = Math.round((rows[row] * height) / 1254);
  return {
    x,
    y,
    width: Math.round((columns[col + 1] * width) / 1254) - x,
    height: Math.round((rows[row + 1] * height) / 1254) - y,
  };
}
