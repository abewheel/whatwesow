import Phaser from "phaser";
import type { MacroState } from "../macro/state";

const seasons = {
  spring: {
    grass: 0x83ad65,
    light: 0x97bb73,
    leaf: 0x4e8547,
    crown: 0x6eaa51,
    soil: 0x96623f,
    flower: 0xf3c3b9,
  },
  summer: {
    grass: 0x83a957,
    light: 0x98b964,
    leaf: 0x397244,
    crown: 0x609547,
    soil: 0x94603b,
    flower: 0xf6d270,
  },
  fall: {
    grass: 0xb5a16a,
    light: 0xc5b178,
    leaf: 0xa75b36,
    crown: 0xd08c43,
    soil: 0x8d5a3e,
    flower: 0xf1c66d,
  },
  winter: {
    grass: 0xc3d7ce,
    light: 0xd4e3d9,
    leaf: 0x53756b,
    crown: 0xe5eee2,
    soil: 0x877c69,
    flower: 0xf4f2df,
  },
};

export class FarmScene extends Phaser.Scene {
  private ground?: Phaser.GameObjects.Graphics;
  private season: MacroState["season"] = "spring";
  constructor() {
    super("farm");
  }
  create() {
    this.ground = this.add.graphics();
    this.draw();
    this.scale.on("resize", this.draw, this);
  }
  setState(state: MacroState) {
    this.season = state.season;
    if (this.ground) this.draw();
  }
  private draw() {
    const g = this.ground!;
    g.clear();
    const p = seasons[this.season];
    this.cameras.main.setBackgroundColor(p.grass);
    const width = this.scale.width,
      height = this.scale.height;
    // Draw on a small logical canvas, then scale in whole pixels for crisp edges.
    const scale = Math.max(
      1,
      Math.min(3, Math.floor(Math.min(width / 420, height / 230))),
    );
    g.setScale(scale);
    const w = width / scale,
      h = height / scale;
    const cx = Math.round(w / 2),
      cy = Math.round(h / 2 + 8);
    const rect = (
      x: number,
      y: number,
      rw: number,
      rh: number,
      color: number,
    ) => {
      g.fillStyle(color);
      g.fillRect(Math.round(x), Math.round(y), rw, rh);
    };
    const diamond = (
      x: number,
      y: number,
      tw: number,
      th: number,
      color: number,
    ) => {
      g.fillStyle(color);
      g.fillPoints(
        [
          { x, y: y - th / 2 },
          { x: x + tw / 2, y },
          { x, y: y + th / 2 },
          { x: x - tw / 2, y },
        ].map(({ x, y }) => new Phaser.Math.Vector2(x, y)),
        true,
      );
    };
    // Fixed arithmetic keeps scenery stable across reloads and seasonal changes.
    for (let i = 0; i < 1600; i++) {
      const x = (i * 73 + 19) % Math.ceil(w),
        y = (i * 47 + Math.floor(i / 7) * 13) % Math.ceil(h);
      rect(x, y, i % 4 === 0 ? 3 : 1, 1, i % 3 ? p.light : p.leaf);
    }
    // Winding water and stepping-stone banks.
    for (let y = -10; y < h + 10; y += 4) {
      const x = w * 0.88 + Math.sin(y / 45) * 16;
      rect(x - 5, y, 39, 4, 0x719a82);
      rect(x, y, 30, 4, this.season === "winter" ? 0xa9d3d4 : 0x68aeb9);
      if (y % 16 === 0) rect(x + 5, y, 14, 1, 0xc0e2d5);
    }
    // A footpath leads through the farm, without suggesting character movement.
    for (let i = -Math.ceil(w / 2); i < Math.ceil(w / 2); i += 5) {
      const x = cx + i,
        y = cy - 44 + i * 0.48;
      diamond(x, y, 20, 10, 0xc7b585);
      if (i % 15 === 0) rect(x, y, 3, 1, 0xe1cf9e);
    }
    const tree = (x: number, y: number, size = 1) => {
      diamond(x + 2, y + 3, 27 * size, 12 * size, 0x688451);
      rect(x - 3, y - 22 * size, 6, 25 * size, 0x775333);
      rect(x + 1, y - 21 * size, 2, 22 * size, 0xa37a45);
      rect(x - 15 * size, y - 39 * size, 30 * size, 21 * size, p.leaf);
      rect(x - 11 * size, y - 48 * size, 23 * size, 31 * size, p.leaf);
      rect(x - 17 * size, y - 35 * size, 34 * size, 12 * size, p.leaf);
      rect(x - 12 * size, y - 40 * size, 24 * size, 16 * size, p.crown);
      rect(x - 8 * size, y - 46 * size, 14 * size, 25 * size, p.crown);
      rect(x - 10 * size, y - 38 * size, 5, 4, p.light);
      rect(x + 5 * size, y - 29 * size, 4, 3, p.light);
    };
    for (let i = 0; i < Math.ceil(w / 35); i++) {
      tree(i * 37 - 8, 65 + (i % 3) * 11, 1 + (i % 2) * 0.2);
      if (i % 3 !== 1) tree(i * 39 + 4, h - 8 + (i % 2) * 12);
    }
    // Farmhouse: cream plaster, terracotta roof, deep green door.
    const hx = cx - 80,
      hy = cy - 57;
    diamond(hx + 7, hy + 5, 90, 36, 0x688451);
    rect(hx - 30, hy - 39, 59, 43, 0x805331);
    rect(hx - 27, hy - 37, 53, 38, 0xf2dcaa);
    rect(hx + 26, hy - 37, 12, 36, 0xd0ac76);
    g.fillStyle(0x82432d);
    g.fillTriangle(hx - 36, hy - 36, hx, hy - 68, hx + 36, hy - 36);
    g.fillStyle(0xc6653c);
    g.fillTriangle(hx - 32, hy - 38, hx, hy - 65, hx + 32, hy - 38);
    for (let i = 0; i < 4; i++)
      rect(hx - 22 + i * 6, hy - 42 - i * 5, 43 - i * 11, 2, 0xe08a50);
    rect(hx + 17, hy - 64, 7, 21, 0x896c52);
    rect(hx + 16, hy - 65, 9, 3, 0xc8b797);
    rect(hx - 6, hy - 21, 13, 23, 0x805331);
    rect(hx - 4, hy - 19, 9, 20, 0x3c6d53);
    rect(hx + 2, hy - 10, 2, 2, 0xf4ce74);
    for (const x of [hx - 21, hx + 13]) {
      rect(x, hy - 28, 11, 13, 0x805331);
      rect(x + 2, hy - 26, 7, 9, 0x85bdc1);
      rect(x + 5, hy - 26, 1, 9, 0xf9e4b2);
      rect(x + 2, hy - 22, 7, 1, 0xf9e4b2);
      rect(x - 2, hy - 13, 15, 4, 0x805331);
      rect(x, hy - 15, 3, 3, p.flower);
      rect(x + 6, hy - 15, 3, 3, p.flower);
    }
    rect(hx - 12, hy + 2, 25, 4, 0xb28b58);
    rect(hx - 16, hy + 6, 33, 3, 0xd4b37b);
    // The first acre remains empty until the farming systems are added.
    const tileW = Math.min(34, (w - 30) / 8),
      tileH = tileW / 2;
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 7; col++) {
        const x = cx + ((col - row) * tileW) / 2,
          y = cy + ((col + row - 4) * tileH) / 2;
        diamond(x, y + 3, tileW - 1, tileH - 1, 0x6c492f);
        diamond(
          x,
          y,
          tileW - 2,
          tileH - 2,
          (row + col) % 2 ? p.soil : 0xa87349,
        );
        for (let line = 0; line < 3; line++) {
          rect(x - 5 + line * 4, y - 2 + line * 2, 5, 1, 0x805333);
        }
      }
    // Fence and small flowers frame the field, keeping plot silhouettes clear.
    for (let i = 0; i < 9; i++) {
      const x = cx - 136 + i * 18,
        y = cy + 12 + i * 9;
      rect(x, y - 10, 3, 16, 0x805331);
      rect(x, y - 11, 3, 3, 0xf2dfb6);
      if (i < 8) {
        g.lineStyle(2, 0xe4c592);
        g.lineBetween(x + 2, y - 5, x + 19, y + 4);
        g.lineBetween(x + 2, y + 1, x + 19, y + 10);
      }
    }
    for (let i = 0; i < 28; i++) {
      const x = cx + 126 + ((i * 17) % 42),
        y = cy - 24 + ((i * 23) % 100);
      rect(x, y, 2, 5, p.leaf);
      rect(x - 1, y - 1, 4, 3, i % 3 ? p.flower : 0xffe3a1);
    }
    tree(cx + 135, cy - 57, 1.2);
    tree(cx - 155, cy + 19);
  }
}
