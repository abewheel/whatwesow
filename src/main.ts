import { WORLD_CELLS, WORLD_SIZE } from "./contracts/world";
import { turnNumber } from "./macro/state";
import {
  buildings,
  canPlace,
  cellKey,
  footprint,
  upgradeCost,
  upgradeTurn,
  seasonalIncome,
  buildUnlock,
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
  expansionCost,
  harvestValue,
  soilCost,
  seedCost,
  type CropId,
} from "./micro/state";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<main><section class="farm-card" aria-label="Farm overview">
<div id="farm" tabindex="0" aria-label="Scrollable farm. Drag, use arrow keys, or scroll to explore."><div id="farm-world"><div id="farm-renderer"></div></div></div>
<header class="hud-top"><div class="farm-title"><span class="eyebrow">Your first acre</span><h1>What We Sow</h1></div><output id="season"></output><button id="estate-toggle" aria-expanded="false" aria-controls="estate-controls" aria-label="Estate controls" title="Estate controls">${icon("build")}</button><button id="open-menu" aria-haspopup="dialog" aria-label="Open farm menu">${icon("menu")}<span class="sr-only">Menu</span></button></header>
<div id="estate-controls" class="estate-tools"><button id="next-season">Next season</button><button id="farm-mode" aria-label="Farm tool / cancel build">${icon("seeds")}<span>Farm</span></button><button id="home-view" aria-label="Center farm">${icon("home")}<span>Home</span></button><span class="zoom-controls" role="group" aria-label="Farm zoom"><button id="zoom-out" aria-label="Zoom out">−</button><output id="zoom-level" aria-live="polite">100%</output><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-reset" aria-label="Reset zoom to 100 percent">100%</button></span><details id="land-tools"><summary>Explore land</summary><button id="move-plot">Move a plot</button><button id="pan-left" aria-label="Pan left">←</button><button id="pan-right" aria-label="Pan right">→</button><label>Row <input id="view-row" aria-label="View row" type="number" min="0" max="127" value="16"></label><label>Column <input id="view-col" aria-label="View column" type="number" min="0" max="127" value="16"></label><button id="go-to-cell">Go to land</button></details><p id="placement-hint">Drag the field or use arrow keys to explore.</p></div><div class="hud-bottom"><div class="field-note"><strong id="farm-message" role="status">Choose seeds, then click an empty plot.</strong><span id="farm-summary" class="sr-only"></span><div id="farm-stats" aria-hidden="true"></div></div>
<section class="farm-tools" aria-label="Farming tools">
<div id="tool-panels">
<section id="panel-plant" class="tool-panel" aria-label="Planting"><div id="crop-options"></div></section>
<section id="panel-build" class="tool-panel" aria-label="Construction" hidden><div id="build-shop"><div class="build-heading"><span class="eyebrow">Construction</span><button id="expand"></button></div><p id="progression"></p><div id="build-options"></div></div></section>
<section id="panel-upgrade" class="tool-panel" aria-label="Upgrades" hidden><div class="upgrade-soil"><button id="improve"></button></div><div class="building-inspector"><p id="selected-building">Select a building on the farm to inspect it.</p><div><button id="upgrade-building" hidden>Upgrade selected building</button><button id="move-building" hidden>Move selected building</button></div></div></section>
</div>
<div class="mode-bar"><div class="mode-switch" aria-label="Farm activities"><button id="mode-plant" aria-pressed="true" aria-controls="panel-plant">${icon("seeds")}<span>Plant</span></button><button id="mode-build" aria-pressed="false" aria-controls="panel-build">${icon("build")}<span>Build</span></button><button id="mode-upgrade" aria-pressed="false" aria-controls="panel-upgrade">${icon("improve")}<span>Upgrade</span></button></div><span id="active-tool" role="status">Turnip seeds</span><button id="grow" aria-label="Advance growth" title="Advance growth within this season">${icon("grow")}<span>Grow</span></button><button id="work" aria-label="Help with a delivery · +4 coins" title="Help with a delivery · +4 coins" hidden>${icon("harvest")}<span>+4</span>${icon("coin")}</button><button id="collapse-tools" aria-expanded="true" aria-controls="tool-panels" aria-label="Collapse tools" title="Collapse tools"><span aria-hidden="true">⌄</span></button></div>
</section></div>
<dialog id="farm-menu" aria-labelledby="menu-title"><form method="dialog" class="menu-heading"><h2 id="menu-title">Your farm</h2><button aria-label="Close farm menu">✕</button></form><p class="menu-note">A little care, season after season.</p><div class="save-bar"><span id="save-status" role="status">Opening your farm…</span><div><button id="export">Export save</button><button id="import-trigger">Import save</button><input id="import" type="file" accept="application/json,.json" hidden /></div></div><p class="menu-help">Choose seeds. Plant an empty plot. Advance growth, then pick the ripe crops.</p><button id="resume">Back to the farm</button></dialog>
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
document.querySelector("#estate-toggle")!.addEventListener("click", (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  const open = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(open));
  document.querySelector(".estate-tools")!.classList.toggle("is-open", open);
  if (open) collapseTools();
});
const estateControls = document.querySelector<HTMLElement>("#estate-controls")!;
const hudHeader = document.querySelector<HTMLElement>(".hud-top")!;
const hudDock = document.querySelector<HTMLElement>(".hud-bottom")!;
const farmCard = document.querySelector<HTMLElement>(".farm-card")!;
// Navigation occupies the space between the live header and folded activity dock.
const fitEstateControls = new ResizeObserver(() => {
  const header = hudHeader.getBoundingClientRect();
  const dock = hudDock.getBoundingClientRect();
  const farm = farmCard.getBoundingClientRect();
  estateControls.style.top = `${header.bottom - farm.top + 8}px`;
  estateControls.style.maxHeight = `${Math.max(44, dock.top - header.bottom - 16)}px`;
});
for (const element of [hudHeader, hudDock, farmCard])
  fitEstateControls.observe(element);
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
let selected: CropId = "turnip";
let saving = false;
let buildMode: BuildingKind | "plot" | null = null;
let movingId: number | null = null;
let movingPlotId: number | null = null;
let pickingPlot = false;
let inspectedId: number | null = null;
let centered = false;
const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
let zoomIndex = 3;
let zoom = zoomLevels[zoomIndex];
type ToolMode = "plant" | "build" | "upgrade";
let toolMode: ToolMode = "plant";
let toolsCollapsed = false;
function renderTools() {
  if (!toolsCollapsed) {
    document.querySelector(".estate-tools")!.classList.remove("is-open");
    document
      .querySelector("#estate-toggle")!
      .setAttribute("aria-expanded", "false");
  }
  const panels = document.querySelector<HTMLElement>("#tool-panels")!;
  panels.hidden = toolsCollapsed;
  for (const mode of ["plant", "build", "upgrade"] as const) {
    document
      .querySelector(`#mode-${mode}`)!
      .setAttribute("aria-pressed", String(mode === toolMode));
    document.querySelector<HTMLElement>(`#panel-${mode}`)!.hidden =
      mode !== toolMode;
  }
  const collapse =
    document.querySelector<HTMLButtonElement>("#collapse-tools")!;
  collapse.setAttribute("aria-expanded", String(!toolsCollapsed));
  collapse.setAttribute(
    "aria-label",
    toolsCollapsed ? "Expand tools" : "Collapse tools",
  );
  collapse.title = toolsCollapsed ? "Expand tools" : "Collapse tools";
  collapse.innerHTML = `<span class="dock-chevron" aria-hidden="true"></span>`;
  collapse.dataset.collapsed = String(toolsCollapsed);
  document.querySelector("#active-tool")!.textContent =
    movingId !== null
      ? "Move building"
      : movingPlotId !== null || pickingPlot
        ? "Move plot"
        : buildMode
          ? `Place ${buildMode === "plot" ? "plot" : buildings[buildMode].name}`
          : toolMode === "upgrade"
            ? "Select a building"
            : toolMode === "build"
              ? "Choose a structure"
              : `${crops[selected].name} seeds`;
}
function showTools(mode: ToolMode, reset = true) {
  document.querySelector(".estate-tools")!.classList.remove("is-open");
  document
    .querySelector("#estate-toggle")!
    .setAttribute("aria-expanded", "false");
  toolMode = mode;
  toolsCollapsed = false;
  if (reset) {
    buildMode = null;
    movingId = null;
    movingPlotId = null;
    pickingPlot = false;
    preview.hidden = true;
  }
  renderTools();
}
function collapseTools() {
  toolsCollapsed = true;
  renderTools();
  const focused = document.activeElement;
  if (focused && document.querySelector("#tool-panels")!.contains(focused))
    document.querySelector<HTMLButtonElement>(`#mode-${toolMode}`)!.focus();
}
for (const mode of ["plant", "build", "upgrade"] as const)
  document
    .querySelector(`#mode-${mode}`)!
    .addEventListener("click", () => showTools(mode));
document.querySelector("#collapse-tools")!.addEventListener("click", () => {
  toolsCollapsed = !toolsCollapsed;
  renderTools();
});
document.querySelector(".farm-tools")!.addEventListener("keydown", (event) => {
  if ((event as KeyboardEvent).key === "Escape" && !toolsCollapsed) {
    event.stopPropagation();
    collapseTools();
  }
});
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
  if (game.scale.width !== width || game.scale.height !== height) {
    if (centered) {
      viewport.scrollLeft += (game.scale.width - width) / 2;
      viewport.scrollTop += (game.scale.height - height) / 2;
    }
    game.scale.resize(width, height);
  }
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
    document.querySelector("#placement-hint")!.textContent =
      "Choose row and column 0–127.";
    return;
  }
  const p = projectCell({ row, col });
  viewport.scrollLeft = p.x * zoom - viewport.clientWidth / 2;
  viewport.scrollTop = p.y * zoom - viewport.clientHeight / 2;
  document.querySelector<HTMLDetailsElement>("#land-tools")!.open = false;
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
    }
  },
  true,
);
function clearBuild() {
  buildMode = null;
  movingId = null;
  movingPlotId = null;
  pickingPlot = false;
  preview.hidden = true;
  document.querySelector("#placement-hint")!.textContent =
    "Farm tool selected. Drag or use arrow keys to explore.";
  render();
}
document.querySelector("#farm-mode")!.addEventListener("click", () => {
  clearBuild();
  showTools("plant");
});
function selectBuild(kind: BuildingKind | "plot") {
  buildMode = kind;
  movingId = null;
  movingPlotId = null;
  pickingPlot = false;
  preview.hidden = true;
  render();
  collapseTools();
  document.querySelector("#placement-hint")!.textContent =
    `Place ${kind === "plot" ? "a plot" : buildings[kind].name}: choose open land. Green fits; red is blocked. Farm tool cancels.`;
}
for (const kind of ["plot", ...Object.keys(buildings)] as (
  "plot" | BuildingKind
)[]) {
  const button = document.createElement("button");
  button.dataset.build = kind;
  button.addEventListener("click", () => selectBuild(kind));
  document.querySelector("#build-options")!.append(button);
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
    selected = id as CropId;
    render();
    message.textContent = `${crop.name} · ${crop.steps} growth step${crop.steps === 1 ? "" : "s"} · Harvest ${policyProduction(harvestValue(state, id as CropId), state.farmPolicy ?? {})} coins.`;
  });
  cropOptions.append(button);
}
let farmQueue: Promise<void> = Promise.resolve();
function act(action: FarmAction | { type: "season" }) {
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
        action.type === "season",
      );
      if (action.type !== "season") scene.performAction(action, previous);
      message.textContent = result.message;
      if (action.type === "move" || action.type === "movePlot") {
        movingId = null;
        movingPlotId = null;
        pickingPlot = false;
        preview.hidden = true;
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
        const index = state.plotCells.findIndex((c) => cellKey(c) === key);
        if (index >= 0) {
          if (toolMode !== "plant") {
            message.textContent = "Choose Plant to work this plot.";
            return;
          }
          void act(
            state.plots[index]
              ? { type: "harvest", plot: index }
              : { type: "plant", plot: index, crop: selected },
          );
          return;
        }
        const building = state.structures.find((s) =>
          footprint(s, buildings[s.kind].width, buildings[s.kind].height).some(
            (c) => cellKey(c) === key,
          ),
        );
        if (building) {
          inspectedId = building.id;
          showTools("upgrade", false);
          render();
          return;
        }
        message.textContent =
          "Open land. Choose a plot, tree, or structure in Build & progression.";
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
    const plot = index === undefined ? null : state.plots[index];
    const label =
      index !== undefined
        ? `Plot ${index + 1}: ${!plot ? "empty" : `${crops[plot.crop].name}, ${plot.growth === crops[plot.crop].steps ? "ready to harvest" : `growing ${plot.growth}/${crops[plot.crop].steps}`}`}`
        : structure
          ? `${buildings[structure.kind].name} ${structure.id}, level ${structure.level}`
          : `Land ${target.row},${target.col}`;
    if (button.getAttribute("aria-label") !== label) {
      button.setAttribute("aria-label", label);
      button.title = label;
    }
  }
  if (hoveredCell) showPreview(hoveredCell);
  if (!centered) {
    centered = true;
    requestAnimationFrame(centerFarm);
  }
};
function showPreview(cell: Cell) {
  hoveredCell = cell;
  const moving = state.structures.find((s) => s.id === movingId);
  const kind = moving?.kind ?? (movingPlotId !== null ? "plot" : buildMode);
  if (!kind) {
    preview.hidden = true;
    return;
  }
  const item = kind === "plot" ? { width: 1, height: 1 } : buildings[kind];
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
    pos = projectCell(cell);
  preview.hidden = false;
  preview.dataset.valid = String(fits);
  const total = item.width + item.height;
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
  pickingPlot = true;
  document.querySelector<HTMLDetailsElement>("#land-tools")!.open = false;
  collapseTools();
  preview.hidden = true;
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
  movingId = inspectedId;
  movingPlotId = null;
  pickingPlot = false;
  buildMode = null;
  render();
  collapseTools();
  document.querySelector("#placement-hint")!.textContent =
    "Move selected structure onto open land. Moving is free. Farm tool cancels.";
});
document
  .querySelector("#work")!
  .addEventListener("click", () => void act({ type: "work" }));
document
  .querySelector("#grow")!
  .addEventListener("click", () => void act({ type: "grow" }));
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
  renderTools();
  document.querySelector("#season")!.innerHTML =
    `<span class="sr-only">Year ${state.year} · ${state.season} · ${state.coins.toLocaleString()} coins</span><span class="calendar" aria-hidden="true">${icon(state.season === "summer" ? "sun" : state.season)}<span><small>Year ${state.year}</small>${state.season}</span></span><span class="coin-balance" aria-hidden="true">${icon("coin")}${state.coins.toLocaleString()}</span>`;
  scene.setState(state);
  const turn = turnNumber(state),
    policy = state.farmPolicy ?? {};
  document.querySelector<HTMLButtonElement>("#next-season")!.disabled =
    turn === 160;
  document.querySelector("#next-season")!.textContent =
    turn === 160 ? "Final season · 160/160" : `Next season · ${turn}/160`;
  document.querySelector("#progression")!.textContent =
    `Turn ${turn}/160 · ${state.structures.length} structures · +${policyProduction(seasonalIncome(state), policy)} coins / season`;
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-build]",
  )) {
    const kind = button.dataset.build as BuildingKind | "plot";
    if (kind === "plot") {
      const label = `Crop plot · 1×1 · ${policyCost(expansionCost(state), state.farmPolicy)} coins`;
      button.setAttribute("aria-label", label);
      button.title = label;
      button.innerHTML = `${icon("expand")}<span>Crop plot<small>1 × 1</small></span><span class="tool-price">${icon("coin")}${policyCost(expansionCost(state), policy)}</span>`;
      button.disabled =
        state.plots.length >= (policy.maxPlots ?? WORLD_CELLS) ||
        state.coins < policyCost(expansionCost(state), policy);
      continue;
    }
    const item = buildings[kind],
      count = state.structures.filter((s) => s.kind === kind).length;
    const unlock = buildUnlock(kind, policy),
      cost = policyCost(item.cost, policy),
      limit = policy.buildingLimits?.[kind];
    const label = `${item.name} · ${item.width}×${item.height} · ${cost} coins · ${turn < unlock ? `Unlock turn ${unlock}` : `${count} built`} · ${item.benefit}`;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = `${icon(kind === "oak" || kind === "apple" ? "spring" : "home")}<span>${item.name}<small>${turn < unlock ? `Turn ${unlock}` : `${item.width} × ${item.height} · ${count} built`}</small></span><span class="tool-price">${icon("coin")}${cost.toLocaleString()}</span>`;
    button.disabled =
      turn < unlock ||
      state.coins < cost ||
      policy.blockedBuildings?.includes(kind) === true ||
      (limit !== undefined && count >= limit);
  }
  const inspected = state.structures.find((s) => s.id === inspectedId),
    upgrade = document.querySelector<HTMLButtonElement>("#upgrade-building")!,
    move = document.querySelector<HTMLButtonElement>("#move-building")!;
  upgrade.hidden = !inspected;
  move.hidden = !inspected;
  if (!inspected)
    document.querySelector("#selected-building")!.textContent =
      "Select a building on the farm to inspect it.";
  if (inspected) {
    const item = buildings[inspected.kind],
      unlock = upgradeTurn(inspected.kind, inspected.level, policy),
      cost = policyCost(upgradeCost(inspected), policy);
    document.querySelector("#selected-building")!.textContent =
      `${item.name} · Level ${inspected.level}/${item.levels}. ${item.benefit}.`;
    upgrade.textContent =
      inspected.level === item.levels
        ? "Fully upgraded"
        : `Upgrade · ${cost} coins · turn ${unlock}`;
    upgrade.disabled =
      inspected.level === item.levels ||
      turn < unlock ||
      state.coins < cost ||
      policy.blockedBuildings?.includes(inspected.kind) === true;
  }

  for (const button of cropOptions.querySelectorAll<HTMLButtonElement>(
    "button",
  )) {
    const id = button.dataset.crop as CropId;
    button.setAttribute("aria-pressed", String(id === selected));
    const crop = crops[id];
    const detail = `${crop.name}: ${policyCost(seedCost(state, id), policy)} coins to plant, ${crop.steps} growth step${crop.steps === 1 ? "" : "s"}, harvest ${policyProduction(harvestValue(state, id), policy)} coins.`;
    button.querySelector(".seed-price")!.innerHTML =
      `${icon("coin")}${policyCost(seedCost(state, id), policy)}`;
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
  const grow = document.querySelector<HTMLButtonElement>("#grow")!;
  grow.disabled = !state.plots.some((p) => p && p.growth < crops[p.crop].steps);
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
  const improveLabel =
    state.soilLevel === 3
      ? "Soil fully improved"
      : `Improve soil · ${policyCost(soilCost(state), policy)} coins (+3 / harvest)`;
  improve.disabled =
    state.soilLevel === 3 ||
    state.coins < policyCost(soilCost(state), policy) ||
    turn < [1, 33, 97][state.soilLevel];
  const soilLabel =
    improveLabel +
    (state.soilLevel < 3 && turn < [1, 33, 97][state.soilLevel]
      ? ` · unlock turn ${[1, 33, 97][state.soilLevel]}`
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
async function apply(next: typeof state, resetFarmer = true) {
  const valid = parseState(next);
  if (!store) throw new Error("Local saves are unavailable.");
  if (saving) throw new Error("A save is in progress. Try again.");
  saving = true;
  try {
    await store.save(valid);
    state = valid;
    if (resetFarmer) scene.resetFarmer();
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
} catch {
  status.textContent =
    "Could not load local save. Export before closing; import a valid save to recover.";
  message.textContent = status.textContent;
}
render();
document.querySelector("#export")!.addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
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
      await apply(parseState(JSON.parse(await file.text())));
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
    (next) => apply(next),
  );
}
