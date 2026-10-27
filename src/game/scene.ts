import { project, footprint as renderFootprint, TILE_WIDTH } from "./layout";
import Phaser from "phaser";
import type { MacroState } from "../macro/state";
import { crops, initialMicroState, type MicroState } from "../micro/state";
import {
  buildings,
  cellAllowed,
  cellKey,
  WORLD_SIZE,
  type Cell,
} from "../micro/world";
export const WORLD_WIDTH = WORLD_SIZE * 64 + 256,
  WORLD_HEIGHT = WORLD_SIZE * 32 + 384;
// Preserve the shared logical projection; the scrollable view scales tiles to 64px.
const renderScale = 64 / TILE_WIDTH;
const worldPoint = (p: { x: number; y: number }) => ({
  x: WORLD_WIDTH / 2 + p.x * renderScale,
  y: 160 + p.y * renderScale,
});
export const projectCell = ({ row, col }: Cell) =>
  worldPoint(project(col, row));
export type PlotTarget = Cell & {
  x: number;
  y: number;
  width: number;
  height: number;
};
const palette = {
  spring: { grass: 0x7ea75a, light: 0xa5c66d, shade: 0x648b46, soil: 0x9c663d },
  summer: { grass: 0x7b9e45, light: 0xb0c66b, shade: 0x587c3b, soil: 0x996139 },
  fall: { grass: 0xad9a55, light: 0xd0b971, shade: 0x8b8248, soil: 0x8e5b37 },
  winter: { grass: 0xc6d9cd, light: 0xe7eee0, shade: 0xa4bfb5, soil: 0x8d8070 },
};
export class FarmScene extends Phaser.Scene {
  private ground?: Phaser.GameObjects.Graphics;
  private scenery?: Phaser.GameObjects.Container;
  private farm = initialMicroState();
  private season: MacroState["season"] = "spring";
  private policy: MacroState["farmPolicy"];
  private view = { x: 0, y: 0, width: 800, height: 600 };
  setViewport(x: number, y: number, width: number, height: number) {
    this.view = { x, y, width, height };
    if (this.ground) {
      this.cameras.main.setScroll(x, y);
      this.draw(false);
    }
  }
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
      const texture = this.textures.get(key),
        source = texture.getSourceImage();
      for (let i = 0; i < 6; i++)
        texture.add(
          i,
          0,
          ((i % 3) * source.width) / 3,
          (Math.floor(i / 3) * source.height) / 2,
          source.width / 3,
          source.height / 2,
        );
    }
    this.ground = this.add.graphics();
    this.scenery = this.add.container();
    this.draw();
  }
  setState(state: MacroState & MicroState) {
    this.farm = state;
    this.policy = state.farmPolicy;
    this.season = state.season;
    if (this.ground) this.draw();
  }
  private draw(publishLayout = true) {
    const g = this.ground!,
      scenery = this.scenery!,
      p = palette[this.season];
    const visible = (x: number, y: number, padding = 200) =>
      x >= this.view.x - padding &&
      x <= this.view.x + this.view.width + padding &&
      y >= this.view.y - padding &&
      y <= this.view.y + this.view.height + padding;
    this.cameras.main.setScroll(this.view.x, this.view.y);
    g.clear();
    scenery.removeAll(true);
    this.cameras.main.setBackgroundColor(p.grass);
    const diamond = (x: number, y: number, color: number) => {
      g.fillStyle(color);
      g.fillPoints(
        [
          { x, y: y - 16 },
          { x: x + 32, y },
          { x, y: y + 16 },
          { x: x - 32, y },
        ].map((p) => new Phaser.Math.Vector2(p.x, p.y)),
        true,
      );
      g.lineStyle(1, p.shade, 0.35);
      g.strokePoints(
        [
          { x, y: y - 16 },
          { x: x + 32, y },
          { x, y: y + 16 },
          { x: x - 32, y },
        ].map((p) => new Phaser.Math.Vector2(p.x, p.y)),
        true,
      );
    };
    const rect = (
      x: number,
      y: number,
      w: number,
      h: number,
      color: number,
    ) => {
      g.fillStyle(color);
      g.fillRect(x, y, w, h);
    };
    for (let i = 0; i < 9500; i++) {
      const x = (i * 73.17) % WORLD_WIDTH,
        y = (i * 47.73) % WORLD_HEIGHT;
      if (visible(x, y, 0))
        rect(Math.floor(x), Math.floor(y), 2, 1, i % 4 ? p.light : p.shade);
    }
    const atlas =
      this.season === "fall" || this.season === "winter"
        ? `farm-${this.season}`
        : "farm-spring";
    const image = (frame: number, x: number, y: number, size: number) =>
      visible(x, y)
        ? scenery.add(
            this.add
              .image(x, y, atlas, frame)
              .setOrigin(0.5, 1)
              .setDisplaySize(size, size),
          )
        : undefined;
    // Seasonal artwork frames the estate outside the buildable grid.
    for (let i = 0; i < WORLD_SIZE / 2; i++) {
      const a = projectCell({ row: -3, col: i * 2 }),
        b = projectCell({ row: i * 2, col: WORLD_SIZE + 3 });
      image(i % 3 === 0 ? 5 : 2, a.x, a.y, 135);
      image(i % 3 === 0 ? 5 : 2, b.x, b.y, 135);
      const c = projectCell({ row: WORLD_SIZE + 3, col: i * 2 }),
        d = projectCell({ row: i * 2, col: -3 });
      image(i % 3 === 0 ? 5 : 2, c.x, c.y, 135);
      image(i % 3 === 0 ? 5 : 2, d.x, d.y, 135);
    }
    const home = projectCell({ row: -2, col: 10 });
    image(0, home.x, home.y, 190);
    const plotMap = new Map(this.farm.plotCells.map((c, i) => [cellKey(c), i]));
    const targets: PlotTarget[] = [];
    for (let sum = 0; sum < WORLD_SIZE * 2; sum++)
      for (let row = 0; row < WORLD_SIZE; row++) {
        const col = sum - row;
        if (col < 0 || col >= WORLD_SIZE) continue;
        const { x, y } = projectCell({ row, col }),
          index = plotMap.get(cellKey({ row, col }));
        if (publishLayout)
          targets.push({ row, col, x, y, width: 64, height: 32 });
        if (!visible(x, y, 40)) continue;
        diamond(
          x,
          y,
          !cellAllowed({ row, col }, this.policy)
            ? p.shade
            : index === undefined
              ? p.grass
              : p.soil,
        );
        if (index === undefined) continue;
        for (let line = 0; line < 4; line++)
          rect(x - 14 + line * 7, y - 4 + line * 3, 10, 2, 0x794c2f);
        const plot = this.farm.plots[index];
        if (!plot) continue;
        const ready = plot.growth === crops[plot.crop].steps;
        for (const offset of [-12, 0, 12]) {
          const stem = 5 + plot.growth * 4;
          rect(x + offset, y - stem, 3, stem, 0x397244);
          rect(x + offset - 4, y - stem + 2, 7, 3, 0x73a448);
          if (ready) {
            rect(x + offset - 3, y - stem - 5, 8, 8, crops[plot.crop].color);
            rect(x + offset - 2, y - stem - 5, 3, 2, 0xffedaf);
          }
        }
      }
    for (const s of [...this.farm.structures].sort(
      (a, b) =>
        a.row +
        a.col +
        buildings[a.kind].width +
        buildings[a.kind].height -
        (b.row + b.col + buildings[b.kind].width + buildings[b.kind].height),
    )) {
      const item = buildings[s.kind];
      const location = projectCell(s);
      if (!visible(location.x, location.y)) continue;
      const base = renderFootprint({
        row: s.row - 0.5,
        col: s.col - 0.5,
        width: item.width,
        depth: item.height,
      }).map(worldPoint);
      if (item.width > 1) {
        const points = base.map((p) => new Phaser.Math.Vector2(p.x, p.y));
        g.fillStyle(this.season === "winter" ? 0xdce4d9 : 0xd1c5a0);
        g.fillPoints(points, true);
        g.lineStyle(1, 0x8d8063, 0.8);
        g.strokePoints(points, true);
      }
      const back = projectCell({
        row: s.row + (item.height - 1) / 2,
        col: s.col + (item.width - 1) / 2,
      });
      const front = projectCell({
        row: s.row + item.height - 0.5,
        col: s.col + item.width - 0.5,
      });
      const size =
        (((item.width + item.height) * 64) / 2) *
        (item.width === 1 ? 1.08 : 0.94);
      scenery.add(
        this.add
          .image(back.x, front.y - 2, atlas, item.frame)
          .setOrigin(0.5, 0.96)
          .setDisplaySize(size, size),
      );
      const label = this.add
        .text(back.x, front.y + 5, `${item.name} · ${s.level}`, {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#493621",
          backgroundColor: "#fff0ca",
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5, 0);
      scenery.add(label);
    }
    if (publishLayout) this.onLayout?.(targets);
  }
}
