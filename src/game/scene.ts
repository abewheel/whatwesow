import { isolateAtlas, gridFrames } from "./atlas-isolation";
import {
  hiveAnchor,
  hiveBounds,
  wildHiveTexture,
  woodenHiveTexture,
} from "./hive-artwork";
import { createBuildingShadow } from "./building-shadow";
import {
  animalArtwork,
  animalFrame,
  penFrameRects,
  livestockFrames,
  withinAnimalFront,
} from "./animal-layout";
import { drawAnimalPen } from "./animal-artwork";
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
import {
  cropFrames,
  seasonalCropFrames,
  cropArtwork,
  cropCondition,
} from "./crop-sprites";
import {
  project,
  footprint as renderFootprint,
  TILE_WIDTH,
  WORLD_TOP,
} from "./layout";

import Phaser from "phaser";
import {
  drawBoundary,
  updateBoundaryWalkers,
  type BoundaryWalker,
} from "./boundary";
import { prepareLaneArtwork } from "./lane-artwork";
import { borderDetailRect } from "./border-artwork";
import {
  GroundLayer,
  drawReservoir,
  groundTint,
  shoreSides,
  takenCell,
} from "./terrain";
import { Farmer, farmerFrames, femaleFarmerFrames } from "./farmer";
import { farmerDepth, type BuildingOccluder } from "./farmer-depth";
import { farmerTaskForAction } from "./farmer-task";
import type { FarmAction } from "../micro/rules";
import type { MacroState } from "../macro/state";
import { initialMicroState, type MicroState } from "../micro/state";
import {
  buildings,
  structureSize,
  serviceLocations,
  serviceOptions,
  councilOffice,
  isTree,
  isAnimal,
  cellKey,
  WORLD_SIZE,
  type Cell,
} from "../micro/world";
// Leave enough camera headroom to reach the top-corner hive below the phone HUD.
export const WORLD_WIDTH = WORLD_SIZE * 64 + 512,
  WORLD_HEIGHT = WORLD_SIZE * 32 + WORLD_TOP + 352;
// Preserve the shared logical projection; the scrollable view scales tiles to 64px.
const renderScale = 64 / TILE_WIDTH;
const tentWidth = 160;
const tentHeight = tentWidth * (2 / 3);
export const TENT_CENTER_OFFSET = tentHeight / 2 - 24;
const worldPoint = (p: { x: number; y: number }) => ({
  x: WORLD_WIDTH / 2 + p.x * renderScale,
  y: WORLD_TOP + p.y * renderScale,
});
export const projectCell = ({ row, col }: Cell) =>
  worldPoint(project(col, row));
export type PlotTarget = Cell & {
  x: number;
  y: number;
  width: number;
  height: number;
};
// Sealed buildings stand faded and grey.
const sealedLook = { alpha: 0.6, tint: 0x9a9a9a };
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
        Math.floor(((point.y - top.y) / art.height) * source.cutHeight),
        atlas,
        selectedFrame,
      ) > 32
    );
  }
  hitsHive(
    point: { x: number; y: number },
    lot: Cell & { width: number; height: number },
    wild = true,
  ) {
    const art = hiveBounds(projectCell(hiveAnchor(lot)), wild);
    const x = (point.x - art.x) / art.width;
    const y = (point.y - art.y) / art.height;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return false;
    const texture = wild
      ? wildHiveTexture(this.season)
      : woodenHiveTexture(this.season);
    const source = this.textures.getFrame(texture);
    return (
      this.textures.getPixelAlpha(
        Math.floor(x * source.cutWidth),
        Math.floor(y * source.cutHeight),
        texture,
      ) > 32
    );
  }
  private drawHive(
    lot: Cell & { width: number; height: number },
    wild: boolean,
    ready: boolean,
    working = false,
  ) {
    const point = projectCell(hiveAnchor(lot));
    const art = hiveBounds(point, wild);
    const texture = wild
      ? wildHiveTexture(this.season)
      : woodenHiveTexture(this.season);
    this.scenery!.add(
      this.add
        .image(art.x, art.y, texture)
        .setOrigin(0)
        .setDisplaySize(art.width, art.height)
        .setDepth(art.bottom)
        .setAlpha(working ? 0.55 : 1),
    );
    this.buildingOccluders.push({
      x: art.x,
      y: art.y,
      size: art.width,
      height: art.height,
      front: { x: point.x, y: art.bottom },
    });
    if (working) {
      const scaffold = this.add.graphics().setDepth(art.bottom + 1);
      scaffold.lineStyle(3, 0x89633d);
      for (const dx of [-32, 0, 32])
        scaffold.lineBetween(
          point.x + dx,
          art.bottom - 50,
          point.x + dx,
          art.bottom,
        );
      for (const dy of [16, 40])
        scaffold.lineBetween(
          point.x - 38,
          art.bottom - dy,
          point.x + 38,
          art.bottom - dy,
        );
      this.scenery!.add(scaffold);
    } else if (ready) {
      this.scenery!.add(
        this.add
          .text(
            point.x + (wild ? 66 : 0),
            point.y - (wild ? 85 : 87),
            wild ? "+12" : "Honey",
            {
              fontFamily: "Farm Pixel",
              fontSize: "16px",
              color: "#fff0ae",
              backgroundColor: "#65431e",
              padding: { x: 6, y: 3 },
            },
          )
          .setOrigin(0.5, 1)
          .setDepth(art.bottom + 1),
      );
    }
  }
  hitsTent(point: { x: number; y: number }, cell: Cell) {
    const anchor = projectCell(cell);
    const x = (point.x - anchor.x + tentWidth / 2) / tentWidth;
    const y = (point.y - anchor.y - 24 + tentHeight) / tentHeight;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return false;
    const source = this.textures.getFrame("starter-tent");
    return (
      this.textures.getPixelAlpha(
        Math.floor(x * source.cutWidth),
        Math.floor(y * source.cutHeight),
        "starter-tent",
      ) > 32
    );
  }
  private drawBuildingShadow(
    art: {
      row: number;
      col: number;
      size: number;
      height?: number;
    },
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
        .setDisplaySize(art.size * 1.5, (art.height ?? art.size) * 1.25)
        .setAlpha(this.season === "winter" ? 0.24 : 0.2)
        .setDepth(-1),
    );
  }
  hitsAnimal(
    point: { x: number; y: number },
    lot: Cell & {
      kind: import("../micro/world").AnimalKind;
      width: number;
      height: number;
    },
  ) {
    const art = animalArtwork(lot),
      top = projectCell(art);
    if (!withinAnimalFront(point, projectCell(lot), lot.width, lot.height))
      return false;
    const px = ((point.x - top.x) / art.size) * 418,
      py = ((point.y - top.y) / art.height) * 314;
    if (px < 0 || px >= 418 || py < 0 || py >= 314) return false;
    return (
      this.textures.getPixelAlpha(
        Math.floor(px),
        Math.floor(py),
        "animal-buildings",
        animalFrame(lot.kind, this.season),
      ) > 32
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

    this.load.image("animal-buildings", "/art/animal-buildings-seasons.png");
    this.load.image("livestock", "/art/livestock-sprites.png");

    for (const season of ["spring", "summer", "fall", "winter"])
      this.load.image(
        wildHiveTexture(season),
        `/art/wild-beehive-${season}.png`,
      );
    this.load.image("beehive-winter", "/art/beehive-winter.png");
    this.load.image("beehive", "/art/beehive.png");
    this.load.image("starter-tent", "/art/starter-tent.png");
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
    this.load.image("farmer-female", "/art/farmer-female-sprites.png");
    this.load.image("distinct-buildings", "/art/distinct-buildings.png");
    this.load.image("farm-states", "/art/farm-states.png");
    this.load.image("farm-spring", "/art/farm-atlas.png");
    this.load.image("farm-fall", "/art/farm-atlas-fall.png");
    this.load.image("farm-winter", "/art/farm-atlas-winter.png");
  }
  create() {
    // Normalize uneven generated gutters before rendering, shadows or hit tests.
    for (const [key, columns, rows] of [
      ["farm-spring", 3, 2],
      ["farm-fall", 3, 2],
      ["farm-winter", 3, 2],
      ["farm-states", 3, 2],
      ["animal-buildings", 3, 4],
      ["woodland", 2, 2],
      ["woodland-variation", 2, 2],
    ] as const) {
      const source = this.textures.get(key).getSourceImage();
      this.textures
        .get(key)
        .source[0].updateSource(
          isolateAtlas(
            source as HTMLImageElement,
            gridFrames(source.width, source.height, columns, rows),
          ),
        );
    }
    const buildingSource = this.textures
      .get("distinct-buildings")
      .getSourceImage();
    this.textures.get("distinct-buildings").source[0].updateSource(
      isolateAtlas(
        buildingSource as HTMLImageElement,
        distinctBuildingRects.map((_, i) =>
          distinctBuildingRect(i, buildingSource.width, buildingSource.height),
        ),
      ),
    );
    prepareLaneArtwork(this);

    for (const [key, rects] of [
      ["animal-buildings", penFrameRects],
      ["livestock", livestockFrames],
    ] as const)
      for (const [i, [x, y, width, height]] of rects.entries())
        this.textures.get(key).add(i, 0, x, y, width, height);

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
    for (const key of ["farmer", "farmer-female"]) {
      const farmer = this.textures.get(key);
      const frames = key === "farmer" ? farmerFrames : femaleFarmerFrames;
      for (let row = 0; row < 8; row++)
        for (let col = 0; col < 6; col++)
          farmer.add(
            row * 6 + col,
            0,
            frames[row][col][0],
            frames[row][col][1],
            frames[row][col][2] - frames[row][col][0],
            frames[row][col][3] - frames[row][col][1],
          );
    }
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
  stopFarmer() {
    this.farmer?.stop();
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
  setState(
    state: MacroState & MicroState & { farmerVariant?: "male" | "female" },
  ) {
    this.farm = state;
    if (this.farmer) this.farmer.variant = state.farmerVariant ?? "male";
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
    // Crisis marks drawn this frame, published below for development checks.
    const marks = { dry: 0, withered: 0, taken: 0, sealed: 0, council: "" };
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
          groundTint({ row, col }, this.policy),
        );
        // Land given up for the county's reservoir lies under water.
        if (takenCell({ row, col }, this.policy)) {
          marks.taken++;
          drawReservoir(
            g,
            { row, col },
            { x, y },
            this.season,
            shoreSides({ row, col }, this.policy),
          );
        }
        if (index === undefined) continue;
        const plot = this.farm.plots[index];
        if (!plot) continue;
        const art = cropArtwork(plot.crop, plot.growth),
          look = cropCondition(plot);
        if (plot.withered) marks.withered++;
        else if (plot.dry) marks.dry++;
        for (const [offset, depth] of [
          [-14, -2],
          [0, -7],
          [14, 3],
        ]) {
          const image = this.add
            .image(x + offset, y + depth, art.texture, art.frame)
            .setOrigin(0.5, 0.95)
            .setScale(art.scale * look.scale)
            .setDepth(y + depth);
          if (look.tint !== undefined)
            image
              .setTint(look.tint)
              .setTint2(look.shade)
              .setTintMode(Phaser.TintModes.MULTIPLY_TWO);
          scenery.add(image);
        }
      }
    // Phaser sorts by the depth below; equal depths retain placement order,
    // which the artwork hit test also uses.
    for (const s of this.farm.structures) {
      const item = { ...buildings[s.kind], ...structureSize(s) };
      const location = projectCell(s);
      if (!visible(location.x, location.y)) continue;
      // Sealed kinds give no benefits.
      const sealed = !!this.policy?.sealedBuildings?.includes(s.kind);
      if (sealed) marks.sealed++;
      if (s.kind === "beehive") {
        this.drawHive(
          { ...s, width: item.width, height: item.height },
          false,
          !!s.product,
          !!s.pendingConstruction,
        );
        continue;
      }
      if (isAnimal(s.kind)) {
        const art = animalArtwork({
          ...s,
          kind: s.kind,
          width: item.width,
          height: item.height,
        });
        const top = projectCell(art),
          front = projectCell({
            row: s.row + item.height - 0.5,
            col: s.col + item.width - 0.5,
          });
        this.buildingOccluders.push({
          ...top,
          y: top.y,
          size: art.size,
          height: art.height,
          front,
        });
        this.drawBuildingShadow(
          art,
          "animal-buildings",
          animalFrame(s.kind, this.season),
        );
        scenery.add(
          drawAnimalPen(
            this,
            { ...s, kind: s.kind },
            this.season,
            top.x,
            top.y,
            art.size,
            art.height,
            front.y,
          ),
        );
        continue;
      }
      if (isTree(s.kind)) {
        const { x, y } = location;
        const kind = s.kind as "apple" | "oak";
        const stage = treeStage(s);
        const tree = this.add
          .container(x, y)
          .setDepth(y)
          .setAlpha(sealed ? sealedLook.alpha : 1);
        const crown = this.add
          .image(0, 0, `tree-${kind}`, treeFrame(s, this.season))
          .setOrigin(0.5, 1)
          .setScale([0.13, 0.17, 0.18][stage]);
        if (sealed) crown.setTint(sealedLook.tint);
        tree.add(crown);
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
      this.buildingOccluders.push({
        ...top,
        y: top.y,
        size: art.size,
        height: art.height,
        front,
      });
      const working = !!(
        s.pendingConstruction ||
        s.pendingUpgrade ||
        s.pendingDemolition
      );
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
      const building = this.add
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
        .setDisplaySize(art.size, art.height)
        .setAlpha(
          sealed
            ? sealedLook.alpha
            : working && distinctFrame !== undefined
              ? 0.72
              : 1,
        )
        .setDepth(front.y);
      scenery.add(building);
      if (sealed) {
        building.setTint(sealedLook.tint);
        // Crossed planks show the seal without relying on colour.
        const middle = projectCell({
          row: s.row + (item.height - 1) / 2,
          col: s.col + (item.width - 1) / 2,
        });
        const x = middle.x,
          y = middle.y - art.size * 0.2,
          w = art.size * 0.2,
          h = art.size * 0.1;
        const planks = this.add.graphics().setDepth(front.y + 1);
        for (const [width, color] of [
          [7, 0x493621],
          [4, 0x9b6a3c],
        ])
          planks
            .lineStyle(width, color)
            .lineBetween(x - w, y - h, x + w, y + h)
            .lineBetween(x - w, y + h, x + w, y - h);
        scenery.add(planks);
      }
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
    for (const service of serviceLocations(
      this.farm,
      serviceOptions(this.policy),
    )) {
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
      if (service.id === "council") {
        marks.council = cellKey(service);
        this.drawCouncilOffice(service, point);
        continue;
      }
      if (service.id === "hive") {
        this.drawHive(service, true, this.farm.honeyReady !== false);
        continue;
      }
      if (service.tent) {
        const top = {
          x: point.x - tentWidth / 2,
          y: point.y + 24 - tentHeight,
        };
        scenery.add(
          this.add
            .image(point.x, point.y + 24, "starter-tent")
            .setOrigin(0.5, 1)
            .setDisplaySize(tentWidth, tentHeight)
            .setDepth(point.y + 24),
        );
        this.buildingOccluders.push({
          ...top,
          size: tentWidth,
          height: tentHeight,
          front: { x: point.x, y: point.y + 24 },
        });
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
      this.buildingOccluders.push({
        ...top,
        y: top.y,
        size: art.size,
        height: art.height,
        front,
      });
      scenery.add(
        this.add
          .image(
            top.x,
            top.y,
            service.id === "home" ? atlas : "distinct-buildings",
            distinctServices[service.id] ?? service.frame,
          )
          .setOrigin(0, 0)
          .setDisplaySize(art.size, art.height)
          .setDepth(front.y),
      );
    }
    this.groundArt!.finish();
    // Readable development evidence of crisis marks, like the farmer's data attributes.
    if (import.meta.env.DEV) {
      const data = this.game.canvas.dataset;
      data.sceneDry = String(marks.dry);
      data.sceneWithered = String(marks.withered);
      data.sceneTaken = String(marks.taken);
      data.sceneSealed = String(marks.sealed);
      data.sceneCouncil = marks.council;
    }
    if (publishLayout) this.onLayout?.(targets);
  }
  /** Placeholder civic office with its own silhouette: hipped slate roof, flag and notice board. */
  private drawCouncilOffice(
    lot: Cell & { width: number },
    point: { x: number; y: number },
  ) {
    const scenery = this.scenery!;
    // Drawn for a 2 × 2 lot and scaled to the square lot it stands on.
    const k = lot.width / 2;
    // Centre of the lot; the front corner sets depth like other services.
    const cx = point.x,
      cy = point.y + 16 * (lot.width - 1),
      front = projectCell({
        row: lot.row + lot.width - 0.5,
        col: lot.col + lot.width - 0.5,
      });
    // Flat x, y lists relative to the lot centre.
    const points = (flat: number[]) =>
      Array.from(
        { length: flat.length / 2 },
        (_, i) =>
          new Phaser.Math.Vector2(
            cx + flat[i * 2] * k,
            cy + flat[i * 2 + 1] * k,
          ),
      );
    const shadow = this.add.graphics().setDepth(-1);
    shadow
      .fillStyle(0x3b3424, this.season === "winter" ? 0.24 : 0.2)
      .fillPoints(points([-30, 4, 10, -16, 52, 4, 12, 24]), true);
    scenery.add(shadow);
    const office = this.add.graphics().setDepth(front.y);
    const shape = (color: number, ...flat: number[]) =>
      office
        .fillStyle(color)
        .fillPoints(points(flat), true)
        .lineStyle(2 * k, 0x493621)
        .strokePoints(points(flat), true);
    const snow = this.season === "winter";
    // Cream walls on a darker stone plinth; the lit face looks down-left.
    shape(0xf1dfb3, -34, 0, 0, 17, 0, -11, -34, -28);
    shape(0xcfb68a, 0, 17, 34, 0, 34, -28, 0, -11);
    shape(0xa59a83, -34, 0, 0, 17, 0, 13, -34, -4);
    shape(0x8c826e, 0, 17, 34, 0, 34, -4, 0, 13);
    // Green door under a small pediment, and two windows on the shaded face.
    shape(0x4e8547, -22, 6, -12, 11, -12, -5, -22, -10);
    shape(0xfff0ca, -25, -11, -9, -3, -17, -15);
    shape(0x68aeb9, 6, 4, 14, 0, 14, -9, 6, -5);
    shape(0x68aeb9, 20, -3, 28, -7, 28, -16, 20, -12);
    // A low hipped roof in slate, unlike the farm's terracotta.
    shape(snow ? 0xe9f0ec : 0x7f939b, -39, -28, 0, -8, 0, -52);
    shape(snow ? 0xc4d2cf : 0x5d6f78, 0, -8, 39, -28, 0, -52);
    // A flag on the ridge and a notice board beside the front-left corner.
    office
      .lineStyle(3 * k, 0x5c4630)
      .lineBetween(cx, cy - 52 * k, cx, cy - 82 * k);
    shape(0xc6653c, 1, -81, 19, -78, 19, -68, 1, -71);
    office.lineStyle(3 * k, 0x68472c);
    for (const x of [-44, -32])
      office.lineBetween(cx + x * k, cy + 10 * k, cx + x * k, cy - 6 * k);
    shape(0x805331, -48, -16, -28, -16, -28, -2, -48, -2);
    shape(0xfff0ca, -45, -13, -39, -13, -39, -5, -45, -5);
    shape(0xfff0ca, -37, -13, -31, -13, -31, -6, -37, -6);
    scenery.add(office);
    this.buildingOccluders.push({
      x: cx - 48 * k,
      y: cy - 84 * k,
      size: 100 * k,
      front,
    });
    scenery.add(
      this.add
        .text(cx, cy + 22 * k, councilOffice.name, {
          fontFamily: "Farm Pixel",
          fontSize: "14px",
          color: "#493621",
          backgroundColor: "#fff0ca",
          padding: { x: 7, y: 4 },
        })
        .setOrigin(0.5, 0)
        .setDepth(WORLD_HEIGHT + cy),
    );
  }
}
