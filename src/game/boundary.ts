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
  // Continue each exterior biome to the visible window, rather than ending at a thin strip.
  const origin = at(0, 0),
    colAxis = at(1, 0),
    rowAxis = at(0, 1);
  const ax = colAxis.x - origin.x,
    ay = colAxis.y - origin.y,
    bx = rowAxis.x - origin.x,
    by = rowAxis.y - origin.y;
  const determinant = ax * by - ay * bx;
  const unproject = (x: number, y: number) => ({
    col: ((x - origin.x) * by - (y - origin.y) * bx) / determinant,
    row: (ax * (y - origin.y) - ay * (x - origin.x)) / determinant,
  });
  const viewWidth = view.width / (view.zoom ?? 1),
    viewHeight = view.height / (view.zoom ?? 1);
  const bounds = [
    unproject(view.x - 300, view.y - 300),
    unproject(view.x + viewWidth + 300, view.y - 300),
    unproject(view.x - 300, view.y + viewHeight + 300),
    unproject(view.x + viewWidth + 300, view.y + viewHeight + 300),
  ];
  const minCol = Math.floor(Math.min(...bounds.map((p) => p.col))) - 4,
    maxCol = Math.ceil(Math.max(...bounds.map((p) => p.col))) + 4;
  const minRow = Math.floor(Math.min(...bounds.map((p) => p.row))) - 4,
    maxRow = Math.ceil(Math.max(...bounds.map((p) => p.row))) + 4;
  const forestFloor = winter
    ? 0xa8bfb5
    : season === "fall"
      ? 0x8c824c
      : 0x60834d;
  band(minCol - 6, -0.5, -0.55, WORLD_SIZE + 0.5, forestFloor);
  band(minCol - 6, minRow - 6, maxCol + 6, -0.55, p.bank);
  band(
    WORLD_SIZE + 2.4,
    minRow - 6,
    maxCol + 6,
    maxRow + 6,
    winter ? 0xc3d2c5 : season === "fall" ? 0xaca16c : 0x8ba35e,
  );
  // Stable, world-anchored flecks and meadow flowers break up the exterior ground.
  for (
    let y = Math.floor((view.y - 40) / 22) * 22;
    y < view.y + viewHeight + 40;
    y += 22
  )
    for (
      let x = Math.floor((view.x - 40) / 24) * 24;
      x < view.x + viewWidth + 40;
      x += 24
    ) {
      const seed = x * 13 + y * 29,
        jx = x + noise(seed) * 19,
        jy = y + noise(seed + 1) * 17,
        cell = unproject(jx, jy);
      if (
        cell.row > WORLD_SIZE - 0.5 ||
        (cell.col >= -0.5 && cell.col < WORLD_SIZE - 0.5 && cell.row >= -0.5)
      )
        continue;
      const forest = cell.col < -0.5 && cell.row >= -0.5;
      rect(jx, jy, 3, 1, winter ? 0xe5eadd : forest ? 0x446c40 : 0xa9b779);
      if (noise(seed + 3) > 0.78) {
        rect(jx, jy - 4, 1, 5, winter ? 0x95a999 : 0x66834d);
        rect(
          jx - 2,
          jy - 6,
          4,
          3,
          winter
            ? 0xe9ede1
            : season === "fall"
              ? 0xcb9b55
              : noise(seed + 6) > 0.5
                ? 0xf0d19b
                : 0xe3b9c7,
        );
      }
      if (noise(seed + 7) > 0.985) stone(jx, jy, 0.8 + noise(seed) * 0.7);
    }
  // Southwest / bottom-left: water continues beyond the bank to the end of the window.
  const shore = (col: number) =>
    WORLD_SIZE +
    0.65 +
    Math.sin(col * 0.39) * 0.25 +
    Math.sin(col * 0.91) * 0.1;
  const shoreline: Point[] = [];
  for (let col = minCol - 4; col <= maxCol + 4; col += 0.5)
    shoreline.push(at(col, shore(col)));
  const farRow = Math.max(WORLD_SIZE + 14, maxRow + 8);
  polygon(
    [...shoreline, at(maxCol + 4, farRow), at(minCol - 4, farRow)],
    p.water,
  );
  for (let col = minCol - 4; col < maxCol + 4; col += 0.5) {
    const next = col + 0.5,
      r = shore(col),
      rn = shore(next);
    polygon(
      [
        at(col, WORLD_SIZE - 0.45),
        at(next, WORLD_SIZE - 0.45),
        at(next, r),
        at(col, r),
      ],
      p.bank,
    );
    polygon(
      [at(col, r), at(next, rn), at(next, rn + 1), at(col, r + 1)],
      p.shallow,
    );
    if (Math.round(col * 2) % 3 === 0) {
      const pos = at(col, WORLD_SIZE + 0.15);
      stone(pos.x, pos.y, 0.7 + noise(col) * 1.3);
    }
    if (Math.round(col * 2) % 7 === 0) {
      const reed = at(col, WORLD_SIZE + 0.42);
      for (let j = 0; j < 4; j++) {
        rect(
          reed.x + j * 3,
          reed.y - 10 - (j % 2) * 5,
          1,
          12,
          winter ? 0x91a495 : 0x69854a,
        );
        rect(
          reed.x + j * 3 - 1,
          reed.y - 13 - (j % 2) * 5,
          3,
          5,
          winter ? 0xdbe3d5 : 0xad9557,
        );
      }
    }
  }
  for (
    let y = Math.floor(view.y / 38) * 38;
    y < view.y + viewHeight + 38;
    y += 38
  )
    for (
      let x = Math.floor(view.x / 66) * 66;
      x < view.x + viewWidth + 66;
      x += 66
    ) {
      const seed = x * 7 + y * 31,
        cell = unproject(x, y);
      if (cell.row < shore(cell.col) + 0.4) continue;
      const start = at(cell.col + noise(seed) * 0.3, cell.row),
        end = at(cell.col + 0.12 + noise(seed + 1) * 0.3, cell.row);
      line(
        start,
        end,
        noise(seed + 2) > 0.6 ? p.foam : p.shallow,
        winter ? 2 : 1,
      );
      if (winter && noise(seed + 3) > 0.7)
        line(
          at(cell.col + 0.5, cell.row + 0.4),
          at(cell.col + 0.65, cell.row + 0.4),
          p.foam,
          2,
        );
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
  // The country lane crosses the bottom-left river and continues out of the window.
  const bridgeStart = WORLD_SIZE + 0.25,
    bridgeEnd = Math.max(WORLD_SIZE + 12, maxRow + 6);
  band(WORLD_SIZE + 0.05, bridgeStart, WORLD_SIZE + 2.05, bridgeEnd, 0x73553d);
  for (let row = bridgeStart; row < bridgeEnd; row += 0.22)
    line(
      at(WORLD_SIZE + 0.05, row),
      at(WORLD_SIZE + 2.05, row),
      winter ? 0xdde3d5 : 0xc09b66,
      4,
    );
  for (const col of [WORLD_SIZE + 0.05, WORLD_SIZE + 2.05]) {
    const a = at(col, bridgeStart),
      b = at(col, bridgeEnd);
    line(
      { x: a.x, y: a.y - 12 },
      { x: b.x, y: b.y - 12 },
      winter ? 0xe2e7db : 0x9a7950,
      3,
    );
    for (let row = bridgeStart; row < bridgeEnd; row += 1.3) {
      const post = at(col, row);
      rect(post.x - 2, post.y - 17, 4, 19, 0x7f6447);
      rect(post.x - 2, post.y - 18, 4, 2, winter ? 0xf5f4e9 : 0xd4b581);
    }
  }
  // Northeast: the low cottage wall now opens onto a textured wildflower meadow.
  const frame = { spring: 0, summer: 1, fall: 2, winter: 3 }[season];
  const hedgeFrame = scene.textures.get("hedgerow").get(frame);
  for (let col = 0.5; col < WORLD_SIZE; col += 1.3) {
    const pos = at(col, -0.9);
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
  // Northwest: irregular, depth-sorted groves fill the forest side of the window.
  const trees: {
    x: number;
    y: number;
    size: number;
    variation: boolean;
    tint: number;
  }[] = [];
  const tree = (col: number, row: number, seed: number, baseSize: number) => {
    const pos = at(col, row),
      size = baseSize * (0.78 + noise(seed + 17) * 0.5);
    if (!visible([pos], size)) return;
    const tints = winter
      ? [0xffffff, 0xe8eff1, 0xd7e3e5]
      : [0xffffff, 0xe6edd6, 0xd1dfc8, 0xf0ead3];
    trees.push({
      ...pos,
      size,
      variation: noise(seed + 31) > 0.47,
      tint: tints[Math.floor(noise(seed + 8) * tints.length)],
    });
  };
  // Deeper woodland uses larger, looser stands; the edge has smaller saplings and gaps.
  for (let gx = Math.floor(minCol / 5.7) - 1; gx <= -2; gx++)
    for (
      let gy = Math.max(0, Math.floor(minRow / 4.3) - 1);
      gy <= Math.min(Math.ceil(WORLD_SIZE / 4.3), Math.ceil(maxRow / 4.3) + 1);
      gy++
    ) {
      const seed = gx * 953 + gy * 127;
      if (noise(seed) > 0.9) continue;
      tree(
        gx * 5.7 - 1 + noise(seed + 1) * 2.8,
        gy * 4.3 + noise(seed + 2) * 2.8,
        seed,
        244,
      );
    }
  for (let band = 0; band < 3; band++)
    for (
      let gy = Math.max(0, Math.floor(minRow / 2.5) - 1);
      gy < Math.min(Math.ceil(WORLD_SIZE / 2.5), Math.ceil(maxRow / 2.5) + 1);
      gy++
    ) {
      const seed = band * 547 + gy * 193;
      if (noise(seed) > 0.86) continue;
      const row = 0.8 + gy * 2.5 + noise(seed + 2) * 1.5;
      if (row > WORLD_SIZE - 0.2) continue;
      tree(
        -3.1 - band * 3.2 + noise(seed + 1) * 1.1,
        row,
        seed,
        band === 0 ? 132 : 174,
      );
    }
  trees.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const tree of trees)
    scenery.add(
      scene.add
        .image(
          tree.x,
          tree.y,
          tree.variation ? "woodland-variation" : "woodland",
          frame,
        )
        .setOrigin(0.5, 0.96)
        .setDisplaySize(tree.size, tree.size)
        .setTint(tree.tint),
    );
}
