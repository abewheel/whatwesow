import Phaser from "phaser";
import type { MacroState } from "../macro/state";
import { seasonFrame } from "./border-artwork";

// Measured gutters preserve the complete seasonal objects. Shearing the fence
// and entrance aligns their ground contacts to the estate's 2:1 grid while
// keeping posts vertical. The source remains untouched.
const columns = [
  { x: 20, width: 410, shear: -0.24, footX: 317, footY: 215 },
  { x: 438, width: 545, shear: -0.3, footX: 272, footY: 260 },
  { x: 1010, width: 190, shear: 0, footX: 95, footY: 300 },
];
const rows = [0, 315, 635, 950, 1254];
export type LaneKind = "fence" | "entrance" | "lamp";
const kinds: LaneKind[] = ["fence", "entrance", "lamp"];
export function laneArtwork(kind: LaneKind, season: MacroState["season"]) {
  const column = columns[kinds.indexOf(kind)];
  const frame = seasonFrame(season);
  const height = rows[frame + 1] - rows[frame];
  const extra = Math.ceil(-column.shear * column.width);
  return {
    key: `lane-${kind}-${season}`,
    originX: column.footX / column.width,
    originY:
      (column.footY + column.shear * column.footX + extra) / (height + extra),
  };
}
export function prepareLaneArtwork(scene: Phaser.Scene) {
  const source = scene.textures
    .get("lane-source")
    .getSourceImage() as HTMLImageElement;
  for (const season of ["spring", "summer", "fall", "winter"] as const)
    for (const [i, kind] of kinds.entries()) {
      const { key } = laneArtwork(kind, season);
      if (scene.textures.exists(key)) continue;
      const { x, width, shear } = columns[i];
      const frame = seasonFrame(season),
        height = rows[frame + 1] - rows[frame];
      const extra = Math.ceil(-shear * width);
      const texture = scene.textures.createCanvas(key, width, height + extra)!;
      const context = texture.context;
      context.setTransform(1, shear, 0, 1, 0, extra);
      context.drawImage(
        source,
        (x * source.width) / 1254,
        (rows[frame] * source.height) / 1254,
        (width * source.width) / 1254,
        (height * source.height) / 1254,
        0,
        0,
        width,
        height,
      );
      texture.refresh();
    }
}
