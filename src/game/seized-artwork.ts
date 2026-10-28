import Phaser from "phaser";
import { mix } from "../contracts/world";
import type { Cell } from "../micro/world";
import type { MacroState } from "../macro/state";

/** Trim transparent gutters so each scar fills one cell at every zoom. */
export function prepareSeizedArtwork(scene: Phaser.Scene) {
  const texture = scene.textures.get("seized-land");
  const source = texture.getSourceImage() as HTMLImageElement;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d")!;
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const width = Math.floor(source.width / 2);
  const height = Math.floor(source.height / 2);
  for (let frame = 0; frame < 4; frame++) {
    const ox = (frame % 2) * width,
      oy = Math.floor(frame / 2) * height;
    let left = width,
      top = height,
      right = 0,
      bottom = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if (pixels[((oy + y) * source.width + ox + x) * 4 + 3] < 32) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    texture.add(
      frame,
      0,
      ox + left,
      oy + top,
      right - left + 1,
      bottom - top + 1,
    );
  }
}

export function drawSeizedLand(
  scene: Phaser.Scene,
  scenery: Phaser.GameObjects.Container,
  cell: Cell,
  point: { x: number; y: number },
  season: MacroState["season"],
) {
  const frame = mix(cell.row, cell.col) % 4;
  const image = scene.add
    .image(point.x, point.y + 16, "seized-land", frame)
    .setOrigin(0.5, 1)
    .setDepth(point.y + 1);
  image.setScale(66 / image.width);
  if (season === "winter") image.setTint(0xc7cdd0);
  else if (season === "fall") image.setTint(0xe0c4a6);
  scenery.add(image);
}
