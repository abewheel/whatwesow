import Phaser from "phaser";
import type { MacroState } from "../macro/state";

import { crops, initialMicroState, type MicroState } from "../micro/state";
export type PlotTarget = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
const cells = Array.from({ length: 49 }, (_, i) => ({
  row: Math.floor(i / 7),
  col: i % 7,
})).sort(
  (a, b) =>
    Math.max(Math.abs(a.row - 3), Math.abs(a.col - 3)) -
      Math.max(Math.abs(b.row - 3), Math.abs(b.col - 3)) ||
    a.row - b.row ||
    a.col - b.col,
);

const seasons = {
  spring: {
    grass: 0x7ea75a,
    light: 0xa5c66d,
    shade: 0x648b46,
    soil: 0x9c663d,
    tint: 0xffffff,
  },
  summer: {
    grass: 0x7b9e45,
    light: 0xb0c66b,
    shade: 0x587c3b,
    soil: 0x996139,
    tint: 0xf6efce,
  },
  fall: {
    grass: 0xad9a55,
    light: 0xd0b971,
    shade: 0x8b8248,
    soil: 0x8e5b37,
    tint: 0xffffff,
  },
  winter: {
    grass: 0xc6d9cd,
    light: 0xe7eee0,
    shade: 0xa4bfb5,
    soil: 0x8d8070,
    tint: 0xffffff,
  },
};

export class FarmScene extends Phaser.Scene {
  private ground?: Phaser.GameObjects.Graphics;
  private scenery?: Phaser.GameObjects.Container;
  private season: MacroState["season"] = "spring";
  private farm = initialMicroState();
  onLayout?: (targets: PlotTarget[]) => void;
  constructor() {
    super("farm");
  }
  preload() {
    this.load.image("farm-spring", "/art/farm-atlas.png");
    this.load.image("farm-fall", "/art/farm-atlas-fall.png");
    this.load.image("farm-winter", "/art/farm-atlas-winter.png");
  }
  create() {
    for (const key of ["farm-spring", "farm-fall", "farm-winter"]) {
      const texture = this.textures.get(key);
      const source = texture.getSourceImage();
      for (let i = 0; i < 6; i++) {
        texture.add(
          i,
          0,
          ((i % 3) * source.width) / 3,
          (Math.floor(i / 3) * source.height) / 2,
          source.width / 3,
          source.height / 2,
        );
      }
    }
    this.ground = this.add.graphics();
    this.scenery = this.add.container();
    this.draw();
    this.scale.on("resize", this.draw, this);
  }
  setState(state: MacroState & MicroState) {
    this.season = state.season;
    this.farm = state;
    if (this.ground) this.draw();
  }
  private draw() {
    const g = this.ground!,
      scenery = this.scenery!;
    g.clear();
    scenery.removeAll(true);
    const p = seasons[this.season],
      winter = this.season === "winter";
    this.cameras.main.setBackgroundColor(p.grass);
    const scale = Math.min(this.scale.width / 680, this.scale.height / 440);
    g.setScale(scale);
    scenery.setScale(scale);
    const w = this.scale.width / scale,
      h = this.scale.height / scale;
    const cx = Math.round(w / 2),
      cy = Math.round(h / 2 + 10);
    const rect = (
      x: number,
      y: number,
      rw: number,
      rh: number,
      color: number,
    ) => {
      g.fillStyle(color);
      g.fillRect(Math.round(x), Math.round(y), Math.ceil(rw), Math.ceil(rh));
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
          new Phaser.Math.Vector2(x, y - th / 2),
          new Phaser.Math.Vector2(x + tw / 2, y),
          new Phaser.Math.Vector2(x, y + th / 2),
          new Phaser.Math.Vector2(x - tw / 2, y),
        ],
        true,
      );
    };
    // Stable texture, independent of save data and redraw count.
    const noise = (i: number, salt = 0) => {
      const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    for (let i = 0; i < 6500; i++) {
      const x = noise(i, 1) * w,
        y = noise(i, 2) * h;
      rect(x, y, 1 + noise(i, 3) * 2, 1, i % 4 === 0 ? p.shade : p.light);
      if (i % 13 === 0) {
        rect(x, y - 2, 1, 3, p.shade);
        rect(x + 2, y - 1, 1, 2, p.light);
      }
    }
    // Stream: dark banks, shallow edges, and broken reflected light.
    const riverX = (y: number) => cx + 267 + Math.sin(y / 58) * 13;
    for (let y = 0; y < h; y += 2) {
      const x = riverX(y);
      rect(x - 5, y, 49, 2, p.shade);
      rect(x - 2, y, 43, 2, 0xb2b68a);
      rect(x + 1, y, 37, 2, winter ? 0xa3cbd0 : 0x4d9299);
      rect(x + 5, y, 29, 2, winter ? 0xc1dee0 : 0x6bb3b0);
      if (y % 8 === 0)
        rect(x + 7 + noise(y) * 10, y, 8 + noise(y, 2) * 8, 1, 0xb9d9c4);
      if (y % 17 === 0) {
        rect(x - 4, y, 4, 3, 0x8b967e);
        rect(x - 3, y, 3, 1, 0xd1d1ac);
      }
    }
    // Stone walkway, with individually shaded uneven pavers.
    for (let i = -Math.ceil(w / 10); i < Math.ceil(w / 10); i++) {
      const x = cx + i * 10,
        y = cy - 83 + i * 5;
      diamond(x, y, 34, 18, 0x9a9874);
      for (let j = 0; j < 3; j++) {
        const sx = x + j * 7 - 8,
          sy = y + j * 3 - 5;
        rect(sx, sy, 8, 4, 0xaaa88b);
        rect(sx, sy, 7, 2, 0xd4d0ac);
        rect(sx + 1, sy + 4, 5, 1, 0x898d71);
      }
    }
    const atlasKey =
      this.season === "fall" || winter ? `farm-${this.season}` : "farm-spring";
    const sprite = (
      frame: number,
      x: number,
      y: number,
      size: number,
      tint = p.tint,
    ) => {
      const image = this.add
        .image(x, y, atlasKey, frame)
        .setDisplaySize(size, size)
        .setTint(tint);
      scenery.add(image);
      return image;
    };
    // Back row: varied canopies and two buildings with the same projection.
    for (let i = 0; i < Math.ceil(w / 61) + 1; i++)
      sprite(
        i % 4 === 1 ? 5 : 2,
        i * 64 - 12,
        48 + (i % 3) * 8,
        115 + (i % 2) * 20,
      );
    sprite(1, cx + 100, cy - 120, 190);
    sprite(0, cx - 109, cy - 121, 216);
    sprite(4, cx - 258, cy - 55, 137);
    const tileW = Math.min(34, (w - 30) / 8),
      tileH = tileW / 2;
    const targets: PlotTarget[] = [];
    // Draw back to front while retaining stable plot IDs as land expands.
    const ordered = cells
      .map((cell, index) => ({ ...cell, index }))
      .sort((a, b) => a.row + a.col - b.row - b.col);
    for (const { row, col, index } of ordered) {
      const x = cx + ((col - row) * tileW) / 2;
      const y = cy + ((col + row - 4) * tileH) / 2;
      const unlocked = index < this.farm.plots.length;
      diamond(x, y + 3, tileW - 1, tileH - 1, unlocked ? 0x6c492f : p.shade);
      diamond(x, y, tileW - 2, tileH - 2, unlocked ? p.soil : p.grass);
      if (!unlocked) continue;
      targets.push({
        index,
        x: x * scale,
        y: y * scale,
        width: tileW * scale,
        height: tileH * scale,
      });
      for (let line = 0; line < 3; line++)
        rect(x - 5 + line * 4, y - 2 + line * 2, 5, 1, 0x805333);
      const plot = this.farm.plots[index];
      if (plot) {
        const ready = plot.growth === crops[plot.crop].steps;
        for (const offset of [-7, 0, 7]) {
          const stem = 3 + plot.growth * 3;
          rect(x + offset, y - stem, 2, stem, 0x397244);
          rect(x + offset - 3, y - stem + 1, 4, 2, 0x73a448);
          if (ready) {
            rect(x + offset - 2, y - stem - 4, 6, 6, crops[plot.crop].color);
            rect(x + offset - 1, y - stem - 4, 2, 2, 0xffedaf);
          }
        }
        if (ready) {
          rect(x + 11, y - 14, 2, 5, 0xffedaf);
          rect(x + 9, y - 12, 6, 1, 0xffedaf);
        }
      }
    }
    this.onLayout?.(targets);
    // Picket fencing follows the near edge of the isometric field.
    for (let i = 0; i < 9; i++) {
      const x = cx - 137 + i * 18,
        y = cy + 12 + i * 9;
      if (i < 8)
        for (const dy of [-6, 0]) {
          g.lineStyle(3, 0x78583d);
          g.lineBetween(x + 2, y + dy + 2, x + 20, y + dy + 11);
          g.lineStyle(2, 0xf1dfb1);
          g.lineBetween(x + 2, y + dy, x + 20, y + dy + 9);
        }
      rect(x - 1, y - 13, 5, 19, 0x98764c);
      rect(x - 1, y - 13, 3, 17, 0xf2e3b9);
      rect(x, y - 15, 2, 2, 0xffefcb);
    }
    const flower = (x: number, y: number, color: number) => {
      rect(x, y - 3, 1, 5, 0x447345);
      rect(x - 2, y - 1, 2, 1, 0x5a8e43);
      rect(x - 2, y - 6, 5, 3, color);
      rect(x - 1, y - 7, 3, 5, color);
      rect(x, y - 5, 1, 1, 0xffdf8b);
    };
    // Dense cottage borders: flower clusters rather than evenly spaced dots.
    for (let i = 0; i < 105; i++) {
      const x = cx + 133 + noise(i, 5) * 65,
        y = cy - 23 + noise(i, 6) * 112;
      if (i % 4 === 0) diamond(x, y + 2, 10, 5, p.shade);
      flower(
        x,
        y,
        winter ? 0xe7eee0 : [0xf2b3bd, 0xe7d0ec, 0xffedba, 0xd98aa1][i % 4],
      );
    }
    sprite(3, cx + 225, cy + 28, 119);
    sprite(2, cx + 220, cy - 101, 142);
    sprite(5, cx - 238, cy + 33, 149);
    // Foreground details sit outside the central farm and HUD safe areas.
    for (let i = 0; i < Math.ceil(w / 100); i++)
      sprite(i % 3 === 0 ? 5 : 2, i * 107 + 22, h - 29 + (i % 2) * 13, 132);
    if (winter) {
      for (let i = 0; i < 120; i++)
        rect(noise(i, 8) * w, noise(i, 9) * h, 2, 1, 0xf4f6e9);
    }
  }
}
