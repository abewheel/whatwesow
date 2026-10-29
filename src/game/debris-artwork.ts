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

type Contacts = { row: number; col: number; width: number };
const contactCache = new WeakMap<
  Phaser.Textures.Texture,
  Map<string | number, Contacts>
>();

// Each frame has different transparent gutters. Align its two front ground
// edges to the occupied diamond instead of treating the image bottom as a pivot.
function groundContacts(
  scene: Phaser.Scene,
  atlas: string,
  frame: string | number,
) {
  const texture = scene.textures.get(atlas);
  let cache = contactCache.get(texture);
  if (!cache) {
    cache = new Map();
    contactCache.set(texture, cache);
  }
  const cached = cache.get(frame);
  if (cached) return cached;
  const source = texture.getSourceImage() as HTMLImageElement;
  const rect = texture.get(frame);
  const canvas = document.createElement("canvas");
  canvas.width = rect.cutWidth;
  canvas.height = rect.cutHeight;
  const context = canvas.getContext("2d")!;
  context.drawImage(
    source,
    rect.cutX,
    rect.cutY,
    rect.cutWidth,
    rect.cutHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let row = -Infinity,
    col = -Infinity;
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] < 32) continue;
      row = Math.max(row, y * 2 - x);
      col = Math.max(col, y * 2 + x);
    }
  const contact = { row, col, width: canvas.width };
  cache.set(frame, contact);
  return contact;
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
    lotWidth = 1,
    lotHeight = 1,
    flip = false,
  ) => {
    const point = project(cell);
    const contact = groundContacts(scene, atlas, index);
    const scale = width / contact.width;
    const frontRow = (lotHeight - 0.5 - 0.08) * 64;
    const frontCol = (lotWidth - 0.5 - 0.08) * 64;
    const row = (flip ? contact.col - contact.width : contact.row) * scale;
    const col = (flip ? contact.row + contact.width : contact.col) * scale;
    const x = point.x + (frontCol - col - frontRow + row) / 2;
    const y = point.y + (frontRow - row + frontCol - col) / 4;
    const image = scene.add
      .image(x, y, atlas, index)
      .setOrigin(0, 0)
      .setFlipX(flip)
      .setName(`debris:${currentId}`);
    image.setScale(scale).setDepth(point.y + (lotWidth + lotHeight - 1) * 16);
    layer.add(image);
  };
  for (const d of items) {
    currentId = cellKey(d);
    if (!debrisFootprint(d).some((c) => cellAllowed(c, policy))) continue;
    const spec = debrisTypes[d.kind];
    if (d.kind === "fallenTree") {
      // Two connected arms follow the two grid axes. Their shared back corner
      // leaves the inner four tiles clear, matching debrisFootprint exactly.
      sprite("debris-seasons", `log-${frame}`, d, 114, 1, 3, true);
      sprite("debris-seasons", `log-${frame}`, d, 114, 3, 1);
    } else if (d.kind === "log") {
      sprite("debris-seasons", `log-${frame}`, d, 88, 2, 1);
    } else {
      if (d.kind === "boulder" || d.kind === "rockpile")
        sprite(
          "debris-seasons",
          `rocks-${frame}`,
          d,
          d.kind === "rockpile" ? 174 : 112,
          spec.width,
          spec.height,
        );
      else
        sprite(
          "border-details",
          frame * 4 + (d.kind === "berries" ? 1 : d.kind === "weeds" ? 0 : 2),
          d,
          d.kind === "stones" ? 49 : 57,
        );
    }
  }
}
