import {
  treeFrames,
  productFrames,
  productPositions,
  treeFrame,
  treeStage,
} from "./tree-sprites";
import { cropFrames, cropStages } from "./crop-sprites";
import { project, footprint as renderFootprint, TILE_WIDTH } from "./layout";
import Phaser from "phaser";
import { drawBoundary } from "./boundary";
import { Farmer } from "./farmer";
import { farmerTaskForAction } from "./farmer-task";
import type { FarmAction } from "../micro/rules";
import type { MacroState } from "../macro/state";
import { initialMicroState, type MicroState } from "../micro/state";
import {
  buildings,
  isTree,
  cellAllowed,
  cellKey,
  WORLD_SIZE,
  type Cell,
} from "../micro/world";
export const WORLD_WIDTH = WORLD_SIZE * 64 + 512,
  WORLD_HEIGHT = WORLD_SIZE * 32 + 512;
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
  private farmer?: Farmer;
  private ground?: Phaser.GameObjects.Graphics;
  private scenery?: Phaser.GameObjects.Container;
  private treeViews = new Map<number, Phaser.GameObjects.Container>();
  private harvestEffects?: Phaser.GameObjects.Container;
  private farm = initialMicroState();
  private season: MacroState["season"] = "spring";
  private policy: MacroState["farmPolicy"];
  private view = { x: 0, y: 0, width: 800, height: 600, zoom: 1 };
  setViewport(x: number, y: number, width: number, height: number, zoom = 1) {
    this.view = { x, y, width, height, zoom };
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
    this.load.image("tree-apple", "/art/apple-stages.png");
    this.load.image("tree-oak", "/art/oak-stages.png");
    this.load.image("tree-products", "/art/tree-products.png");
    this.load.image("crop-stages", "/art/crop-stages.png");
    this.load.image("woodland", "/art/woodland-seasons.png");
    this.load.image(
      "woodland-variation",
      "/art/woodland-variation-seasons.png",
    );
    this.load.image("hedgerow", "/art/hedgerow-seasons.png");
    this.load.spritesheet("farmer", "/art/farmer-sprites.png", {
      frameWidth: 181,
      frameHeight: 181,
    });
    this.load.image("farm-states", "/art/farm-states.png");
    this.load.image("farm-spring", "/art/farm-atlas.png");
    this.load.image("farm-fall", "/art/farm-atlas-fall.png");
    this.load.image("farm-winter", "/art/farm-atlas-winter.png");
  }
  create() {
    for (const kind of ["apple", "oak"] as const) {
      const texture = this.textures.get(`tree-${kind}`);
      for (const [index, [x, y, width, height]] of treeFrames[kind].entries())
        texture.add(index, 0, x, y, width, height);
      const [x, y, width, height] = productFrames[kind];
      this.textures.get("tree-products").add(kind, 0, x, y, width, height);
    }
    this.harvestEffects = this.add.container().setDepth(100000);

    const cropTexture = this.textures.get("crop-stages");
    for (const [index, frame] of cropFrames.entries()) {
      cropTexture.add(index, 0, frame.x, frame.y, frame.width, frame.height);
    }
    for (const key of [
      "farm-spring",
      "farm-fall",
      "farm-winter",
      "farm-states",
    ]) {
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
    for (const key of ["woodland", "woodland-variation"]) {
      const forest = this.textures.get(key),
        source = forest.getSourceImage();
      for (let i = 0; i < 4; i++)
        forest.add(
          i,
          0,
          ((i % 2) * source.width) / 2,
          (Math.floor(i / 2) * source.height) / 2,
          source.width / 2,
          source.height / 2,
        );
    }
    // Explicit atlas rectangles keep complete wall ends and exclude row bleed.
    const hedges = this.textures.get("hedgerow");
    for (const [i, frame] of [
      { x: 0, y: 279, width: 627, height: 376 },
      { x: 627, y: 271, width: 627, height: 396 },
      { x: 0, y: 753, width: 627, height: 407 },
      { x: 627, y: 771, width: 627, height: 393 },
    ].entries())
      hedges.add(i, 0, frame.x, frame.y, frame.width, frame.height);
    this.ground = this.add.graphics();
    this.scenery = this.add.container();
    this.farmer = new Farmer(this);
    this.farmer.setWorld(this.farm, this.policy);
    this.draw();
  }
  update(_time: number, delta: number) {
    this.farmer?.update(delta, projectCell);
    this.scenery?.sort("depth");
  }
  resetFarmer() {
    this.farmer?.reset();
  }
  performAction(action: FarmAction, previous: MicroState) {
    const task = farmerTaskForAction(action, previous, this.farm, this.policy);
    if (task) this.farmer?.enqueue(task);
    if (action.type === "harvestTree") {
      const tree = previous.structures.find((s) => s.id === action.id);
      if (tree && isTree(tree.kind)) this.animateTreeHarvest(tree);
    }
  }
  private animateTreeHarvest(tree: MicroState["structures"][number]) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const view = this.treeViews.get(tree.id);
    const startX = view?.x ?? 0;
    if (view)
      this.tweens.add({
        targets: view,
        x: { from: startX - 2, to: startX + 2 },
        duration: 65,
        yoyo: true,
        repeat: 3,
        onComplete: () => view.setX(startX),
      });
    const { x, y } = projectCell(tree);
    const kind = tree.kind as "apple" | "oak";
    for (const [i, [dx, dy]] of productPositions[kind].entries()) {
      const fruit = this.add
        .image(x + dx, y + dy, "tree-products", kind)
        .setDisplaySize(kind === "apple" ? 11 : 9, 13);
      this.harvestEffects?.add(fruit);
      this.tweens.add({
        targets: fruit,
        x: x + dx * 1.5,
        y: y + 8,
        angle: i % 2 ? 75 : -75,
        duration: 380,
        delay: i * 35,
        ease: "Quad.easeIn",
        onComplete: () => {
          this.tweens.add({
            targets: fruit,
            y: y - 12,
            alpha: 0,
            scaleX: fruit.scaleX * 0.5,
            scaleY: fruit.scaleY * 0.5,
            duration: 260,
            ease: "Quad.easeOut",
            onComplete: () => fruit.destroy(),
          });
        },
      });
    }
  }
  setState(state: MacroState & MicroState) {
    this.farm = state;
    this.farmer?.setWorld(state, state.farmPolicy);
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
      x <= this.view.x + this.view.width / this.view.zoom + padding &&
      y >= this.view.y - padding &&
      y <= this.view.y + this.view.height / this.view.zoom + padding;
    this.cameras.main
      .setOrigin(0, 0)
      .setZoom(this.view.zoom)
      .setScroll(this.view.x, this.view.y);
    g.clear();
    if (this.farmer) scenery.remove(this.farmer.view);
    for (const tree of this.treeViews.values()) this.tweens.killTweensOf(tree);
    this.treeViews.clear();
    scenery.removeAll(true);
    if (this.farmer) scenery.add(this.farmer.view);
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
    drawBoundary(this, g, scenery, this.season, projectCell, this.view);
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
        for (const [offset, depth] of [
          [-14, -2],
          [0, -7],
          [14, 3],
        ]) {
          scenery.add(
            this.add
              .image(
                x + offset,
                y + depth,
                "crop-stages",
                cropStages[plot.crop][plot.growth],
              )
              .setOrigin(0.5, 0.95)
              .setScale(0.1)
              .setDepth(y + depth),
          );
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
      if (isTree(s.kind)) {
        const { x, y } = location;
        const kind = s.kind as "apple" | "oak";
        const stage = treeStage(s);
        const tree = this.add.container(x, y).setDepth(y);
        tree.add(
          this.add
            .image(0, 0, `tree-${kind}`, treeFrame(s, this.season))
            .setOrigin(0.5, 1)
            .setScale([0.13, 0.17, 0.18][stage]),
        );
        if (s.product)
          for (const [dx, dy] of productPositions[kind])
            tree.add(
              this.add
                .image(dx, dy, "tree-products", kind)
                .setDisplaySize(kind === "apple" ? 11 : 9, 13),
            );
        this.treeViews.set(s.id, tree);
        scenery.add(tree);
        scenery.add(
          this.add
            .text(
              x,
              y + 8,
              `${item.name}${s.product ? " · Harvest" : stage === 0 ? " · Sapling" : stage === 1 ? " · Growing" : ""}`,
              {
                fontSize: "11px",
                color: "#493621",
                backgroundColor: "#fff0ca",
                padding: { x: 3, y: 2 },
              },
            )
            .setOrigin(0.5, 0)
            .setDepth(y + 1),
        );
        continue;
      }
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
      const working = !!(s.pendingConstruction || s.pendingUpgrade);
      const stateAtlas = working;
      const frame = item.frame;
      scenery.add(
        this.add
          .image(
            back.x,
            front.y - 2,
            stateAtlas ? "farm-states" : atlas,
            stateAtlas ? frame : item.frame,
          )
          .setOrigin(0.5, 0.96)
          .setDisplaySize(
            s.pendingConstruction && isTree(s.kind) ? size * 0.8 : size,
            s.pendingConstruction && isTree(s.kind) ? size * 0.8 : size,
          )
          .setDepth(front.y),
      );
      if (isTree(s.kind)) continue;
      const label = this.add
        .text(
          back.x,
          front.y + 5,
          `${item.name} · ${working ? "⚒" : s.level}`,
          {
            fontFamily: "Georgia",
            fontSize: "13px",
            color: working ? "#77756c" : "#493621",
            backgroundColor: "#fff0ca",
            padding: { x: 5, y: 3 },
          },
        )
        .setOrigin(0.5, 0);
      label.setDepth(front.y + 1);
      scenery.add(label);
    }
    if (publishLayout) this.onLayout?.(targets);
  }
}
