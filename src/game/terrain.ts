import Phaser from "phaser";
import type { MacroState } from "../macro/state";
import type { Cell } from "../micro/world";

type Season = MacroState["season"];
export type GroundMaterial = "grass" | "soil" | "woodland" | "gravel";
const materials: GroundMaterial[] = ["grass", "soil", "woodland", "gravel"];
const targets: Record<Season, number[][]> = {
  spring: [
    [125, 157, 81],
    [139, 88, 49],
    [73, 99, 54],
    [181, 162, 120],
  ],
  summer: [
    [125, 149, 67],
    [144, 92, 50],
    [67, 91, 47],
    [190, 168, 123],
  ],
  fall: [
    [164, 150, 83],
    [132, 84, 49],
    [114, 98, 52],
    [170, 149, 112],
  ],
  winter: [
    [206, 220, 209],
    [125, 105, 87],
    [165, 187, 177],
    [210, 217, 207],
  ],
};
const tileWidth = 128,
  tileHeight = 64,
  gutter = 2;
const strideX = tileWidth + gutter * 2,
  strideY = tileHeight + gutter * 2;

/** Contiguous samples keep the material stable across cells and camera changes. */
export function groundFrame(cell: Cell, material: GroundMaterial) {
  const wrap = (n: number) => ((n % 4) + 4) % 4;
  return materials.indexOf(material) * 16 + wrap(cell.row) * 4 + wrap(cell.col);
}

/** Bake the painted surfaces once per season, rather than shading pixels per draw. */
export function prepareGround(scene: Phaser.Scene, season: Season) {
  const key = `ground-${season}`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures
    .get("ground-materials")
    .getSourceImage() as HTMLImageElement;
  const atlas = scene.textures.createCanvas(key, strideX * 16, strideY * 4)!;
  const context = atlas.context;
  const surface = document.createElement("canvas");
  surface.width = surface.height = 512;
  const paint = surface.getContext("2d")!;
  const samples: HTMLCanvasElement[] = [];
  for (let material = 0; material < 4; material++) {
    paint.drawImage(
      source,
      ((material % 2) * source.width) / 2,
      (Math.floor(material / 2) * source.height) / 2,
      source.width / 2,
      source.height / 2,
      0,
      0,
      512,
      512,
    );
    const pixels = paint.getImageData(0, 0, 512, 512);
    const mean = [0, 0, 0];
    for (let i = 0; i < pixels.data.length; i += 4)
      for (let c = 0; c < 3; c++) mean[c] += pixels.data[i + c] / (512 * 512);
    for (let i = 0; i < pixels.data.length; i += 4)
      for (let c = 0; c < 3; c++)
        pixels.data[i + c] = Math.max(
          0,
          Math.min(
            255,
            targets[season][material][c] +
              (pixels.data[i + c] - mean[c]) *
                (season === "winter" ? 0.3 : material === 1 ? 0.85 : 0.5),
          ),
        );
    const sample = document.createElement("canvas");
    sample.width = sample.height = 512;
    sample.getContext("2d")!.putImageData(pixels, 0, 0);
    samples.push(sample);
  }
  for (let material = 0; material < 4; material++)
    for (let variant = 0; variant < 16; variant++) {
      const x = variant * strideX + gutter,
        y = material * strideY + gutter;
      context.save();
      // Project a 128px square onto the same 2:1 diamond as the placement grid.
      context.setTransform(0.5, 0.25, -0.5, 0.25, x + 64, y);
      const sx = (variant % 4) * 128,
        sy = Math.floor(variant / 4) * 128;
      if (material === 1) {
        context.drawImage(samples[0], sx, sy, 128, 128, 0, 0, 128, 128);
        context.beginPath();
        context.moveTo(6, 9);
        context.lineTo(119, 6);
        context.lineTo(123, 118);
        context.lineTo(9, 122);
        context.closePath();
        context.fillStyle = "#513723";
        context.fill();
        context.save();
        context.clip();
        context.drawImage(samples[material], sx, sy, 128, 128, 0, -3, 128, 128);
        // Shallow furrows have a dark trough and a sunlit crumbly ridge.
        for (let row = 19; row < 120; row += 22) {
          context.beginPath();
          context.moveTo(11, row);
          context.bezierCurveTo(42, row - 2, 86, row + 2, 121, row - 1);
          context.lineWidth = 5;
          context.strokeStyle = "rgba(64,39,22,.5)";
          context.stroke();
          context.beginPath();
          context.moveTo(13, row - 4);
          context.lineTo(118, row - 5);
          context.lineWidth = 2;
          context.strokeStyle = "rgba(235,183,113,.24)";
          context.stroke();
        }
        context.restore();
      } else {
        context.drawImage(samples[material], sx, sy, 128, 128, 0, 0, 128, 128);
      }
      context.restore();
      atlas.add(material * 16 + variant, 0, x, y, tileWidth, tileHeight);
    }
  atlas.refresh();
  atlas.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return key;
}

export function groundTile(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  key: string,
  cell: Cell,
  point: { x: number; y: number },
  material: GroundMaterial,
) {
  const tile = scene.add
    .image(point.x, point.y, key, groundFrame(cell, material))
    .setDisplaySize(64, 32);
  const shade = Math.min(
    255,
    Math.round(
      246 +
        Math.sin(cell.col * 0.23 + cell.row * 0.19) * 6 +
        Math.cos(cell.row * 0.43 - cell.col * 0.13) * 3,
    ),
  );
  tile.setTint(Phaser.Display.Color.GetColor(shade, shade, shade));
  layer.add(tile);
  return tile;
}
