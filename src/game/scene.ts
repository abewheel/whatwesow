import Phaser from "phaser";
import type { MacroState } from "../macro/state";
import {
  FARM_SIZE,
  TILE_WIDTH,
  TILE_HEIGHT,
  cropArea,
  gardenArea,
  farmObjects,
  footprint,
  project,
} from "./layout";

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
    const scale = Math.min(this.scale.width / 740, this.scale.height / 470);
    g.setScale(scale);
    scenery.setScale(scale);
    const w = this.scale.width / scale,
      h = this.scale.height / scale;
    const cx = Math.round(w / 2);
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
    const origin = { x: cx, y: h / 2 - 163 };
    const at = (col: number, row: number) => {
      const point = project(col, row);
      return { x: origin.x + point.x, y: origin.y + point.y };
    };
    const polygon = (
      points: { x: number; y: number }[],
      color: number,
      alpha = 1,
      line = false,
    ) => {
      const vertices = points.map(
        ({ x, y }) => new Phaser.Math.Vector2(origin.x + x, origin.y + y),
      );
      if (line) {
        g.lineStyle(1, color, alpha);
        g.strokePoints(vertices, true);
      } else {
        g.fillStyle(color, alpha);
        g.fillPoints(vertices, true);
      }
    };
    const farm = { col: 0, row: 0, width: FARM_SIZE, depth: FARM_SIZE };
    const corners = footprint(farm);
    polygon(
      corners.map(({ x, y }) => ({ x, y: y + 6 })),
      0x64804a,
    );
    polygon(corners, p.grass);
    // Every visible surface uses the same 2:1 tile axes.
    for (let row = 0; row < FARM_SIZE; row++)
      for (let col = 0; col < FARM_SIZE; col++) {
        const center = at(col + 0.5, row + 0.5);
        diamond(
          center.x,
          center.y,
          TILE_WIDTH,
          TILE_HEIGHT,
          (col + row) % 2 ? p.grass : p.light,
        );
        g.fillStyle(p.grass, 0.74);
        g.fillPoints(
          footprint({ col, row, width: 1, depth: 1 }).map(
            ({ x, y }) => new Phaser.Math.Vector2(x + origin.x, y + origin.y),
          ),
          true,
        );
        for (let dot = 0; dot < 7; dot++) {
          const point = at(
            col + 0.1 + noise(row * 126 + col * 7 + dot) * 0.8,
            row + 0.1 + noise(dot, col + row) * 0.8,
          );
          rect(point.x, point.y, 1, 1, dot % 3 ? p.light : p.shade);
        }
        polygon(
          footprint({ col, row, width: 1, depth: 1 }),
          p.shade,
          0.25,
          true,
        );
        if (col === 5 || row === 5) {
          diamond(
            center.x,
            center.y,
            TILE_WIDTH - 1,
            TILE_HEIGHT - 1,
            winter ? 0xd8ded0 : 0xc6bd95,
          );
          for (let stone = 0; stone < 4; stone++) {
            const pos = at(
              col + 0.15 + (stone % 2) * 0.4,
              row + 0.15 + Math.floor(stone / 2) * 0.4,
            );
            diamond(pos.x, pos.y, 13, 6, 0x939882);
            diamond(pos.x, pos.y - 1, 12, 5, winter ? 0xe2e5d7 : 0xe2d7b4);
          }
        }
      }
    const targets: PlotTarget[] = [];
    const ordered = cells
      .map((cell, index) => ({ ...cell, index }))
      .sort((a, b) => a.row + a.col - b.row - b.col);
    // Preserve plot IDs and expansion order while projecting into the property grid.
    for (const { col, row, index } of ordered) {
      if (index >= this.farm.plots.length) continue;
      const center = at(cropArea.col + col + 0.5, cropArea.row + row + 0.5);
      const x = center.x,
        y = center.y;
      diamond(x, y + 2, TILE_WIDTH - 2, TILE_HEIGHT - 2, 0x67482e);
      diamond(x, y, TILE_WIDTH - 2, TILE_HEIGHT - 2, p.soil);
      for (let line = 0; line < 4; line++) {
        const start = at(
          cropArea.col + col + 0.15 + line * 0.2,
          cropArea.row + row + 0.15,
        );
        const end = at(
          cropArea.col + col + 0.15 + line * 0.2,
          cropArea.row + row + 0.85,
        );
        g.lineStyle(1, winter ? 0xa49780 : 0xbd8752);
        g.lineBetween(start.x, start.y, end.x, end.y);
      }
      targets.push({
        index,
        x: x * scale,
        y: y * scale,
        width: TILE_WIDTH * scale,
        height: TILE_HEIGHT * scale,
      });
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
    // A garden is a decoration footprint too, with all flowers inside its cells.
    const garden = gardenArea;
    polygon(footprint(garden), winter ? 0xd4ded1 : 0x597d45);
    for (let i = 0; i < 45; i++) {
      const pos = at(
        garden.col + 0.15 + noise(i, 5) * 1.7,
        garden.row + 0.15 + noise(i, 6) * 2.7,
      );
      rect(pos.x, pos.y - 2, 1, 3, 0x447345);
      rect(
        pos.x - 1,
        pos.y - 4,
        3,
        2,
        winter ? 0xe7eee0 : [0xf2b3bd, 0xe7d0ec, 0xffedba][i % 3],
      );
    }
    polygon(footprint(garden), 0x8d7449, 1, true);
    const atlasKey =
      this.season === "fall" || winter ? `farm-${this.season}` : "farm-spring";
    // Draw bases first. Art is anchored to the front corner of each footprint.
    for (const object of farmObjects) {
      if (object.kind === "building") {
        const base = footprint(object);
        polygon(
          base.map(({ x, y }) => ({ x, y: y + 3 })),
          0x887653,
        );
        polygon(base, winter ? 0xdce4d9 : 0xd1c5a0);
        polygon(base, 0x8d8063, 0.8, true);
        for (let row = object.row; row < object.row + object.depth; row++)
          for (let col = object.col; col < object.col + object.width; col++)
            polygon(
              footprint({ col, row, width: 1, depth: 1 }),
              0xa39878,
              0.4,
              true,
            );
      }
    }
    for (const object of [...farmObjects].sort(
      (a, b) =>
        a.col + a.row + a.width + a.depth - (b.col + b.row + b.width + b.depth),
    )) {
      const back = at(
        object.col + object.width / 2,
        object.row + object.depth / 2,
      );
      const front = at(object.col + object.width, object.row + object.depth);
      const size =
        (((object.width + object.depth) * TILE_WIDTH) / 2) *
        (object.kind === "tree" ? 1.08 : 0.94);
      const image = this.add
        .image(back.x, front.y - 2, atlasKey, object.frame)
        .setOrigin(0.5, 0.96)
        .setDisplaySize(size, size)
        .setTint(p.tint);
      scenery.add(image);
    }
    // The property boundary makes the shared grid readable at a glance.
    polygon(corners, 0x526e3e, 0.65, true);
  }
}
