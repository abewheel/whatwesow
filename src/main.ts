import { HarvestFeedback } from "./game/harvest-feedback";
import { treeStatus } from "./micro/world";
import {
  canBuild,
  canPlant as cropUnlocked,
  hasOpportunity,
  opportunities,
  totalHarvests,
  upgradeRemaining,
  upgradeHint,
  type Opportunity,
} from "./micro/progression";
import {
  serviceMenus,
  isTree,
  constructionService,
  inspectionService,
  type ServiceId,
} from "./game/services";
import { WORLD_CELLS, WORLD_SIZE } from "./contracts/world";
import { turnNumber } from "./macro/state";
import {
  buildings,
  serviceLocations,
  canPlace,
  cellKey,
  footprint,
  upgradeCost,
  seasonalIncome,
  policyCost,
  policyProduction,
  type Cell,
  type BuildingKind,
} from "./micro/world";
import Phaser from "phaser";
import { icon } from "./game/icons";
import {
  FarmScene,
  projectCell,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from "./game/scene";
import {
  initialState,
  parseState,
  replaceDomain,
  advanceSeason,
  farmContext,
} from "./game/state";
import { openSaveStore } from "./storage/save";
import "./style.css";
import { actOnFarm, type FarmAction } from "./micro/rules";
import {
  crops,
  canPlant,
  expansionCost,
  harvestValue,
  soilCost,
  seedCost,
  type CropId,
} from "./micro/state";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<main><section class="farm-card" aria-label="Farm overview">
<div id="farm" tabindex="0" aria-label="Scrollable farm. Drag, use arrow keys, or scroll to explore."><div id="farm-world"><div id="farm-renderer"></div></div></div>
<header class="hud-top"><div class="farm-title"><span class="eyebrow">Your first acre</span><h1>What We Sow</h1></div><output id="season"></output><button id="open-menu" aria-haspopup="dialog" aria-label="Open farm menu">${icon("menu")}<span class="sr-only">Menu</span></button></header>
<div class="hud-bottom"><div class="field-note"><strong id="farm-message" role="status">Click a building to visit, or an empty plot to plant.</strong><span id="farm-summary" class="sr-only"></span><div id="farm-stats" aria-hidden="true"></div></div>
<section class="farm-tools" aria-label="Farming tools"><div class="work-tools mode-bar"><span id="seed-selection"></span><button id="farm-mode" hidden>Cancel placement</button><p id="placement-hint" hidden></p></div></section></div>
<div id="service-controls" hidden><div class="seed-shop"><div id="crop-options"></div><p id="crop-opportunity"></p></div><button id="next-season">End turn</button><p id="progression"></p><button id="work" hidden>Unload a seed delivery · +4 coins</button><button id="expand"></button><button id="improve"></button><button id="move-plot">Move a plot</button><details id="build-shop"><summary>Building plans</summary><details id="farm-news"><summary>Farm news</summary><div id="opportunity-notes"></div></details><div id="build-options"></div></details><p id="selected-building"></p><button id="upgrade-building" hidden></button><button id="move-building" hidden></button><button id="home-view">Center farm</button><span class="zoom-controls" role="group" aria-label="Farm zoom"><button id="zoom-out" aria-label="Zoom out">−</button><output id="zoom-level">100%</output><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-reset" aria-label="Reset zoom to 100 percent">100%</button></span><button id="pan-left" aria-label="Pan left">←</button><button id="pan-right" aria-label="Pan right">→</button><label>Row <input id="view-row" aria-label="View row" type="number" min="0" max="63" value="16"></label><label>Column <input id="view-col" aria-label="View column" type="number" min="0" max="63" value="16"></label><button id="go-to-cell">Go to land</button></div>
<dialog id="farm-menu" aria-labelledby="menu-title"><form method="dialog" class="menu-heading"><h2 id="menu-title">Your farm</h2><button aria-label="Close farm menu">✕</button></form><p class="menu-note">A little care, season after season.</p><div class="save-bar"><span id="save-status" role="status">Opening your farm…</span><div><button id="export">Export save</button><button id="import-trigger">Import save</button><input id="import" type="file" accept="application/json,.json" hidden /></div></div><p class="menu-help">Visit the nursery for seeds. End a season at the farmhouse to grow crops and complete construction.</p><button id="resume">Back to the farm</button></dialog>
</section></main>`;
const menu = document.querySelector<HTMLDialogElement>("#farm-menu")!;
document
  .querySelector("#open-menu")!
  .addEventListener("click", () => menu.showModal());
document
  .querySelector("#resume")!
  .addEventListener("click", () => menu.close());
document
  .querySelector("#import-trigger")!
  .addEventListener("click", () =>
    document.querySelector<HTMLInputElement>("#import")!.click(),
  );
// Keep only field work and view controls on the HUD. Services own their menus.
const servicePanel = document.createElement("section");
servicePanel.id = "service-panel";
servicePanel.hidden = true;
servicePanel.setAttribute("aria-labelledby", "service-title");
servicePanel.innerHTML = `<div class="service-heading"><div><span class="eyebrow">Around the farm</span><h2 id="service-title"></h2></div><button id="close-service" aria-label="Close building menu">×</button></div><p id="service-description"></p><div id="home-actions" hidden></div><div id="seed-actions" hidden></div><div id="builder-actions" hidden></div><div id="field-actions" hidden></div>`;
document.querySelector(".farm-card")!.append(servicePanel);
function moveControls(target: string, selectors: string[]) {
  for (const selector of selectors)
    document.querySelector(target)!.append(document.querySelector(selector)!);
}
moveControls("#home-actions", ["#next-season", "#progression"]);
moveControls("#seed-actions", [".seed-shop", "#work"]);
moveControls("#field-actions", ["#expand", "#improve", "#move-plot"]);
moveControls("#builder-actions", ["#build-shop"]);
document.querySelector<HTMLButtonElement>("#expand")!.dataset.build = "plot";
const saplings = document.createElement("div");
saplings.innerHTML = `<h3>Saplings & shade trees</h3><div id="sapling-options"></div>`;
document.querySelector("#seed-actions")!.append(saplings);
const inspection = document.createElement("section");
inspection.id = "structure-inspection";
inspection.innerHTML = `<h3 id="inspection-heading">Your buildings</h3><label for="structure-target" id="inspection-label">Choose a building</label><select id="structure-target"></select>`;
document.querySelector("#builder-actions")!.append(inspection);
moveControls("#structure-inspection", [
  "#selected-building",
  "#upgrade-building",
  "#move-building",
]);
document
  .querySelector("#structure-target")!
  .addEventListener("change", (event) => {
    const value = (event.target as HTMLSelectElement).value;
    inspectedId = value ? Number(value) : null;
    render();
  });
document.querySelector("#build-shop summary")!.textContent = "Building plans";

const cameraControls = document.createElement("details");
cameraControls.id = "camera-controls";
cameraControls.addEventListener("toggle", () => {
  if (cameraControls.open) closeService();
});
cameraControls.innerHTML = `<summary>View controls</summary><div class="camera-panel"></div>`;
document.querySelector(".work-tools")!.append(cameraControls);
moveControls(".camera-panel", [
  "#home-view",
  ".zoom-controls",
  "#pan-left",
  "#pan-right",
]);
for (const input of ["#view-row", "#view-col"])
  document
    .querySelector(".camera-panel")!
    .append(document.querySelector(input)!.closest("label")!);
moveControls(".camera-panel", ["#go-to-cell"]);
document.querySelector("#farm-mode")!.textContent = "Cancel placement";
function closeService() {
  if (!servicePanel.hidden) viewport.focus({ preventScroll: true });
  servicePanel.hidden = true;
}
let activeService: ServiceId | null = null;
function openService(service: ServiceId) {
  activeService = service;
  const inspected = state.structures.find((s) => s.id === inspectedId);
  if (
    (service === "fields" && inspected && !isTree(inspected.kind)) ||
    (service === "builder" && inspected && isTree(inspected.kind))
  )
    inspectedId = null;
  if (service === "fields")
    document.querySelector("#field-actions")!.append(inspection);
  else document.querySelector("#builder-actions")!.prepend(inspection);
  render();
  servicePanel.hidden = false;
  servicePanel.scrollTop = 0;
  const menu = serviceMenus[service];
  document.querySelector("#service-title")!.textContent = menu.name;
  document.querySelector("#service-description")!.textContent =
    menu.description;
  for (const [id, entry] of Object.entries(serviceMenus))
    document.getElementById(entry.container)!.hidden = id !== service;
  document
    .querySelector<HTMLButtonElement>("#close-service")!
    .focus({ preventScroll: true });
  if (service === "builder")
    document.querySelector<HTMLDetailsElement>("#build-shop")!.open = true;
}
function visit(
  service: ServiceId,
  destination: Cell & { width: number; height: number },
) {
  cameraControls.open = false;
  closeService();
  clearBuild();
  const request = ++navigationVersion;
  const menu = serviceMenus[service];
  const reached = scene.travelTo(
    destination,
    destination.width,
    destination.height,
    true,
    "front",
    () => {
      if (request !== navigationVersion) return;
      openService(service);
      message.textContent = menu.name;
    },
  );
  message.textContent = reached
    ? `Walking to ${menu.name}.`
    : `No walking path to ${menu.name}.`;
}
document
  .querySelector("#close-service")!
  .addEventListener("click", closeService);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    navigationVersion++;
    cameraControls.open = false;
    closeService();
    clearBuild();
  }
});
const status = document.querySelector<HTMLElement>("#save-status")!;
const scene = new FarmScene();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "farm-renderer",
  backgroundColor: "#83ad65",
  scene,
  scale: { mode: Phaser.Scale.NONE, width: 800, height: 600 },
  render: { antialias: false, pixelArt: true },
  audio: { noAudio: true },
});
let state = initialState();
const harvestFeedback = new HarvestFeedback(state.coins);
let selected: CropId = "turnip";
let saving = false;
let loadFailed = false;
let navigationVersion = 0;
let buildMode: BuildingKind | "plot" | null = null;
let movingId: number | null = null;
let movingPlotId: number | null = null;
let pickingPlot = false;
let inspectedId: number | null = null;
let centered = false;
const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
let zoomIndex = 3;
let zoom = zoomLevels[zoomIndex];
const viewport = document.querySelector<HTMLElement>("#farm")!;
const world = document.querySelector<HTMLElement>("#farm-world")!;
world.style.width = `${WORLD_WIDTH}px`;
world.style.height = `${WORLD_HEIGHT}px`;
const renderer = document.querySelector<HTMLElement>("#farm-renderer")!;
let viewportFrame = 0;
function updateViewport() {
  viewportFrame = 0;
  const width = viewport.clientWidth,
    height = viewport.clientHeight;
  renderer.style.width = `${width}px`;
  renderer.style.height = `${height}px`;
  if (game.scale.width !== width || game.scale.height !== height)
    game.scale.resize(width, height);
  scene.setViewport(
    viewport.scrollLeft / zoom,
    viewport.scrollTop / zoom,
    width,
    height,
    zoom,
  );
}
viewport.addEventListener("scroll", () => {
  if (!viewportFrame) viewportFrame = requestAnimationFrame(updateViewport);
});
new ResizeObserver(updateViewport).observe(viewport);
const cellButtons = new Map<string, HTMLButtonElement>();
function setZoom(index: number) {
  const nextIndex = Math.max(0, Math.min(zoomLevels.length - 1, index));
  if (nextIndex === zoomIndex) return;
  const center = {
    x: (viewport.scrollLeft + viewport.clientWidth / 2) / zoom,
    y: (viewport.scrollTop + viewport.clientHeight / 2) / zoom,
  };
  zoomIndex = nextIndex;
  zoom = zoomLevels[zoomIndex];
  drag = null;
  world.style.width = `${WORLD_WIDTH * zoom}px`;
  world.style.height = `${WORLD_HEIGHT * zoom}px`;
  for (const [key, button] of cellButtons) {
    const [row, col] = key.split(",").map(Number),
      p = projectCell({ row, col });
    Object.assign(button.style, {
      left: `${p.x * zoom}px`,
      top: `${p.y * zoom}px`,
      width: `${64 * zoom}px`,
      height: `${32 * zoom}px`,
    });
  }
  viewport.scrollLeft = center.x * zoom - viewport.clientWidth / 2;
  viewport.scrollTop = center.y * zoom - viewport.clientHeight / 2;
  document.querySelector("#zoom-level")!.textContent = `${zoom * 100}%`;
  document.querySelector<HTMLButtonElement>("#zoom-out")!.disabled =
    zoomIndex === 0;
  document.querySelector<HTMLButtonElement>("#zoom-in")!.disabled =
    zoomIndex === zoomLevels.length - 1;
  if (hoveredCell) showPreview(hoveredCell);
  updateViewport();
}
document
  .querySelector("#zoom-out")!
  .addEventListener("click", () => setZoom(zoomIndex - 1));
document
  .querySelector("#zoom-in")!
  .addEventListener("click", () => setZoom(zoomIndex + 1));
document
  .querySelector("#zoom-reset")!
  .addEventListener("click", () => setZoom(3));
let hoveredCell: Cell | null = null;
const preview = document.createElement("div");
preview.id = "placement-preview";
preview.hidden = true;
world.append(preview);
const buildingTooltip = document.createElement("div");
buildingTooltip.id = "building-tooltip";
buildingTooltip.setAttribute("role", "tooltip");
buildingTooltip.hidden = true;
world.append(buildingTooltip);
world.addEventListener("pointerleave", () => {
  hoveredCell = null;
  preview.hidden = true;
  buildingTooltip.hidden = true;
});
document.querySelector("#go-to-cell")!.addEventListener("click", () => {
  const row = Number(
      document.querySelector<HTMLInputElement>("#view-row")!.value,
    ),
    col = Number(document.querySelector<HTMLInputElement>("#view-col")!.value);
  if (
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    row < 0 ||
    col < 0 ||
    row >= WORLD_SIZE ||
    col >= WORLD_SIZE
  ) {
    document.querySelector<HTMLElement>("#placement-hint")!.hidden = false;
    document.querySelector("#placement-hint")!.textContent =
      "Choose row and column 0–63.";
    return;
  }
  const p = projectCell({ row, col });
  viewport.scrollLeft = p.x * zoom - viewport.clientWidth / 2;
  viewport.scrollTop = p.y * zoom - viewport.clientHeight / 2;
});
function centerFarm() {
  const p = projectCell({ row: 16, col: 16 });
  viewport.scrollLeft = p.x * zoom - viewport.clientWidth / 2;
  viewport.scrollTop = p.y * zoom - viewport.clientHeight / 2;
}
document.querySelector("#home-view")!.addEventListener("click", centerFarm);
document.querySelector("#pan-left")!.addEventListener("click", () => {
  viewport.scrollLeft -= 300;
});
document.querySelector("#pan-right")!.addEventListener("click", () => {
  viewport.scrollLeft += 300;
});
viewport.addEventListener("keydown", (event) => {
  const delta: Record<string, [number, number]> = {
    ArrowLeft: [-100, 0],
    ArrowRight: [100, 0],
    ArrowUp: [0, -100],
    ArrowDown: [0, 100],
  };
  if (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    (event.key === "+" ||
      event.key === "=" ||
      event.key === "-" ||
      event.key === "0")
  ) {
    event.preventDefault();
    setZoom(event.key === "0" ? 3 : zoomIndex + (event.key === "-" ? -1 : 1));
    return;
  }
  if (delta[event.key]) {
    event.preventDefault();
    viewport.scrollLeft += delta[event.key][0];
    viewport.scrollTop += delta[event.key][1];
  }
});
let drag: {
  x: number;
  y: number;
  left: number;
  top: number;
  active: boolean;
} | null = null;
let suppressClick = false;
viewport.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse" || e.button !== 0) return;
  suppressClick = false;
  drag = {
    x: e.clientX,
    y: e.clientY,
    left: viewport.scrollLeft,
    top: viewport.scrollTop,
    active: false,
  };
});
viewport.addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 6) {
    drag.active = true;
    suppressClick = true;
    viewport.setPointerCapture(e.pointerId);
    viewport.scrollLeft = drag.left - (e.clientX - drag.x);
    viewport.scrollTop = drag.top - (e.clientY - drag.y);
  }
});
viewport.addEventListener("pointerup", () => {
  drag = null;
});
viewport.addEventListener("pointercancel", () => {
  drag = null;
});
viewport.addEventListener(
  "click",
  (e) => {
    if (suppressClick) {
      e.preventDefault();
      e.stopImmediatePropagation();
      suppressClick = false;
      return;
    }
    if (
      !e.detail ||
      buildMode ||
      movingId !== null ||
      movingPlotId !== null ||
      pickingPlot
    )
      return;
    const bounds = viewport.getBoundingClientRect();
    const x = (e.clientX - bounds.left + viewport.scrollLeft) / zoom;
    const y = (e.clientY - bounds.top + viewport.scrollTop) / zoom;
    // Match the visible artwork as well as its keyboard-accessible ground tiles.
    const service = serviceLocations(state).find((s) => {
      const p = projectCell(s);
      return Math.abs(x - p.x) < 45 && y > p.y - 75 && y < p.y + 24;
    });
    const building = [...state.structures].reverse().find((s) => {
      const item = buildings[s.kind];
      const back = projectCell({
        row: s.row + (item.height - 1) / 2,
        col: s.col + (item.width - 1) / 2,
      });
      const front = projectCell({
        row: s.row + item.height - 0.5,
        col: s.col + item.width - 0.5,
      });
      const size =
        (item.width + item.height) * 32 * (item.width === 1 ? 1.08 : 0.94);
      return (
        Math.abs(x - back.x) < size * 0.32 &&
        y > front.y - size * 0.8 &&
        y < front.y - 2
      );
    });
    if (service || building) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (service) visit(service.id, service);
      else inspectBuilding(building!.id);
    }
  },
  true,
);
function inspectBuilding(id: number) {
  const building = state.structures.find((s) => s.id === id);
  if (!building) return;
  if (isTree(building.kind) && Boolean(building.product)) {
    closeService();
    const request = ++navigationVersion;
    const item = buildings[building.kind];
    const reached = scene.travelTo(
      building,
      item.width,
      item.height,
      true,
      "rear",
      () => {
        if (request === navigationVersion)
          void act({ type: "harvestTree", id });
      },
    );
    message.textContent = reached
      ? "Walking to harvest this tree."
      : "No walking path to this tree.";
    return;
  }
  inspectedId = id;
  visit(inspectionService(building.kind), {
    ...building,
    width: buildings[building.kind].width,
    height: buildings[building.kind].height,
  });
}
function clearBuild() {
  buildMode = null;
  movingId = null;
  movingPlotId = null;
  pickingPlot = false;
  preview.hidden = true;
  buildingTooltip.hidden = true;
  document.querySelector("#placement-hint")!.textContent =
    "Drag to explore, click ground to walk, or click a building to visit.";
  render();
}
document.querySelector("#farm-mode")!.addEventListener("click", clearBuild);
function selectBuild(kind: BuildingKind | "plot") {
  closeService();
  buildMode = kind;
  movingId = null;
  movingPlotId = null;
  pickingPlot = false;
  preview.hidden = true;
  buildingTooltip.hidden = true;
  render();
  document.querySelector<HTMLDetailsElement>("#build-shop")!.open = false;
  document.querySelector("#placement-hint")!.textContent =
    `Place ${kind === "plot" ? "a plot" : buildings[kind].name}: choose open land. Green fits; red is blocked. Escape or Cancel placement cancels.`;
}
for (const kind of Object.keys(buildings) as BuildingKind[]) {
  const button = document.createElement("button");
  button.dataset.build = kind;
  button.addEventListener("click", () => selectBuild(kind));
  document
    .querySelector(
      constructionService(kind) === "seeds"
        ? "#sapling-options"
        : "#build-options",
    )!
    .append(button);
}

const message = document.querySelector<HTMLElement>("#farm-message")!;
const cropOptions = document.querySelector<HTMLElement>("#crop-options")!;
for (const [id, crop] of Object.entries(crops)) {
  const button = document.createElement("button");
  button.dataset.crop = id;
  button.innerHTML = `${icon(id as CropId)}<strong>${crop.name}</strong><span class="seed-price" aria-hidden="true">${icon("coin")}${crop.seed}</span><span class="control-detail"></span>`;
  button.addEventListener("click", () => {
    buildMode = null;
    movingId = null;
    movingPlotId = null;
    pickingPlot = false;
    preview.hidden = true;
    buildingTooltip.hidden = true;
    selected = id as CropId;
    closeService();
    render();
    message.textContent = `${crop.name} · ${crop.steps} season${crop.steps === 1 ? "" : "s"} to grow · Plant ${crop.plantingSeasons.join(" / ")} · Harvest ${policyProduction(harvestValue(state, id as CropId), state.farmPolicy ?? {})} coins.`;
  });
  cropOptions.append(button);
}
let farmQueue: Promise<void> = Promise.resolve();
function act(action: FarmAction | { type: "season" }) {
  const requestedNavigation = navigationVersion;
  farmQueue = farmQueue.then(async () => {
    try {
      const previous = state;
      const result =
        action.type === "season"
          ? advanceSeason(state)
          : actOnFarm(state, action, farmContext(state));
      await apply(
        action.type === "season"
          ? (result.state as typeof state)
          : replaceDomain(state, "micro", result.state),
        false,
        false,
        action.type === "harvest" || action.type === "harvestTree",
      );
      if (action.type !== "season" && requestedNavigation === navigationVersion)
        scene.performAction(action, previous);
      if (action.type === "harvest" || action.type === "harvestTree") {
        const cell =
          action.type === "harvest"
            ? previous.plotCells[action.plot]
            : previous.structures.find((s) => s.id === action.id);
        const tile =
          cell && cellButtons.get(cellKey(cell))?.getBoundingClientRect();
        if (tile && state.coins > previous.coins)
          harvestFeedback.award(
            { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 },
            state.coins - previous.coins,
          );
      }
      message.textContent = result.message;
      if (action.type === "move" || action.type === "movePlot") {
        movingId = null;
        movingPlotId = null;
        pickingPlot = false;
        preview.hidden = true;
        buildingTooltip.hidden = true;
        render();
      }
    } catch (error) {
      message.textContent =
        error instanceof Error ? error.message : "Could not work the farm.";
    }
  });
  return farmQueue;
}
scene.onLayout = (targets) => {
  const keys = new Set(targets.map(cellKey));
  for (const [key, button] of cellButtons)
    if (!keys.has(key)) {
      button.remove();
      cellButtons.delete(key);
    }
  const services = serviceLocations(state);
  const plotMap = new Map(state.plotCells.map((c, i) => [cellKey(c), i]));
  const structureMap = new Map(
    state.structures.flatMap((s) =>
      footprint(s, buildings[s.kind].width, buildings[s.kind].height).map(
        (c) => [cellKey(c), s] as const,
      ),
    ),
  );
  for (const target of targets) {
    const key = cellKey(target);
    let button = cellButtons.get(key);
    if (!button) {
      button = document.createElement("button");
      button.className = "plot-hit";
      button.dataset.cell = key;
      button.addEventListener("click", () => {
        cameraControls.open = false;
        const cell = { row: target.row, col: target.col };
        if (movingPlotId !== null) {
          void act({ type: "movePlot", id: movingPlotId, cell });
          return;
        }
        if (pickingPlot) {
          const i = state.plotCells.findIndex((c) => cellKey(c) === key);
          if (i >= 0) {
            movingPlotId = state.plotIds[i];
            pickingPlot = false;
            document.querySelector("#placement-hint")!.textContent =
              "Choose open land to move this plot and its crop.";
          }
          return;
        }
        if (movingId !== null) {
          void act({ type: "move", id: movingId, cell });
          return;
        }
        if (buildMode) {
          void act(
            buildMode === "plot"
              ? { type: "expand", cell }
              : { type: "build", kind: buildMode, cell },
          );
          return;
        }
        const service = serviceLocations(state).find((s) =>
          footprint(s, s.width, s.height).some((c) => cellKey(c) === key),
        );
        if (service) {
          visit(service.id, service);
          return;
        }
        const index = state.plotCells.findIndex((c) => cellKey(c) === key);
        if (index >= 0) {
          closeService();
          const request = ++navigationVersion;
          const plotId = state.plotIds[index],
            crop = selected;
          const actionType = state.plots[index] ? "harvest" : "plant";
          const reached = scene.travelTo(cell, 1, 1, true, "rear", () => {
            if (request !== navigationVersion) return;
            const currentIndex = state.plotIds.indexOf(plotId);
            if (
              currentIndex < 0 ||
              cellKey(state.plotCells[currentIndex]) !== key
            )
              return;
            void act(
              actionType === "harvest"
                ? { type: "harvest", plot: currentIndex }
                : { type: "plant", plot: currentIndex, crop },
            );
          });
          message.textContent = reached
            ? `Walking to ${actionType === "plant" ? "plant" : "harvest"} this plot.`
            : "No walking path to this plot.";
          return;
        }
        const building = state.structures.find((s) =>
          footprint(s, buildings[s.kind].width, buildings[s.kind].height).some(
            (c) => cellKey(c) === key,
          ),
        );
        if (building) {
          inspectBuilding(building.id);
          return;
        }
        closeService();
        navigationVersion++;
        const walking = scene.travelTo(cell);
        message.textContent = walking
          ? "Walking to that spot."
          : "That tile cannot be reached.";
      });
      button.addEventListener("pointerenter", () => showPreview(target));
      button.addEventListener("focus", () => showPreview(target));
      Object.assign(button.style, {
        left: `${target.x * zoom}px`,
        top: `${target.y * zoom}px`,
        width: `${64 * zoom}px`,
        height: `${32 * zoom}px`,
      });
      world.append(button);
      cellButtons.set(key, button);
    }
    const index = plotMap.get(key),
      structure = structureMap.get(key);
    if (
      structure &&
      target.row === structure.row &&
      target.col === structure.col
    )
      button.dataset.structure = String(structure.id);
    else delete button.dataset.structure;
    if (index !== undefined) button.dataset.plot = String(index);
    else delete button.dataset.plot;
    const service = services.find((s) =>
      footprint(s, s.width, s.height).some((c) => cellKey(c) === key),
    );
    if (service && target.row === service.row && target.col === service.col)
      button.dataset.service = service.id;
    else delete button.dataset.service;
    button.toggleAttribute("data-building", Boolean(structure || service));
    const plot = index === undefined ? null : state.plots[index];
    const label =
      index !== undefined
        ? `Plot ${index + 1}: ${!plot ? "empty" : `${crops[plot.crop].name}, ${plot.growth === crops[plot.crop].steps ? "ready to harvest" : `growing ${plot.growth}/${crops[plot.crop].steps}`}`}`
        : structure
          ? `${buildings[structure.kind].name} ${structure.id}, ${isTree(structure.kind) ? treeStatus(structure) : structure.pendingConstruction ? "under construction, ready next season" : `level ${structure.level}`}`
          : service
            ? `Visit ${service.name}`
            : `Land ${target.row},${target.col}`;
    if (button.getAttribute("aria-label") !== label) {
      button.setAttribute("aria-label", label);
      // Accessible names remain available without visible building labels.
      button.removeAttribute("title");
    }
  }
  if (hoveredCell) showPreview(hoveredCell);
  if (!centered) {
    centered = true;
    centerFarm();
  }
};
function showPreview(cell: Cell) {
  hoveredCell = cell;
  buildingTooltip.hidden = true;
  const moving = state.structures.find((s) => s.id === movingId);
  const kind = moving?.kind ?? (movingPlotId !== null ? "plot" : buildMode);
  const hovered = !kind
    ? state.structures.find((s) =>
        footprint(s, buildings[s.kind].width, buildings[s.kind].height).some(
          (c) => cellKey(c) === cellKey(cell),
        ),
      )
    : undefined;
  const service =
    !kind && !hovered
      ? serviceLocations(state).find((s) =>
          footprint(s, s.width, s.height).some(
            (c) => cellKey(c) === cellKey(cell),
          ),
        )
      : undefined;
  if (!kind && !hovered && !service) {
    preview.hidden = true;
    buildingTooltip.hidden = true;
    return;
  }
  const item =
    kind === "plot"
      ? { width: 1, height: 1 }
      : kind
        ? buildings[kind]
        : hovered
          ? buildings[hovered.kind]
          : service!;
  const anchor = kind ? cell : (hovered ?? service)!;
  preview.dataset.mode = kind ? "placement" : "hover";
  let layout = moving
    ? {
        ...state,
        structures: state.structures.filter((s) => s.id !== moving.id),
      }
    : state;
  if (movingPlotId !== null)
    layout = {
      ...layout,
      plotCells: state.plotCells.filter(
        (_, i) => state.plotIds[i] !== movingPlotId,
      ),
    };
  const fits = canPlace(
      layout,
      cell,
      item.width,
      item.height,
      state.farmPolicy,
    ),
    pos = projectCell(anchor);
  preview.hidden = false;
  preview.dataset.valid = String(!kind || fits);
  const total = item.width + item.height;
  if (!kind && (hovered || service)) {
    buildingTooltip.textContent = hovered
      ? buildings[hovered.kind].name
      : service!.name;
    buildingTooltip.hidden = false;
    Object.assign(buildingTooltip.style, {
      left: `${(pos.x + (item.width - item.height) * 16) * zoom}px`,
      top: `${(pos.y + (total - 1) * 16) * zoom + 10}px`,
    });
  }
  Object.assign(preview.style, {
    left: `${(pos.x - item.height * 32) * zoom}px`,
    top: `${(pos.y - 16) * zoom}px`,
    width: `${total * 32 * zoom}px`,
    height: `${total * 16 * zoom}px`,
    clipPath: `polygon(${(item.height / total) * 100}% 0,100% ${(item.width / total) * 100}%,${(item.width / total) * 100}% 100%,0 ${(item.height / total) * 100}%)`,
  });
}
document.querySelector("#move-plot")!.addEventListener("click", () => {
  buildMode = null;
  movingId = null;
  movingPlotId = null;
  closeService();
  pickingPlot = true;
  preview.hidden = true;
  buildingTooltip.hidden = true;
  render();
  document.querySelector("#placement-hint")!.textContent =
    "Choose the plot to move, then choose open land.";
});
document
  .querySelector("#next-season")!
  .addEventListener("click", () => void act({ type: "season" }));
document.querySelector("#upgrade-building")!.addEventListener("click", () => {
  if (inspectedId !== null) void act({ type: "upgrade", id: inspectedId });
});
document.querySelector("#move-building")!.addEventListener("click", () => {
  closeService();
  movingId = inspectedId;
  movingPlotId = null;
  pickingPlot = false;
  buildMode = null;
  render();
  document.querySelector<HTMLDetailsElement>("#build-shop")!.open = false;
  document.querySelector("#placement-hint")!.textContent =
    "Choose open land for the selected building or tree. Moving is free. Escape or Cancel placement cancels.";
});
document
  .querySelector("#work")!
  .addEventListener("click", () => void act({ type: "work" }));

document
  .querySelector("#expand")!
  .addEventListener("click", () => selectBuild("plot"));
document
  .querySelector("#improve")!
  .addEventListener("click", () => void act({ type: "improve" }));
const params = new URLSearchParams(location.search);
const instance = import.meta.env.DEV
  ? (params.get("instance") ?? "default")
  : "player";
const namespace = import.meta.env.DEV ? `dev-${instance}` : "player";
let store: Awaited<ReturnType<typeof openSaveStore>> | undefined;
function render() {
  if (!cropUnlocked(state, selected)) selected = "turnip";
  document.querySelector("#season")!.innerHTML =
    `<span class="sr-only">Year ${state.year} · ${state.season} · ${state.coins.toLocaleString()} coins</span><span class="calendar" aria-hidden="true">${icon(state.season === "summer" ? "sun" : state.season)}<span><small>Year ${state.year}</small>${state.season}</span></span><span class="coin-balance" aria-hidden="true">${icon("coin")}<span id="coin-count">${harvestFeedback.balance(state.coins).toLocaleString()}</span></span>`;
  scene.setState(state);
  const placing = Boolean(
    buildMode || movingId !== null || movingPlotId !== null || pickingPlot,
  );
  document.querySelector<HTMLButtonElement>("#farm-mode")!.hidden = !placing;
  document.querySelector<HTMLElement>("#placement-hint")!.hidden = !placing;
  document.querySelector("#seed-selection")!.textContent =
    `${crops[selected].name} seeds in basket`;
  const turn = turnNumber(state),
    policy = state.farmPolicy ?? {};
  document.querySelector<HTMLButtonElement>("#next-season")!.disabled =
    turn === 160;
  document.querySelector("#next-season")!.textContent =
    turn === 160 ? "Final season · 160/160" : `End turn · ${turn}/160`;
  document.querySelector("#progression")!.textContent =
    `Turn ${turn}/160 · ${totalHarvests(state)} harvests · ${state.structures.length} structures · +${policyProduction(seasonalIncome(state), policy)} coins / season`;
  document.querySelector("#opportunity-notes")!.replaceChildren(
    ...state.opportunities.map((id) => {
      const p = document.createElement("p");
      p.textContent = opportunities[id].story;
      return p;
    }),
  );
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-build]",
  )) {
    const kind = button.dataset.build as BuildingKind | "plot";
    if (kind === "plot") {
      button.textContent = `Crop plot · 1×1 · ${policyCost(expansionCost(state), state.farmPolicy)} coins`;
      button.disabled =
        state.plots.length >= (policy.maxPlots ?? WORLD_CELLS) ||
        state.coins < policyCost(expansionCost(state), policy);
      continue;
    }
    const item = buildings[kind],
      count = state.structures.filter((s) => s.kind === kind).length;
    const available = canBuild(state, kind),
      cost = policyCost(item.cost, policy),
      limit = policy.buildingLimits?.[kind];
    const label = `${item.name} · ${item.width}×${item.height} · ${cost} coins · ${!available ? opportunities[kind as Opportunity].need : `${count} built`} · ${item.benefit} · ready next season`;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = `${icon(kind === "oak" || kind === "apple" ? "spring" : "home")}<span>${item.name}<small>${!available ? opportunities[kind as Opportunity].need : `${item.width} × ${item.height} · ${count} built`}</small></span><span class="tool-price">${icon("coin")}${cost.toLocaleString()}</span>`;
    button.disabled =
      turn === 160 ||
      !available ||
      state.coins < cost ||
      policy.blockedBuildings?.includes(kind) === true ||
      (limit !== undefined && count >= limit);
  }
  const orchard = activeService === "fields";
  document.querySelector("#inspection-heading")!.textContent = orchard
    ? "Your orchard"
    : "Your buildings";
  document.querySelector("#inspection-label")!.textContent = orchard
    ? "Choose a tree to care for or transplant"
    : "Choose a building to upgrade or move";
  const target =
    document.querySelector<HTMLSelectElement>("#structure-target")!;
  target.replaceChildren(
    new Option(orchard ? "Select a tree…" : "Select a building…", ""),
    ...state.structures
      .filter((s) => isTree(s.kind) === orchard)
      .map(
        (s) =>
          new Option(
            `${buildings[s.kind].name} ${s.id} · Level ${s.level}`,
            String(s.id),
          ),
      ),
  );
  target.value = inspectedId === null ? "" : String(inspectedId);
  const inspected = state.structures.find((s) => s.id === inspectedId),
    upgrade = document.querySelector<HTMLButtonElement>("#upgrade-building")!,
    move = document.querySelector<HTMLButtonElement>("#move-building")!;
  upgrade.hidden = !inspected || buildings[inspected.kind].levels === 1;
  move.hidden = !inspected;
  if (!inspected)
    document.querySelector("#selected-building")!.textContent = orchard
      ? "Select a planted tree to improve its care or transplant it."
      : "Select a building to see its facilities, upgrade it, or move it.";
  if (inspected) {
    document
      .querySelector("#selected-building")!
      .classList.toggle(
        "pending-building",
        !!(inspected.pendingConstruction || inspected.pendingUpgrade),
      );
    move.textContent = isTree(inspected.kind)
      ? "Transplant selected tree"
      : "Move selected building";
    const item = buildings[inspected.kind],
      remaining = upgradeRemaining(state, inspected),
      cost = policyCost(upgradeCost(inspected), policy);
    document.querySelector("#selected-building")!.textContent =
      `${item.name} · ${inspected.pendingConstruction ? (isTree(inspected.kind) ? "Growing, ready next season. Benefits start when mature." : "⚒ Ready next season. Benefits start when complete.") : `Level ${inspected.level}/${item.levels}.`} ${inspected.pendingUpgrade ? `Upgrading to level ${inspected.level + 1}, ready next season. ` : ""}${item.benefit}. ${!inspected.pendingConstruction && !inspected.pendingUpgrade && inspected.level < item.levels ? (remaining ? upgradeHint(state, inspected) : "Mara: This building has earned its keep. I can help expand it.") : ""}`;
    upgrade.textContent = inspected.pendingConstruction
      ? isTree(inspected.kind)
        ? "Growing · ready next season"
        : "⚒ Ready next season"
      : inspected.pendingUpgrade
        ? "⚒ Upgrade underway · ready next season"
        : inspected.level === item.levels
          ? "Fully upgraded"
          : `${isTree(inspected.kind) ? "Improve tree care" : "Upgrade"} · ${cost} coins · ${remaining ? upgradeHint(state, inspected) : "ready next season"}`;
    upgrade.disabled =
      !!inspected.pendingConstruction ||
      !!inspected.pendingUpgrade ||
      turn === 160 ||
      inspected.level === item.levels ||
      remaining > 0 ||
      state.coins < cost ||
      policy.blockedBuildings?.includes(inspected.kind) === true;
  }

  document.querySelector("#crop-opportunity")!.textContent = cropUnlocked(
    state,
    "corn",
  )
    ? ""
    : "Eli is looking for a grower. Harvest a turnip and a carrot to hear his offer.";
  for (const button of cropOptions.querySelectorAll<HTMLButtonElement>(
    "button",
  )) {
    const id = button.dataset.crop as CropId;
    button.setAttribute("aria-pressed", String(id === selected));
    const crop = crops[id];
    const detail = !cropUnlocked(state, id)
      ? `${crop.name}: ${opportunities.corn.need}. Eli can find you seeds.`
      : `${crop.name}: ${policyCost(seedCost(state, id), policy)} coins to plant, ${crop.steps} season${crop.steps === 1 ? "" : "s"} to grow · Plant ${crop.plantingSeasons.join(" / ")}, harvest ${policyProduction(harvestValue(state, id), policy)} coins.`;
    button.querySelector(".seed-price")!.innerHTML =
      `${icon("coin")}${policyCost(seedCost(state, id), policy)}`;
    button.disabled = !cropUnlocked(state, id) || !canPlant(id, turn);
    button.setAttribute("aria-label", detail);
    button.querySelector(".control-detail")!.textContent = detail;
  }
  document.querySelector<HTMLButtonElement>("#work")!.hidden =
    policy.allowWork === false ||
    state.coins >=
      (state.plots.length
        ? Math.max(1, policyCost(seedCost(state, "turnip"), policy))
        : policyCost(expansionCost(state), policy) +
          Math.max(1, policyCost(seedCost(state, "turnip"), policy))) ||
    state.plots.some(Boolean);
  const expand = document.querySelector<HTMLButtonElement>("#expand")!;
  const expandLabel =
    state.plots.length === WORLD_CELLS
      ? "All plots open"
      : `Open a plot · ${policyCost(expansionCost(state), policy)} coins`;
  expand.setAttribute("aria-label", expandLabel);
  expand.title = expandLabel;
  expand.innerHTML = `${icon("expand")}<span>Expand</span><span class="tool-price" aria-hidden="true">${state.plots.length === WORLD_CELLS ? "✓" : `${icon("coin")}${policyCost(expansionCost(state), policy)}`}</span>`;
  expand.disabled =
    state.plots.length >= (policy.maxPlots ?? WORLD_CELLS) ||
    state.coins < policyCost(expansionCost(state), policy);
  const improve = document.querySelector<HTMLButtonElement>("#improve")!;
  const improveLabel = state.pendingSoilUpgrade
    ? "Soil improvement underway · ready next season"
    : state.soilLevel === 3
      ? "Soil fully improved"
      : `Improve soil · ${policyCost(soilCost(state), policy)} coins (+3 / harvest next season)`;
  const soilOffer = `soil${state.soilLevel + 1}` as Opportunity;
  const soilAvailable = state.soilLevel < 3 && hasOpportunity(state, soilOffer);
  improve.disabled =
    !!state.pendingSoilUpgrade ||
    turn === 160 ||
    !soilAvailable ||
    state.coins < policyCost(soilCost(state), policy);
  const soilLabel =
    improveLabel +
    (state.soilLevel < 3 && !soilAvailable
      ? ` · ${opportunities[soilOffer].need}`
      : "");
  improve.setAttribute("aria-label", soilLabel);
  improve.title = soilLabel;
  improve.innerHTML = `${icon("improve")}<span>Soil</span><span class="tool-price" aria-hidden="true">${state.soilLevel === 3 ? "✓" : `${icon("coin")}${policyCost(soilCost(state), policy)}`}</span>`;
  const ready = state.plots.filter(
    (p) => p && p.growth === crops[p.crop].steps,
  ).length;
  document.querySelector("#farm-summary")!.textContent =
    `${state.plots.length} plots · ${ready} ready to harvest · Soil level ${state.soilLevel}/3`;
  document.querySelector("#farm-stats")!.innerHTML =
    `<span title="${state.plots.length} plots">${icon("expand")}${state.plots.length}</span><span title="${ready} ready to harvest">${icon("harvest")}${ready}</span><span title="Soil level ${state.soilLevel}/3">${icon("improve")}<span class="soil-meter">${[1, 2, 3].map((level) => `<i class="${level <= state.soilLevel ? "filled" : ""}"></i>`).join("")}</span></span>`;
}
async function apply(
  next: typeof state,
  resetFarmer = true,
  recover = false,
  reward = false,
) {
  if (loadFailed && !recover)
    throw new Error(
      "Export your original save, then import a valid 64 × 64 farm to continue.",
    );
  const valid = parseState(next);
  if (!store) throw new Error("Local saves are unavailable.");
  if (saving) throw new Error("A save is in progress. Try again.");
  saving = true;
  try {
    await store.save(valid);
    if (resetFarmer) harvestFeedback.reset(valid.coins);
    else if (reward) harvestFeedback.reserve(valid.coins);
    state = valid;
    loadFailed = false;
    if (resetFarmer) {
      navigationVersion++;
      closeService();
      cameraControls.open = false;
      scene.resetFarmer();
    }
    render();
    status.textContent = "Saved on this browser";
  } finally {
    saving = false;
  }
}
try {
  store = await openSaveStore(namespace);
  state = (await store.load()) ?? initialState();
  await store.save(state);
  status.textContent = "Saved on this browser";
} catch (error) {
  loadFailed = true;
  message.textContent =
    "Could not load local save. Export before closing; import a valid save to recover.";
  status.textContent = `Could not load your farm: ${error instanceof Error ? error.message : "Local storage is unavailable."} Your saved farm is unchanged. Export it before importing a valid save.`;
}
render();
document.querySelector("#export")!.addEventListener("click", async () => {
  const exported = loadFailed && store ? await store.readRaw() : state;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "what-we-sow-save.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document
  .querySelector<HTMLInputElement>("#import")!
  .addEventListener("change", async (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await apply(parseState(JSON.parse(await file.text())), true, true);
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Could not import save.";
    }
    input.value = "";
  });
if (import.meta.env.DEV) {
  const { mountDevPanel } = await import("./dev/panel");
  mountDevPanel(
    () => state,
    (next) => apply(next, true, true),
  );
}
