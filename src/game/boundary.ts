import Phaser from "phaser";
import type { MacroState } from "../macro/state";
import { WORLD_SIZE, type Cell } from "../micro/world";
import type { GroundLayer } from "./terrain";
import { seasonFrame } from "./border-artwork";
import { laneArtwork, type LaneKind } from "./lane-artwork";
import { buildingArtwork } from "./building-artwork";

type Point = { x: number; y: number };
export type BoundaryWalker = {
  sprite: Phaser.GameObjects.Image;
  start: Point;
  end: Point;
  offset: number;
};

/** A shared clock preserves decorative walks across camera and farm redraws. */
export function updateBoundaryWalkers(walkers: BoundaryWalker[], time: number) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const { sprite, start, end, offset } of walkers) {
    const phase = ((time + offset) % 16000) / 8000;
    const returning = phase >= 1;
    const progress = reduced ? 0.5 : returning ? 2 - phase : phase;
    sprite.setPosition(
      start.x + (end.x - start.x) * progress,
      start.y + (end.y - start.y) * progress,
    );
    sprite.setFrame(
      reduced
        ? 42
        : (returning ? 6 : 0) + (Math.floor((time + offset) / 140) % 6),
    );
    sprite.setDepth(sprite.y);
  }
}

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
  groundArt: GroundLayer,
) {
  const walkers: BoundaryWalker[] = [];
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
  const polygon = (vertices: Point[], color: number, alpha = 1) => {
    if (!visible(vertices)) return;
    ground.fillStyle(color, alpha);
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
    if (!visible([{ x, y }], size * 12)) return;
    ground.fillStyle(0x314a35, 0.2);
    ground.fillEllipse(x + size, y + size * 3, size * 14, size * 6);
    polygon(
      [
        { x: x - 7 * size, y },
        { x: x - 4 * size, y: y - 5 * size },
        { x: x + 3 * size, y: y - 6 * size },
        { x: x + 7 * size, y: y - size },
        { x: x + 4 * size, y: y + 4 * size },
        { x: x - 4 * size, y: y + 3 * size },
      ],
      winter ? 0xb9c7c0 : 0x7e8975,
    );
    polygon(
      [
        { x: x - 7 * size, y },
        { x: x - 4 * size, y: y - 5 * size },
        { x: x + 3 * size, y: y - 6 * size },
        { x: x + 5 * size, y: y - 2 * size },
        { x: x - size, y: y + size },
      ],
      winter ? 0xf0f1e6 : 0xc4c5a2,
    );
    line(
      { x: x - 3 * size, y: y - 4 * size },
      { x: x + 2 * size, y: y - 5 * size },
      winter ? 0xffffff : 0xe0d9b6,
      size,
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
  // Paint the exterior with the same materials as the estate. The river and its
  // banks mask this ground below, so meadow continues naturally on the far side.
  for (let row = minRow; row <= maxRow; row++)
    for (let col = minCol; col <= maxCol; col++) {
      if (row >= 0 && row < WORLD_SIZE && col >= 0 && col < WORLD_SIZE)
        continue;
      const pos = at(col, row);
      if (!visible([pos], 40)) continue;
      groundArt.tile(
        { row, col },
        pos,
        (col >= WORLD_SIZE && col < WORLD_SIZE + 2) ||
          (row >= WORLD_SIZE + 6 && (row % 10 === 0 || col % 10 === 0)) ||
          (col >= WORLD_SIZE + 4 &&
            row >= 0 &&
            row < WORLD_SIZE &&
            col % 8 === 0)
          ? "gravel"
          : (col < 0 && row < WORLD_SIZE) || row < -2
            ? "woodland"
            : "grass",
      );
    }
  // A narrow, gently winding channel leaves the opposite meadow bank visible.
  const shore = (col: number) =>
    WORLD_SIZE +
    0.65 +
    Math.sin(col * 0.39) * 0.25 +
    Math.sin(col * 0.91) * 0.1;
  const farShore = (col: number) =>
    shore(col) + 3.2 + Math.sin(col * 0.27 + 1) * 0.3;
  const shoreline: Point[] = [],
    farShoreline: Point[] = [];
  for (let col = minCol - 4; col <= maxCol + 4; col += 0.5) {
    shoreline.push(at(col, shore(col)));
    farShoreline.push(at(col, farShore(col)));
  }
  polygon([...shoreline, ...farShoreline.reverse()], p.water);
  for (let strip = 0; strip < 6; strip++) {
    const left: Point[] = [],
      right: Point[] = [];
    for (let col = minCol - 4; col <= maxCol + 4; col += 0.5) {
      const width = farShore(col) - shore(col);
      const meander = Math.sin(col * 0.71 + strip) * 0.05;
      left.push(at(col, shore(col) + width * (0.12 + strip * 0.12 + meander)));
      right.push(at(col, shore(col) + width * (0.23 + strip * 0.12 + meander)));
    }
    polygon(
      [...left, ...right.reverse()],
      strip % 2 ? p.shallow : 0x2d6576,
      winter ? 0.06 : 0.08,
    );
  }

  for (let col = minCol - 4; col < maxCol + 4; col += 0.5) {
    const next = col + 0.5,
      r = shore(col),
      rn = shore(next),
      far = farShore(col),
      farNext = farShore(next);
    polygon(
      [at(col, r - 0.22), at(next, rn - 0.22), at(next, rn), at(col, r)],
      p.bank,
    );
    polygon(
      [at(col, r), at(next, rn), at(next, rn + 0.35), at(col, r + 0.35)],
      p.shallow,
    );
    polygon(
      [
        at(col, far - 0.3),
        at(next, farNext - 0.3),
        at(next, farNext),
        at(col, far),
      ],
      p.shallow,
    );
    polygon(
      [
        at(col, far),
        at(next, farNext),
        at(next, farNext + 0.35),
        at(col, far + 0.35),
      ],
      winter ? 0xe0e6d9 : 0xc2b18a,
    );
    line(at(col, r), at(next, rn), winter ? 0xe3e9dc : 0x566c40, 2);
    line(at(col, far), at(next, farNext), winter ? 0xf1f2e7 : 0xd6c8a1, 2);
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
      if (
        cell.row < shore(cell.col) + 0.4 ||
        cell.row > farShore(cell.col) - 0.35
      )
        continue;
      const pos = at(cell.col + noise(seed) * 0.3, cell.row);
      const length = 8 + noise(seed + 1) * 23;
      ground.lineStyle(1, p.foam, 0.28 + noise(seed + 2) * 0.25);
      ground.beginPath();
      ground.moveTo(pos.x - length / 2, pos.y);
      ground.lineTo(pos.x - length / 4, pos.y - 1);
      ground.lineTo(pos.x + length / 4, pos.y - 1);
      ground.lineTo(pos.x + length / 2, pos.y - 2);
      ground.strokePath();
      if (noise(seed + 4) > 0.55) {
        ground.lineStyle(1, p.shallow, 0.35);
        ground.lineBetween(
          pos.x - length * 0.3,
          pos.y + 3,
          pos.x + length * 0.7,
          pos.y + 2,
        );
      }
      if (winter && noise(seed + 3) > 0.7)
        line(
          at(cell.col + 0.5, cell.row + 0.4),
          at(cell.col + 0.65, cell.row + 0.4),
          p.foam,
          2,
        );
    }
  // Southeast: a worn gravel lane, wheel tracks, scattered stones, and split rails.

  for (let row = -1; row < WORLD_SIZE + 1; row += 0.35)
    for (const offset of [0.15, 1.0]) {
      if (noise(row * 131 + offset) > 0.84) continue;
      line(
        at(WORLD_SIZE + offset, row),
        at(WORLD_SIZE + offset, row + 0.26),
        p.track,
        2,
      );
    }
  for (let i = 0; i < 420; i++) {
    const pos = at(
      WORLD_SIZE - 0.35 + noise(i) * 1.7,
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
  const laneSprite = (
    kind: LaneKind,
    col: number,
    row: number,
    width: number,
  ) => {
    const pos = at(col, row);
    if (!visible([pos], width)) return;
    const art = laneArtwork(kind, season);
    const frame = scene.textures.getFrame(art.key);
    scenery.add(
      scene.add
        .image(pos.x, pos.y, art.key)
        .setOrigin(art.originX, art.originY)
        .setDisplaySize(width, (width * frame.height) / frame.width)
        .setDepth(pos.y + (kind === "entrance" ? 34 : 0)),
    );
  };
  // Keep complete spans out of the entrance, with capped posts at both ends.
  for (let row = 0; row + 1.4 <= WORLD_SIZE; row += 1.4) {
    if (row < 18 && row + 1.4 > 14) continue;
    laneSprite("fence", WORLD_SIZE - 0.38, row, 84);
  }
  laneSprite("entrance", WORLD_SIZE - 0.38, 16, 232);
  // Irregular verge stones follow the lane, leaving the entrance clear.
  for (let row = -0.4; row < WORLD_SIZE; row += 0.65) {
    for (const col of [WORLD_SIZE - 0.48, WORLD_SIZE + 1.52]) {
      if (col < WORLD_SIZE && row > 13.5 && row < 18.5) continue;
      const pos = at(col + noise(row * 79) * 0.08, row);
      stone(pos.x, pos.y, 0.28 + noise(row * 37) * 0.13);
    }
  }
  // The country lane crosses the bottom-left river and continues out of the window.
  const bridgeStart = WORLD_SIZE + 0.25,
    bridgeEnd = farShore(WORLD_SIZE + 1) + 0.7;
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
  const detail = (
    kind: number,
    col: number,
    row: number,
    size: number,
    seed: number,
  ) => {
    const pos = at(col, row);
    if (!visible([pos], size + 15)) return;
    const art = scene.textures.getFrame(
      "border-details",
      seasonFrame(season) * 4 + kind,
    );
    scenery.add(
      scene.add
        .image(pos.x, pos.y, "border-details", seasonFrame(season) * 4 + kind)
        .setOrigin(0.5, 1)
        .setDisplaySize(size, (size * art.height) / art.width)
        .setFlipX(noise(seed + 4) > 0.5)
        .setDepth(pos.y),
    );
  };
  for (let col = Math.floor(minCol / 1.7) * 1.7; col <= maxCol; col += 1.7) {
    const seed = Math.round(col * 10) * 79;
    if (noise(seed) > 0.38)
      detail(
        3,
        col + noise(seed + 2) * 0.6,
        shore(col) - 0.05,
        32 + noise(seed + 1) * 22,
        seed,
      );
    if (noise(seed + 3) > 0.65)
      detail(
        2,
        col + 0.6,
        farShore(col) + 0.35,
        40 + noise(seed + 5) * 31,
        seed,
      );
    if (noise(seed + 6) > 0.3)
      detail(
        0,
        col - 0.4,
        farShore(col) + 1.2 + noise(seed + 7) * 3.5,
        38 + noise(seed + 8) * 24,
        seed,
      );
    if (noise(seed + 9) > 0.6)
      detail(
        3,
        col + 0.4,
        farShore(col) + 0.1,
        30 + noise(seed + 10) * 16,
        seed,
      );
  }
  for (let i = 0; i < WORLD_SIZE; i += 1.6) {
    const seed = Math.round(i * 10) * 137;
    detail(
      noise(seed) > 0.78 ? 2 : 0,
      WORLD_SIZE + 2.8 + noise(seed + 1) * 2,
      i,
      39 + noise(seed + 2) * 24,
      seed,
    );
    if (noise(seed + 3) > 0.55)
      detail(
        1,
        WORLD_SIZE + 4.5 + noise(seed + 4) * 2,
        i + 0.5,
        48 + noise(seed + 5) * 22,
        seed,
      );
    detail(
      noise(seed + 7) > 0.6 ? 1 : 0,
      i,
      -1.6 - noise(seed + 8) * 1.5,
      44 + noise(seed + 9) * 24,
      seed,
    );
    if (noise(seed + 10) > 0.35)
      detail(
        noise(seed + 11) > 0.7 ? 2 : 1,
        -1.9 - noise(seed + 12),
        i + 0.3,
        42 + noise(seed + 13) * 24,
        seed,
      );
  }
  // Occasional trees give the laneside meadow depth without screening the farm.
  for (let i = 2; i < WORLD_SIZE; i += 6.3) {
    const seed = Math.round(i * 17);
    for (const cell of [
      { col: WORLD_SIZE + 6.4 + noise(seed) * 2, row: i },
      { col: i + 1.3, row: -5.5 - noise(seed + 1) * 2 },
    ]) {
      const pos = point(cell),
        size = 100 + noise(seed + 2) * 45;
      if (visible([pos], size))
        scenery.add(
          scene.add
            .image(pos.x, pos.y, "woodland-variation", seasonFrame(season))
            .setOrigin(0.5, 0.96)
            .setDisplaySize(size, size)
            .setDepth(pos.y),
        );
    }
  }
  // Northeast: the low cottage wall now opens onto a textured wildflower meadow.
  const frame = seasonFrame(season);
  const hedgeFrame = scene.textures.get("hedgerow").get(frame);
  for (let col = 0.5; col < WORLD_SIZE; col += 1.3) {
    const pos = at(col, -0.9);
    if (!visible([pos], 130)) continue;
    scenery.add(
      scene.add
        .image(pos.x, pos.y, "hedgerow", frame)
        .setOrigin(0.5, 1)
        .setDisplaySize(105, (105 * hedgeFrame.height) / hedgeFrame.width)
        .setDepth(pos.y),
    );
  }
  // Lanterns flank the entrance and continue down the orchard lane.
  for (const row of [3, 10, 13.5, 18.5, 26, 34, 42, 50, 58])
    laneSprite("lamp", WORLD_SIZE + 1.8, row, 48);
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
  // Overlapping mixed stands make a continuous canopy, with smaller edge trees.
  for (let gx = Math.floor(minCol / 2.3) - 1; gx <= -2; gx++)
    for (
      let gy = Math.max(0, Math.floor(minRow / 2.0) - 1);
      gy <=
      Math.min(Math.floor((WORLD_SIZE - 1) / 2), Math.ceil(maxRow / 2) + 1);
      gy++
    ) {
      const seed = gx * 953 + gy * 127;
      tree(
        gx * 2.3 + noise(seed + 1) * 1.1,
        0.6 + gy * 2 + noise(seed + 2) * 0.9,
        seed,
        210,
      );
    }
  for (
    let gy = Math.max(0, Math.floor(minRow / 1.8) - 1);
    gy < Math.min(Math.floor(WORLD_SIZE / 1.8), Math.ceil(maxRow / 1.8) + 1);
    gy++
  ) {
    const seed = gy * 193 + 31;
    tree(
      -2.2 + noise(seed + 1) * 0.5,
      0.7 + gy * 1.8 + noise(seed + 2) * 0.7,
      seed,
      155,
    );
  }
  // The second forest reaches the upper scroll corners, including behind the
  // northwest grove. World-coordinate seeds keep every stand fixed while panning.
  for (
    let gx = Math.floor(minCol / 2.3) - 1;
    gx <= Math.ceil(maxCol / 2.3);
    gx++
  )
    for (let gy = Math.floor(minRow / 2) - 1; gy <= -2; gy++) {
      const seed = gx * 719 + gy * 263;
      tree(gx * 2.3 + noise(seed) * 1.1, gy * 2 + noise(seed + 1), seed, 210);
    }

  const atlas = season === "fall" || winter ? `farm-${season}` : "farm-spring";
  const sprite = (col: number, row: number, frame: number, size: number) => {
    const pos = at(col, row);
    if (!visible([pos], size)) return;
    scenery.add(
      scene.add
        .image(pos.x, pos.y, atlas, frame)
        .setOrigin(0.5, 0.9)
        .setDisplaySize(size, size)
        .setTint(season === "summer" ? 0xfff4d6 : 0xffffff)
        .setDepth(pos.y),
    );
  };
  const house = (col: number, row: number, frame: number) => {
    const art = buildingArtwork({ col, row, width: 3, height: 3 }, frame);
    const top = point(art),
      front = at(col + 2.5, row + 2.5);
    if (!visible([top, front], art.size)) return;
    scenery.add(
      scene.add
        .image(top.x, top.y, atlas, frame)
        .setOrigin(0, 0)
        .setDisplaySize(art.size, art.size)
        .setTint(season === "summer" ? 0xfff4d6 : 0xffffff)
        .setDepth(front.y),
    );
  };
  const stroll = (col: number, row: number, seed: number) => {
    const start = at(col, row),
      end = at(col + 2.4, row);
    if (!visible([start, end], 70)) return;
    const walker = scene.add
      .image(start.x, start.y, "farmer", 42)
      .setOrigin(0.5, 1)
      .setScale(0.25)
      .setTint([0xffd4b8, 0xd3e2ff, 0xe9d1ff][Math.abs(seed) % 3]);
    scenery.add(walker);
    walkers.push({ sprite: walker, start, end, offset: noise(seed) * 16000 });
  };
  // Riverside village: small blocks, flower gardens, wells and strolling locals.
  // Continue the lots beyond the viewport rather than leaving a bare outer edge.
  for (
    let row = Math.max(WORLD_SIZE + 8, Math.floor(minRow / 10) * 10 + 2);
    row <= maxRow;
    row += 10
  )
    for (let col = Math.floor(minCol / 10) * 10 + 2; col <= maxCol; col += 10) {
      const seed = row * 173 + col * 37;
      house(col, row, noise(seed) > 0.78 ? 4 : 0);
      house(col + 5, row + 3, noise(seed + 1) > 0.65 ? 1 : 0);
      sprite(col + 5, row, 5, 140);
      sprite(col + 1, row + 6, 3, 105);
      detail(0, col + 3.6, row + 4, 55, seed);
      detail(1, col + 7, row + 7, 65, seed + 1);
      stroll(col, row - 1.8, seed);
    }
  // The laneside orchard alternates fruit trees and flowering trees around
  // grassy clearings and garden sheds, with seasonal roofs and bare winter limbs.
  for (
    let col = Math.max(WORLD_SIZE + 5, Math.floor(minCol / 4) * 4 + 1);
    col <= maxCol;
    col += 4
  )
    for (
      let row = Math.max(1, Math.floor(minRow / 4) * 4 + 1);
      row <= Math.min(WORLD_SIZE + 7, maxRow);
      row += 4
    ) {
      const seed = col * 97 + row * 151;
      if (col % 16 === 5 && row % 16 === 5) {
        house(col, row, 4);
        sprite(col + 2, row + 3, 3, 95);
        stroll(col - 0.9, row + 3, seed);
      } else {
        sprite(
          col + noise(seed) * 0.8,
          row + noise(seed + 1) * 0.8,
          noise(seed + 2) > 0.75 ? 5 : 2,
          140 + noise(seed + 3) * 35,
        );
        detail(0, col + 1.4, row + 1, 45 + noise(seed + 4) * 15, seed);
      }
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
        .setTint(tree.tint)
        .setDepth(tree.y),
    );
  updateBoundaryWalkers(walkers, scene.time.now);
  return walkers;
}
