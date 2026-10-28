import type Phaser from "phaser";
import {
  cellKey,
  debrisTypes,
  debrisFootprint,
  cellAllowed,
  type Cell,
  type Debris,
} from "../micro/world";
import type { FarmPolicy } from "../contracts/farm-policy";
import type { MacroState } from "../macro/state";
import { seasonFrame } from "./border-artwork";

// Measured gutters preserve the whole generated sprites, including their moss and snow.
const logRects = [
  [0, 157, 314, 234],
  [0, 486, 314, 237],
  [0, 816, 314, 263],
  [0, 1143, 314, 276],
];
const rockRects = [
  [320, 103, 389, 326],
  [320, 437, 389, 322],
  [320, 770, 389, 327],
  [320, 1097, 389, 340],
];
export function prepareDebrisArtwork(scene: Phaser.Scene) {
  const texture = scene.textures.get("debris-seasons");
  for (const [kind, rects] of [
    ["log", logRects],
    ["rocks", rockRects],
  ] as const)
    for (const [i, [x, y, width, height]] of rects.entries())
      texture.add(`${kind}-${i}`, 0, x, y, width, height);
}

type Project = (cell: Cell) => { x: number; y: number };
export function drawDebris(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  items: readonly Debris[],
  season: MacroState["season"],
  project: Project,
  policy?: FarmPolicy,
) {
  const frame = seasonFrame(season);
  let currentId = "";
  const sprite = (
    atlas: string,
    index: string | number,
    cell: Cell,
    width: number,
    flip = false,
  ) => {
    const point = project(cell);
    const image = scene.add
      .image(point.x, point.y + 15, atlas, index)
      .setOrigin(0.5, 1)
      .setFlipX(flip)
      .setName(`debris:${currentId}`);
    image.setScale(width / image.width).setDepth(point.y + 14);
    layer.add(image);
  };
  for (const d of items) {
    currentId = cellKey(d);
    if (!debrisFootprint(d).some((c) => cellAllowed(c, policy))) continue;
    const spec = debrisTypes[d.kind];
    if (d.kind === "fallenTree") {
      // Two connected arms follow the two grid axes. Their shared back corner
      // leaves the inner four tiles clear, matching debrisFootprint exactly.
      sprite(
        "debris-seasons",
        `log-${frame}`,
        { row: d.row + 1, col: d.col },
        114,
        true,
      );
      sprite(
        "debris-seasons",
        `log-${frame}`,
        { row: d.row, col: d.col + 1 },
        114,
      );
    } else if (d.kind === "log") {
      sprite(
        "debris-seasons",
        `log-${frame}`,
        { row: d.row, col: d.col + 0.5 },
        88,
      );
    } else {
      const center = {
        row: d.row + (spec.height - 1) / 2,
        col: d.col + (spec.width - 1) / 2,
      };
      if (d.kind === "boulder" || d.kind === "rockpile")
        sprite(
          "debris-seasons",
          `rocks-${frame}`,
          center,
          d.kind === "rockpile" ? 174 : 112,
        );
      else
        sprite(
          "border-details",
          frame * 4 + (d.kind === "berries" ? 1 : d.kind === "weeds" ? 0 : 2),
          center,
          d.kind === "stones" ? 49 : 57,
        );
    }
  }
}
