import { createBuildingShadow } from "./building-shadow";
import {
  buildingArtwork,
  hitsBuildingArtwork,
  distinctStructures,
  distinctServices,
  distinctBuildingRects,
  distinctBuildingRect,
} from "./building-artwork";
import {
  treeFrames,
  productFrames,
  productPositions,
  treeFrame,
  treeStage,
} from "./tree-sprites";
import { cropFrames, seasonalCropFrames, cropArtwork } from "./crop-sprites";
import { project, footprint as renderFootprint, TILE_WIDTH } from "./layout";
import Phaser from "phaser";
import {
  drawBoundary,
  updateBoundaryWalkers,
  type BoundaryWalker,
} from "./boundary";
import { prepareLaneArtwork } from "./lane-artwork";
import { borderDetailRect } from "./border-artwork";
import { GroundLayer } from "./terrain";
import { Farmer, farmerFrames } from "./farmer";
import { farmerDepth, type BuildingOccluder } from "./farmer-depth";
import { farmerTaskForAction } from "./farmer-task";
import type { FarmAction } from "../micro/rules";
import type { MacroState } from "../macro/state";
import { initialMicroState, type MicroState } from "../micro/state";
import {
  buildings,
  serviceLocations,
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
  private buildingOccluders: BuildingOccluder[] = [];
  private ground?: Phaser.GameObjects.Graphics;
  private groundArt?: GroundLayer;
  private scenery?: Phaser.GameObjects.Container;
  private boundaryWalkers: BoundaryWalker[] = [];
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
  hitsBuilding(
    point: { x: number; y: number },
    lot: Cell & { width: number; height: number },
    frame: number,
    working = false,
    distinctFrame?: number,
  ) {
    const selectedFrame = distinctFrame ?? frame;
    const distinct = distinctFrame !== undefined;
    if (!hitsBuildingArtwork(point, lot, selectedFrame, projectCell, distinct))
      return false;
    const atlas = distinct
      ? "distinct-buildings"
      : working
        ? "farm-states"
        : this.buildingAtlas;
    const source = this.textures.getFrame(atlas, selectedFrame);
    if (!source) return false;
    const art = buildingArtwork(lot, selectedFrame, distinct);
    const top = projectCell(art);
    // Transparent roof corners must not steal clicks from neighboring plots.
    return (
      this.textures.getPixelAlpha(
        Math.floor(((point.x - top.x) / art.size) * source.cutWidth),
        Math.floor(((point.y - top.y) / art.size) * source.cutHeight),
        atlas,
        selectedFrame,
      ) > 32
    );
  }
  private drawBuildingShadow(
    art: { row: number; col: number; size: number },
    atlas: string,
    frame: number,
  ) {
    const key = `shadow-${atlas}-${frame}`;
    if (!this.textures.exists(key)) {
      const source = this.textures.getFrame(atlas, frame);
      const canvas = createBuildingShadow(
        source.source.image as HTMLImageElement,
        {
          x: source.cutX,
          y: source.cutY,
          width: source.cutWidth,
          height: source.cutHeight,
        },
      );
      this.textures.addCanvas(key, canvas);
    }
    const top = projectCell(art);
    this.scenery!.add(
      this.add
        .image(top.x, top.y, key)
        .setOrigin(0, 0)
        .setDisplaySize(art.size * 1.5, art.size * 1.25)
        .setAlpha(this.season === "winter" ? 0.24 : 0.2)
        .setDepth(-1),
    );
  }
  private get buildingAtlas() {
    return this.season === "fall" || this.season === "winter"
      ? `farm-${this.season}`
      : "farm-spring";
  }
  onLoadError?: () => void;
  onReady?: () => void;
  onProgress?: (value: number) => void;
  onLayout?: (targets: PlotTarget[]) => void;
  constructor() {
    super("farm");
  }
  preload() {
    this.load.on("loaderror", () => this.onLoadError?.());
    this.load.on("progress", (value: number) => this.onProgress?.(value));
    this.load.image("lane-source", "/art/lane-seasons.png");
    this.load.image("ground-materials", "/art/ground-materials.png");
    this.load.image("border-details", "/art/border-details-seasons.png");
    this.load.image("tree-apple", "/art/apple-stages.png");
    this.load.image("tree-oak", "/art/oak-stages.png");
    this.load.image("tree-products", "/art/tree-products.png");
    this.load.image("seasonal-crops", "/art/seasonal-crops.png");
    this.load.image("crop-stages", "/art/crop-stages.png");
    this.load.image("woodland", "/art/woodland-seasons.png");
    this.load.image(
      "woodland-variation",
      "/art/woodland-variation-seasons.png",
    );
    this.load.image("hedgerow", "/art/hedgerow-seasons.png");
    this.load.image("farmer", "/art/farmer-sprites.png");
    this.load.image("distinct-buildings", "/art/distinct-buildings.png");
    this.load.image("farm-states", "/art/farm-states.png");
    this.load.image("farm-spring", "/art/farm-atlas.png");
    this.load.image("farm-fall", "/art/farm-atlas-fall.png");
    this.load.image("farm-winter", "/art/farm-atlas-winter.png");
  }
  create() {
    prepareLaneArtwork(this);
    const details = this.textures.get("border-details");
    const detailSource = details.getSourceImage();
    for (let frame = 0; frame < 16; frame++) {
      const rect = borderDetailRect(
        frame,
        detailSource.width,
        detailSource.height,
      );
      details.add(frame, 0, rect.x, rect.y, rect.width, rect.height);
    }
    for (const kind of ["apple", "oak"] as const) {
      const texture = this.textures.get(`tree-${kind}`);
      for (const [index, [x, y, width, height]] of treeFrames[kind].entries())
        texture.add(index, 0, x, y, width, height);
      const [x, y, width, height] = productFrames[kind];
      this.textures.get("tree-products").add(kind, 0, x, y, width, height);
    }
    const farmer = this.textures.get("farmer");
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 6; col++)
        farmer.add(
          row * 6 + col,
          0,
          farmerFrames[row][col][0],
          farmerFrames[row][col][1],
          farmerFrames[row][col][2] - farmerFrames[row][col][0],
          farmerFrames[row][col][3] - farmerFrames[row][col][1],
        );
    const distinct = this.textures.get("distinct-buildings");
    const source = distinct.getSourceImage();
    for (let i = 0; i < distinctBuildingRects.length; i++) {
      const frame = distinctBuildingRect(i, source.width, source.height);
      distinct.add(i, 0, frame.x, frame.y, frame.width, frame.height);
    }
    this.harvestEffects = this.add.container().setDepth(100000);

    const cropTexture = this.textures.get("crop-stages");
    for (const [index, frame] of cropFrames.entries()) {
      cropTexture.add(index, 0, frame.x, frame.y, frame.width, frame.height);
    }
    const seasonalCrops = this.textures.get("seasonal-crops");
    for (const [index, frame] of seasonalCropFrames.entries())
      seasonalCrops.add(index, 0, frame.x, frame.y, frame.width, frame.height);
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
      // Overlapping wall segments can omit the left gutter containing autumn pixels.
      { x: 655, y: 771, width: 599, height: 393 },
    ].entries())
      hedges.add(i, 0, frame.x, frame.y, frame.width, frame.height);
    this.groundArt = new GroundLayer(this);
    this.ground = this.add.graphics();
    this.scenery = this.add.container();
    this.farmer = new Farmer(this);
    this.farmer.setWorld(this.farm, this.policy);
    this.draw();
    // Render textures lose their contents when a suspended GPU context returns.
    const restoreGround = () => this.draw(false);
    this.game.renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, restoreGround);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.renderer.off(
        Phaser.Renderer.Events.RESTORE_WEBGL,
        restoreGround,
      );
    });
    this.onReady?.();
  }
  update(_time: number, delta: number) {
    this.farmer?.update(delta, projectCell);
    updateBoundaryWalkers(this.boundaryWalkers, this.time.now);
    if (this.farmer) {
      this.farmer.view.setDepth(
        farmerDepth(this.farmer.view, this.buildingOccluders),
      );
      if (import.meta.env.DEV)
        this.game.canvas.dataset.farmerDepth = String(this.farmer.view.depth);
    }
    this.scenery?.sort("depth");
  }
  travelTo(
    target: Cell,
    width = 1,
    height = 1,
    adjacent = false,
    preference: "rear" | "front" = "front",
    onArrival?: () => void,
  ) {
    return (
      this.farmer?.travel(
        target,
        width,
        height,
        adjacent,
        preference,
        onArrival,
      ) ?? false
    );
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
    this.groundArt!.begin(this.season, this.view);
    if (this.farmer) scenery.remove(this.farmer.view);
    for (const tree of this.treeViews.values()) this.tweens.killTweensOf(tree);
    this.treeViews.clear();
    this.buildingOccluders = [];
    scenery.removeAll(true);
    if (this.farmer) scenery.add(this.farmer.view);
    this.cameras.main.setBackgroundColor(p.grass);
    const atlas = this.buildingAtlas;
    this.boundaryWalkers = drawBoundary(
      this,
      g,
      scenery,
      this.season,
      projectCell,
      this.view,
      this.groundArt!,
    );
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
        this.groundArt!.tile(
          { row, col },
          { x, y },
          index === undefined ? "grass" : "soil",
          cellAllowed({ row, col }, this.policy) ? undefined : 0x879777,
        );
        if (index === undefined) continue;
        const plot = this.farm.plots[index];
        if (!plot) continue;
        const art = cropArtwork(plot.crop, plot.growth);
        for (const [offset, depth] of [
          [-14, -2],
          [0, -7],
          [14, 3],
        ]) {
          scenery.add(
            this.add
              .image(x + offset, y + depth, art.texture, art.frame)
              .setOrigin(0.5, 0.95)
              .setScale(art.scale)
              .setDepth(y + depth),
          );
        }
      }
    // Phaser sorts by the depth below; equal depths retain placement order,
    // which the artwork hit test also uses.
    for (const s of this.farm.structures) {
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
      const distinctFrame = distinctStructures[s.kind];
      const art = buildingArtwork(
        { ...s, width: item.width, height: item.height },
        distinctFrame ?? item.frame,
        distinctFrame !== undefined,
      );
      const top = projectCell(art);
      const front = projectCell({
        row: s.row + item.height - 0.5,
        col: s.col + item.width - 0.5,
      });
      this.buildingOccluders.push({ ...top, size: art.size, front });
      const working = !!(s.pendingConstruction || s.pendingUpgrade);
      const stateAtlas = working && distinctFrame === undefined;
      const frame = item.frame;
      this.drawBuildingShadow(
        art,
        distinctFrame !== undefined
          ? "distinct-buildings"
          : stateAtlas
            ? "farm-states"
            : atlas,
        distinctFrame ?? frame,
      );
      scenery.add(
        this.add
          .image(
            top.x,
            top.y,
            distinctFrame !== undefined
              ? "distinct-buildings"
              : stateAtlas
                ? "farm-states"
                : atlas,
            distinctFrame ?? frame,
          )
          .setOrigin(0, 0)
          .setDisplaySize(art.size, art.size)
          .setAlpha(working && distinctFrame !== undefined ? 0.72 : 1)
          .setDepth(front.y),
      );
      if (working && distinctFrame !== undefined) {
        const scaffold = this.add.graphics().setDepth(front.y + 1);
        // Timber rails across the two front faces keep pending work visible without labels.
        const insetBase = renderFootprint({
          row: s.row - 0.42,
          col: s.col - 0.42,
          width: item.width - 0.16,
          depth: item.height - 0.16,
        }).map(worldPoint);
        const face = [insetBase[1], insetBase[2], insetBase[3]];
        for (const [width, color] of [
          [4, 0x68472c],
          [1, 0xd6ad70],
        ]) {
          scaffold.lineStyle(width, color);
          for (const point of face)
            scaffold.lineBetween(point.x, point.y, point.x, point.y - 30);
          for (let i = 0; i < 2; i++) {
            const a = face[i],
              b = face[i + 1];
            for (const height of [10, 27])
              scaffold.lineBetween(a.x, a.y - height, b.x, b.y - height);
            scaffold.lineBetween(a.x, a.y - 27, b.x, b.y - 10);
          }
        }
        scenery.add(scaffold);
      }
    }
    for (const service of serviceLocations(this.farm)) {
      const point = projectCell(service);
      if (publishLayout && service.row < 0)
        targets.push({
          ...service,
          x: point.x,
          y: point.y,
          width: 64,
          height: 32,
        });
      if (!visible(point.x, point.y)) continue;
      if (service.tent) {
        const tent = this.add.graphics().setDepth(point.y + 24);
        tent.fillStyle(0x59452f).fillEllipse(point.x, point.y + 18, 105, 34);
        tent
          .fillStyle(0xe9c58a)
          .fillTriangle(
            point.x - 48,
            point.y + 18,
            point.x,
            point.y - 52,
            point.x + 48,
            point.y + 18,
          );
        tent
          .fillStyle(0xb88850)
          .fillTriangle(
            point.x,
            point.y - 52,
            point.x + 48,
            point.y + 18,
            point.x + 13,
            point.y + 8,
          );
        tent
          .fillStyle(0x403e2a)
          .fillTriangle(
            point.x - 16,
            point.y + 18,
            point.x,
            point.y - 24,
            point.x + 16,
            point.y + 18,
          );
        tent
          .lineStyle(3, 0x785534)
          .lineBetween(point.x, point.y - 58, point.x, point.y - 45);
        scenery.add(tent);
        scenery.add(
          this.add
            .text(point.x, point.y + 28, service.name, {
              fontFamily: "Farm Pixel",
              fontSize: "14px",
              color: "#493621",
              backgroundColor: "#fff0ca",
              padding: { x: 7, y: 4 },
            })
            .setOrigin(0.5, 0)
            .setDepth(WORLD_HEIGHT + point.y),
        );
        continue;
      }
      const art = buildingArtwork(
        service,
        distinctServices[service.id] ?? service.frame,
        service.id !== "home",
      );
      this.drawBuildingShadow(
        art,
        service.id === "home" ? atlas : "distinct-buildings",
        distinctServices[service.id] ?? service.frame,
      );
      const top = projectCell(art);
      const front = projectCell({
        row: service.row + service.height - 0.5,
        col: service.col + service.width - 0.5,
      });
      this.buildingOccluders.push({ ...top, size: art.size, front });
      scenery.add(
        this.add
          .image(
            top.x,
            top.y,
            service.id === "home" ? atlas : "distinct-buildings",
            distinctServices[service.id] ?? service.frame,
          )
          .setOrigin(0, 0)
          .setDisplaySize(art.size, art.size)
          .setDepth(front.y),
      );
    }
    this.groundArt!.finish();
    if (publishLayout) this.onLayout?.(targets);
  }
}
