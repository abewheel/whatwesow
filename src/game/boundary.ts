import Phaser from "phaser";
import type { MacroState } from "../macro/state";
import { WORLD_SIZE, type Cell } from "../micro/world";

type Point = { x: number; y: number };
const colors = {
  spring: {
    bank: 0x829b58,
    water: 0x539da6,
    shallow: 0x79beb6,
    foam: 0xc6e7d0,
    road: 0xc3ad7d,
    track: 0xa08b62,
  },
  summer: {
    bank: 0x8c9c55,
    water: 0x408d9b,
    shallow: 0x66b1aa,
    foam: 0xb7e1cf,
    road: 0xccb580,
    track: 0xaa9064,
  },
  fall: {
    bank: 0x9d9359,
    water: 0x648e96,
    shallow: 0x85ada3,
    foam: 0xc7d9c7,
    road: 0xb39d75,
    track: 0x917e60,
  },
  winter: {
    bank: 0xb2c6bb,
    water: 0x91bbc6,
    shallow: 0xb8d6da,
    foam: 0xe5f0e8,
    road: 0xd9dfd3,
    track: 0xb2bcb2,
  },
};

/** Decorative estate edges. All geometry remains outside the buildable cells. */
export function drawBoundary(
  scene: Phaser.Scene,
  ground: Phaser.GameObjects.Graphics,
  scenery: Phaser.GameObjects.Container,
  season: MacroState["season"],
  point: (cell: Cell) => Point,
  view: { x: number; y: number; width: number; height: number; zoom?: number },
) {
  const p = colors[season],
    winter = season === "winter";
  const at = (col: number, row: number) => point({ col, row });
  const visible = (points: Point[], padding = 4) => {
    const xs = points.map((p) => p.x),
      ys = points.map((p) => p.y);
    return (
      Math.max(...xs) >= view.x - padding &&
      Math.min(...xs) <= view.x + view.width / (view.zoom ?? 1) + padding &&
      Math.max(...ys) >= view.y - padding &&
      Math.min(...ys) <= view.y + view.height / (view.zoom ?? 1) + padding
    );
  };
  const polygon = (vertices: Point[], color: number) => {
    if (!visible(vertices)) return;
    ground.fillStyle(color);
    ground.fillPoints(
      vertices.map(({ x, y }) => new Phaser.Math.Vector2(x, y)),
      true,
    );
  };
  const band = (
    c0: number,
    r0: number,
    c1: number,
    r1: number,
    color: number,
  ) => polygon([at(c0, r0), at(c1, r0), at(c1, r1), at(c0, r1)], color);
  const rect = (x: number, y: number, w: number, h: number, color: number) => {
    if (
      !visible([
        { x, y },
        { x: x + w, y: y + h },
      ])
    )
      return;
    ground.fillStyle(color);
    ground.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const line = (a: Point, b: Point, color: number, width = 1) => {
    if (!visible([a, b], width)) return;
    ground.lineStyle(width, color);
    ground.lineBetween(a.x, a.y, b.x, b.y);
  };
  const noise = (i: number) => {
    const n = Math.sin(i * 127.1 + 43) * 43758.5453;
    return n - Math.floor(n);
  };
  const stone = (x: number, y: number, size = 1) => {
    rect(x - 4 * size, y, 9 * size, 4 * size, 0x737e70);
    rect(
      x - 3 * size,
      y - 2 * size,
      7 * size,
      4 * size,
      winter ? 0xe7eee1 : 0xbac1a2,
    );
    rect(
      x - 2 * size,
      y - 2 * size,
      4 * size,
      size,
      winter ? 0xf6f5e9 : 0xd8d6b7,
    );
  };
  // Northeast: a continuous stream, with uneven layered banks and shallow water.
  band(-0.5, -3.5, WORLD_SIZE + 1, -0.55, p.bank);
  for (let i = -2; i < WORLD_SIZE * 4 + 4; i++) {
    const col = i / 4,
      next = (i + 1) / 4;
    const r = -2.1 + Math.sin(col * 0.48) * 0.2,
      rn = -2.1 + Math.sin(next * 0.48) * 0.2;
    polygon(
      [
        at(col, r - 1.05),
        at(next, rn - 1.05),
        at(next, rn + 1.05),
        at(col, r + 1.05),
      ],
      p.shallow,
    );
    polygon(
      [
        at(col, r - 0.8),
        at(next, rn - 0.8),
        at(next, rn + 0.8),
        at(col, r + 0.8),
      ],
      p.water,
    );
    if (i % 3 === 0) line(at(col, r - 0.3), at(col + 0.32, r - 0.3), p.foam, 1);
    if (i % 7 === 0)
      line(at(col + 0.1, r + 0.25), at(col + 0.55, r + 0.25), p.shallow, 2);
    if (i % 5 === 0) {
      const s = at(col, -0.68 - noise(i) * 0.12);
      stone(s.x, s.y, 0.7 + noise(i) * 0.6);
    }
    if (i % 9 === 0) {
      const reed = at(col, -0.82);
      for (let j = 0; j < 3; j++) {
        rect(
          reed.x + j * 3,
          reed.y - 10 - (j % 2) * 4,
          1,
          11,
          winter ? 0x8f9f8d : 0x6e8550,
        );
        rect(
          reed.x + j * 3 - 1,
          reed.y - 12 - (j % 2) * 4,
          3,
          5,
          winter ? 0xdbe3d5 : 0xa38b50,
        );
      }
    }
  }
  // Southeast: a worn gravel lane, wheel tracks, scattered stones, and split rails.
  band(WORLD_SIZE - 0.42, -1, WORLD_SIZE + 2.4, WORLD_SIZE + 1, p.bank);
  band(WORLD_SIZE + 0.05, -1, WORLD_SIZE + 2.05, WORLD_SIZE + 1, p.road);
  for (const offset of [0.5, 1.5])
    line(
      at(WORLD_SIZE + offset, -1),
      at(WORLD_SIZE + offset, WORLD_SIZE + 1),
      p.track,
      3,
    );
  for (let i = 0; i < 420; i++) {
    const pos = at(
      WORLD_SIZE + 0.15 + noise(i) * 1.8,
      noise(i + 1000) * (WORLD_SIZE + 1),
    );
    rect(
      pos.x,
      pos.y,
      2 + (i % 2),
      1,
      i % 3 === 0 ? p.track : winter ? 0xf4f3e6 : 0xe2cda0,
    );
  }
  for (let row = 0; row < WORLD_SIZE; row += 1.4) {
    // Leave an opening where a future farm entrance can meet the lane.
    if (row > 14 && row < 18) continue;
    const a = at(WORLD_SIZE - 0.38, row),
      b = at(WORLD_SIZE - 0.38, Math.min(row + 1.4, WORLD_SIZE));
    for (const dy of [-12, -6]) {
      line({ x: a.x, y: a.y + dy }, { x: b.x, y: b.y + dy }, 0x856849, 4);
      line(
        { x: a.x, y: a.y + dy - 1 },
        { x: b.x, y: b.y + dy - 1 },
        winter ? 0xe4e8d9 : 0xd3ba86,
        2,
      );
    }
    rect(a.x - 2, a.y - 19, 5, 21, 0x886c4e);
    rect(a.x - 2, a.y - 19, 3, 18, winter ? 0xe6e9db : 0xd6c493);
  }
  // Timber footbridge carries the lane across the river at the far corner.
  band(WORLD_SIZE - 0.25, -3.1, WORLD_SIZE + 1.9, -0.6, 0x73553d);
  for (let row = -3; row < -0.6; row += 0.17)
    line(
      at(WORLD_SIZE - 0.25, row),
      at(WORLD_SIZE + 1.9, row),
      winter ? 0xdde3d5 : 0xc09b66,
      4,
    );
  for (const col of [WORLD_SIZE - 0.25, WORLD_SIZE + 1.9]) {
    const a = at(col, -3.1),
      b = at(col, -0.6);
    line(
      { x: a.x, y: a.y - 12 },
      { x: b.x, y: b.y - 12 },
      winter ? 0xe2e7db : 0x9a7950,
      3,
    );
    for (const row of [-3.1, -1.85, -0.6]) {
      const post = at(col, row);
      rect(post.x - 2, post.y - 17, 4, 19, 0x7f6447);
      rect(post.x - 2, post.y - 18, 4, 2, winter ? 0xf5f4e9 : 0xd4b581);
    }
  }
  // Southwest: a low dry-stone wall and an irregular cottage hedgerow.
  band(-0.5, WORLD_SIZE - 0.42, WORLD_SIZE + 0.5, WORLD_SIZE + 1.8, p.bank);
  for (let col = 0; col < WORLD_SIZE; col += 0.42) {
    const s = at(col, WORLD_SIZE - 0.33);
    stone(s.x, s.y, 1.05);
    stone(s.x + 2, s.y - 5, 0.85);
  }
  const frame = { spring: 0, summer: 1, fall: 2, winter: 3 }[season];
  const hedgeFrame = scene.textures.get("hedgerow").get(frame);
  for (let col = 0.5; col < WORLD_SIZE; col += 1.3) {
    const pos = at(col, WORLD_SIZE + 1.3);
    if (!visible([pos], 130)) continue;
    scenery.add(
      scene.add
        .image(pos.x, pos.y, "hedgerow", frame)
        .setOrigin(0.5, 1)
        .setDisplaySize(105, (105 * hedgeFrame.height) / hedgeFrame.width),
    );
  }
  // Warm lanterns punctuate the road without entering the placement grid.
  for (const row of [3, 10, 22, 29]) {
    const pos = at(WORLD_SIZE + 0.05, row);
    stone(pos.x, pos.y, 1.2);
    rect(pos.x - 1, pos.y - 35, 3, 34, 0x615c46);
    rect(pos.x - 5, pos.y - 41, 11, 12, 0x615c46);
    rect(pos.x - 3, pos.y - 39, 7, 8, 0xf6ce74);
    rect(pos.x, pos.y - 39, 1, 8, 0xffedaf);
    rect(pos.x - 6, pos.y - 43, 13, 3, winter ? 0xecefe0 : 0x7a7455);
  }
  // Northwest: dense woodland with its feet safely outside the property grid.
  band(-3.3, -0.5, -0.55, WORLD_SIZE + 0.5, p.bank);
  // A staggered rear row gives the woodland depth instead of a single hedge of trees.
  for (let row = 4; row < WORLD_SIZE - 1; row += 3.25) {
    const pos = at(-4.6 - noise(row) * 0.35, row);
    const size = 134 + noise(row + 7) * 18;
    if (!visible([pos], 180)) continue;
    scenery.add(
      scene.add
        .image(pos.x, pos.y, "woodland", frame)
        .setOrigin(0.5, 0.96)
        .setDisplaySize(size, size)
        .setTint(0xe2ebd8),
    );
  }
  for (let row = 1; row < WORLD_SIZE; row += 2) {
    const pos = at(-2.7, row);
    if (!visible([pos], 180)) continue;
    scenery.add(
      scene.add
        .image(pos.x, pos.y, "woodland", frame)
        .setOrigin(0.5, 0.96)
        .setDisplaySize(142, 142),
    );
    const root = at(-0.82, row + 0.6);
    stone(root.x, root.y, 0.7);
  }
}
