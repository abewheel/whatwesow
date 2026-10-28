import {
  buildingArtwork,
  distinctStructures,
  distinctServices,
} from "./game/building-artwork";
import { animalArtwork } from "./game/animal-layout";
import { SeasonTransition } from "./game/season-transition";
import { HarvestFeedback } from "./game/harvest-feedback";
import { treeStatus } from "./micro/world";
import {
  canBuild,
  canPlant as cropUnlocked,
  hasOpportunity,
  opportunities,
  upgradeRemaining,
  type Opportunity,
} from "./micro/progression";
import { serviceMenus, isTree, type ServiceId } from "./game/services";
import { WORLD_CELLS } from "./contracts/world";
import { turnNumber } from "./macro/state";
import {
  buildings,
  structureSize,
  constructionCost,
  isAnimal,
  animalProducts,
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
  TENT_CENTER_OFFSET,
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
  growthSeasons,
  type CropId,
} from "./micro/state";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<main><section class="farm-card" aria-label="Farm overview">
<div id="farm" tabindex="0" aria-label="Scrollable farm. Drag, use arrow keys, or scroll to explore."><div id="farm-world"><div id="farm-renderer"></div></div></div>
<header class="hud-top"><div class="farm-title"><h1>What We Sow</h1></div><div class="farm-overview"><output id="season"></output><section id="farm-status" aria-label="Farm status"><span id="empty-plots" role="img"></span><span id="growing-plots" role="img"></span><span id="harvest-ready" role="img"></span></section></div><button id="open-menu" aria-haspopup="dialog" aria-label="Open farm menu">${icon("menu")}<span class="sr-only">Menu</span></button></header>
<div class="hud-bottom"><div class="field-note"><strong id="farm-message" role="status">Tap land to plant or build. Tap a building for its actions.</strong><span id="farm-summary" class="sr-only"></span></div>
<section class="farm-tools" aria-label="Farming tools"><div class="work-tools mode-bar"><button id="farm-mode" hidden>Cancel placement</button><p id="placement-hint" hidden></p></div></section></div>
<div id="service-controls" hidden><button id="home-view">Center farm</button><span class="zoom-controls" role="group" aria-label="Farm zoom"><button id="zoom-out" aria-label="Zoom out">−</button><output id="zoom-level">100%</output><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-reset" aria-label="Reset zoom to 100 percent">Reset</button></span></div>
<dialog id="farm-menu" aria-labelledby="menu-title"><form method="dialog" class="menu-heading"><h2 id="menu-title">Your farm</h2><button aria-label="Close farm menu">✕</button></form><div class="save-bar"><span id="save-status" role="status">Opening your farm…</span><div><button id="export">Export save</button><button id="import-trigger">Import save</button><input id="import" type="file" accept="application/json,.json" hidden /></div></div><button id="resume">Back to the farm</button></dialog>

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
const servicePanel = document.createElement("section");
servicePanel.id = "service-panel";
servicePanel.hidden = true;
servicePanel.setAttribute("aria-labelledby", "service-title");
servicePanel.innerHTML = `<div class="service-heading"><h2 id="service-title"></h2><button id="close-service" aria-label="Close actions">×</button></div><p id="service-feedback" role="alert" hidden></p><div class="service-body"><div id="tile-actions"></div></div>`;
document.querySelector(".farm-card")!.append(servicePanel);
const serviceFeedback =
  document.querySelector<HTMLElement>("#service-feedback")!;
function moveControls(target: string, selectors: string[]) {
  for (const selector of selectors)
    document.querySelector(target)!.append(document.querySelector(selector)!);
}
const cameraControls = document.createElement("details");
cameraControls.id = "camera-controls";
cameraControls.addEventListener("toggle", () => {
  if (cameraControls.open) closeService();
});
cameraControls.innerHTML = `<summary aria-label="View controls">${icon("view")}</summary><div class="camera-panel"><div class="camera-heading"><h3>View controls</h3><button id="close-camera" aria-label="Close view controls">×</button></div><div class="pan-controls" role="group" aria-label="Pan farm"><button id="pan-up" aria-label="Pan up">↑</button><button id="pan-left" aria-label="Pan left">←</button><button id="pan-down" aria-label="Pan down">↓</button><button id="pan-right" aria-label="Pan right">→</button></div></div>`;
cameraControls.querySelector("#close-camera")!.addEventListener("click", () => {
  cameraControls.open = false;
  cameraControls
    .querySelector<HTMLElement>("summary")!
    .focus({ preventScroll: true });
});
document.querySelector(".hud-top")!.append(cameraControls);
moveControls(".camera-panel", ["#home-view", ".zoom-controls"]);
document.querySelector("#farm-mode")!.textContent = "Cancel placement";
const tileActions = document.querySelector<HTMLElement>("#tile-actions")!;
type ContextTarget =
  | { type: "cell"; cell: Cell }
  | { type: "building"; id: number }
  | { type: "service"; id: ServiceId; cell: Cell };
let contextTarget: ContextTarget | null = null;
function closeService() {
  if (contextTarget) navigationVersion++;
  contextTarget = null;
  document.querySelector("[data-context]")?.removeAttribute("data-context");
  if (!servicePanel.hidden) viewport.focus({ preventScroll: true });
  servicePanel.hidden = true;
}
function contextCell(): Cell | undefined {
  const target = contextTarget;
  if (!target) return;
  return target.type === "building"
    ? state.structures.find((s) => s.id === target.id)
    : target.cell;
}
function positionContext() {
  if (servicePanel.hidden) return;
  const cell = contextCell();
  if (!cell) {
    closeService();
    return;
  }
  const bounds = viewport.getBoundingClientRect();
  const card = document.querySelector(".farm-card")!.getBoundingClientRect();
  const point = projectCell(cell);
  const x = bounds.left - card.left + point.x * zoom - viewport.scrollLeft;
  const y = bounds.top - card.top + point.y * zoom - viewport.scrollTop;
  let anchor = {
    left: x - 32 * zoom,
    right: x + 32 * zoom,
    top: y - 16 * zoom,
    bottom: y + 16 * zoom,
  };
  const target = contextTarget;
  const building =
    target?.type === "building"
      ? state.structures.find((s) => s.id === target.id)
      : undefined;
  const service =
    target?.type === "service"
      ? serviceLocations(state).find((s) => s.id === target.id)
      : undefined;
  if (building && isTree(building.kind)) {
    anchor = {
      left: x - 35 * zoom,
      right: x + 35 * zoom,
      top: y - 56 * zoom,
      bottom: y + 16 * zoom,
    };
  } else if (service?.tent) {
    anchor = {
      left: x - 80 * zoom,
      right: x + 80 * zoom,
      top: y + (24 - 160 * (2 / 3)) * zoom,
      bottom: y + 24 * zoom,
    };
  } else if (building || service) {
    const lot = building
      ? {
          ...building,
          ...structureSize(building),
        }
      : service!;
    const distinct = building
      ? distinctStructures[building.kind]
      : distinctServices[service!.id];
    const frame =
      distinct ?? (building ? buildings[building.kind].frame : service!.frame);
    const art =
        building && isAnimal(building.kind)
          ? animalArtwork({
              ...building,
              kind: building.kind,
              ...structureSize(building),
            })
          : buildingArtwork(lot, frame, distinct !== undefined),
      top = projectCell(art);
    const left = bounds.left - card.left + top.x * zoom - viewport.scrollLeft;
    const upper = bounds.top - card.top + top.y * zoom - viewport.scrollTop;
    anchor = {
      left,
      right: left + art.size * zoom,
      top: upper,
      bottom: upper + art.height * zoom,
    };
  }
  const visual = window.visualViewport;
  const margin = 8,
    gap = 14;
  const leftEdge = Math.max(
    margin,
    (visual?.offsetLeft ?? 0) - card.left + margin,
  );
  const rightEdge = Math.min(
    card.width - margin,
    (visual?.offsetLeft ?? 0) +
      (visual?.width ?? window.innerWidth) -
      card.left -
      margin,
  );
  const topEdge = Math.max(
    margin,
    (visual?.offsetTop ?? 0) - card.top + margin,
  );
  const bottomEdge = Math.min(
    card.height - margin,
    (visual?.offsetTop ?? 0) +
      (visual?.height ?? window.innerHeight) -
      card.top -
      margin,
  );
  if (bottomEdge - topEdge < 100 || rightEdge - leftEdge < 100) {
    closeService();
    return;
  }
  const width = Math.min(300, rightEdge - leftEdge);
  servicePanel.style.width = `${width}px`;
  servicePanel.style.maxHeight = `${Math.min(440, bottomEdge - topEdge)}px`;
  const height = servicePanel.getBoundingClientRect().height;
  const rightFits = anchor.right + gap + width <= rightEdge;
  const leftFits = anchor.left - gap - width >= leftEdge;
  let left: number, top: number;
  if (rightFits || leftFits) {
    left = rightFits ? anchor.right + gap : anchor.left - gap - width;
    top = (anchor.top + anchor.bottom) / 2 - Math.min(height / 2, 80);
  } else {
    left = x - width / 2;
    const below = bottomEdge - anchor.bottom - gap,
      above = anchor.top - topEdge - gap;
    const available = Math.max(
      Math.min(240, bottomEdge - topEdge),
      Math.max(below, above),
    );
    servicePanel.style.maxHeight = `${Math.min(440, available)}px`;
    const actualHeight = servicePanel.getBoundingClientRect().height;
    top =
      below >= above ? anchor.bottom + gap : anchor.top - gap - actualHeight;
  }
  const actualHeight = servicePanel.getBoundingClientRect().height;
  servicePanel.style.left = `${Math.max(leftEdge, Math.min(rightEdge - width, left))}px`;
  servicePanel.style.top = `${Math.max(topEdge, Math.min(bottomEdge - actualHeight, top))}px`;
}
window.addEventListener("resize", positionContext);
window.addEventListener("scroll", positionContext, { passive: true });
window.visualViewport?.addEventListener("scroll", positionContext);
window.visualViewport?.addEventListener("resize", positionContext);
function tileButton(
  label: string,
  action: () => void,
  disabled = false,
  id?: string,
) {
  const button = document.createElement("button");
  button.textContent = label;
  button.disabled = disabled;
  if (id) button.id = id;
  button.addEventListener("click", action);
  tileActions.append(button);
  return button;
}
function note(text: string) {
  const p = document.createElement("p");
  p.textContent = text;
  tileActions.append(p);
}
function workPlot(cell: Cell, crop?: CropId) {
  closeService();
  const index = state.plotCells.findIndex((c) => cellKey(c) === cellKey(cell));
  if (index < 0) return;
  const plotId = state.plotIds[index],
    request = ++navigationVersion;
  const reached = scene.travelTo(cell, 1, 1, true, "rear", () => {
    if (request !== navigationVersion) return;
    const current = state.plotIds.indexOf(plotId);
    if (current < 0 || cellKey(state.plotCells[current]) !== cellKey(cell))
      return;
    void act(
      crop
        ? { type: "plant", plot: current, crop }
        : { type: "harvest", plot: current },
    );
  });
  message.textContent = reached
    ? `Walking to ${crop ? "plant" : "harvest"} this plot.`
    : "No walking path to this plot.";
}
function openTile(cell: Cell) {
  openContext({ type: "cell", cell });
}
function openContext(target: ContextTarget) {
  closeService();
  cameraControls.open = false;
  clearBuild();
  navigationVersion++;
  contextTarget = target;
  serviceFeedback.hidden = true;
  refreshContext();
  servicePanel.hidden = false;
  positionContext();
  document
    .querySelector<HTMLButtonElement>("#close-service")!
    .focus({ preventScroll: true });
}
function refreshContext() {
  const target = contextTarget,
    cell = contextCell();
  if (!target || !cell) {
    closeService();
    return;
  }
  const scroll = tileActions.parentElement!.scrollTop;
  const hadFocus = servicePanel.contains(document.activeElement);
  const focused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement.id
      : "";
  tileActions.replaceChildren();
  document.querySelector("[data-context]")?.removeAttribute("data-context");
  cellButtons.get(cellKey(cell))?.setAttribute("data-context", "true");
  const policy = state.farmPolicy ?? {},
    final = turnNumber(state) === 160;
  const title = document.querySelector("#service-title")!;
  const home =
    target.type === "service"
      ? target.id === "home"
      : target.type === "building" &&
        state.structures.find((s) => s.id === target.id)?.kind === "home";
  if (target.type === "building") {
    const building = state.structures.find((s) => s.id === target.id);
    if (!building) {
      closeService();
      return;
    }
    const item = buildings[building.kind],
      remaining = upgradeRemaining(state, building),
      cost = policyCost(upgradeCost(building), policy);
    title.textContent = item.name;
    note(`${item.benefit} · Level ${building.level}/${item.levels}`);
    if (building.pendingConstruction)
      note("Under construction · ready next season");
    if (building.pendingUpgrade) note("Upgrade underway · ready next season");
    if (isAnimal(building.kind)) {
      const product = animalProducts[building.kind];
      if (!building.pendingConstruction)
        note(
          building.product
            ? `${product.product} ready · ${policyProduction(product.value * building.level, policy)} coins`
            : "Collected · returns next season",
        );
      if (building.product && !building.pendingConstruction)
        tileButton(
          `Collect ${product.product.toLowerCase()}`,
          () => harvestSelectedTree(building.id),
          false,
          "collect-animal",
        );
    }
    if (isTree(building.kind)) {
      note(treeStatus(building));
      if (building.product)
        tileButton(
          "Harvest tree",
          () => harvestSelectedTree(building.id),
          false,
          "harvest-tree",
        );
    }
    if (item.levels > 1)
      tileButton(
        building.pendingUpgrade
          ? "Upgrade underway · ready next season"
          : building.level === item.levels
            ? "Fully upgraded"
            : `${isTree(building.kind) ? "Improve tree care" : "Upgrade"} · ${cost} coins${remaining ? ` · Harvest ${remaining} more ${building.kind === "mill" ? "corn crops" : "crops"}` : ""}`,
        () => void act({ type: "upgrade", id: building.id }),
        !!building.pendingConstruction ||
          !!building.pendingUpgrade ||
          final ||
          building.level === item.levels ||
          remaining > 0 ||
          state.coins < cost ||
          policy.blockedBuildings?.includes(building.kind) === true,
        "upgrade-building",
      );
    tileButton(
      isTree(building.kind) ? "Transplant tree" : "Move building",
      () => {
        closeService();
        movingId = building.id;
        render();
      },
      false,
      "move-building",
    );
  } else if (target.type === "service") {
    title.textContent =
      serviceLocations(state).find((s) => s.id === target.id)?.name ??
      serviceMenus[target.id].name;
    if (!home) note("Choose a field to plant, or open land to build.");
  } else {
    const index = state.plotCells.findIndex(
      (c) => cellKey(c) === cellKey(cell),
    );
    const plot = index < 0 ? null : state.plots[index];
    title.textContent =
      index < 0
        ? "Open land"
        : plot
          ? crops[plot.crop].name
          : "Plant this plot";
    if (index >= 0) {
      if (plot)
        tileButton(
          plot.growth >= crops[plot.crop].steps
            ? "Harvest crop"
            : `Growing · ${plot.growth}/${crops[plot.crop].steps}`,
          () => workPlot(cell),
          plot.growth < crops[plot.crop].steps,
        );
      else {
        let choices = 0;
        for (const id of Object.keys(crops) as CropId[]) {
          if (!cropUnlocked(state, id) || !canPlant(id, turnNumber(state)))
            continue;
          choices++;
          const price = policyCost(seedCost(state, id), policy),
            seasons = growthSeasons(state, id);
          const button = tileButton(
            `${crops[id].name} · ${price} coins`,
            () => workPlot(cell, id),
            state.coins < price || final,
          );
          button.dataset.crop = id;
          button.innerHTML = `${icon(id)}<span><strong>${crops[id].name} · ${price} coins</strong><small>${seasons} season${seasons === 1 ? "" : "s"} · harvest ${policyProduction(harvestValue(state, id), policy)} coins</small></span>`;
        }
        if (!choices) note("No planting this season.");
      }
      tileButton("Move this plot", () => {
        closeService();
        movingPlotId = state.plotIds[index];
        render();
      });
      const offer = `soil${state.soilLevel + 1}` as Opportunity;
      const available = state.soilLevel < 3 && hasOpportunity(state, offer);
      tileButton(
        state.pendingSoilUpgrade
          ? "Soil improvement underway · next season"
          : state.soilLevel === 3
            ? "Soil fully improved"
            : `Improve soil · ${policyCost(soilCost(state), policy)} coins · +3 per harvest on all plots${!available ? ` · ${opportunities[offer].need}` : ""}`,
        () => void act({ type: "improve" }),
        !!state.pendingSoilUpgrade ||
          final ||
          !available ||
          state.coins < policyCost(soilCost(state), policy),
        "improve",
      );
    } else {
      const cost = policyCost(expansionCost(state), policy);
      tileButton(
        `Prepare crop plot · ${cost} coins`,
        () => void act({ type: "expand", cell }),
        final ||
          state.coins < cost ||
          state.plots.length >= (policy.maxPlots ?? WORLD_CELLS) ||
          !canPlace(state, cell, 1, 1, policy),
        "expand",
      );
      for (const kind of Object.keys(buildings) as BuildingKind[]) {
        const item = buildings[kind],
          count = state.structures.filter((s) => s.kind === kind).length,
          cost = policyCost(constructionCost(state, kind), policy),
          limit = policy.buildingLimits?.[kind];
        if (!canBuild(state, kind) || (kind === "home" && count > 0)) continue;
        const button = tileButton(
          `${item.name} · ${cost} coins · ${item.width}×${item.height} · ${item.benefit} · next season`,
          () => void act({ type: "build", kind, cell }),
          final ||
            state.coins < cost ||
            policy.blockedBuildings?.includes(kind) === true ||
            (limit !== undefined && count >= limit) ||
            !canPlace(state, cell, item.width, item.height, policy),
        );
        button.dataset.build = kind;
      }
    }
    tileButton("Walk here", () => {
      closeService();
      navigationVersion++;
      scene.travelTo(cell);
    });
  }
  if (home) {
    const button = tileButton(
      final ? "Final season · 160/160" : `End turn · ${turnNumber(state)}/160`,
      () => {
        const request = ++navigationVersion;
        const building =
          target.type === "building"
            ? state.structures.find((s) => s.id === target.id)
            : undefined;
        const item = building
          ? structureSize(building)
          : (serviceLocations(state).find((s) => s.id === "home") ?? {
              width: 2,
              height: 2,
            });
        const reached = scene.travelTo(
          cell,
          item.width,
          item.height,
          true,
          "front",
          () => {
            if (request === navigationVersion) void act({ type: "season" });
          },
        );
        if (!reached) {
          serviceFeedback.textContent =
            "No walking path home. Move nearby buildings to clear access.";
          serviceFeedback.hidden = false;
          positionContext();
        }
      },
      final ||
        (target.type === "building" &&
          !!state.structures.find((s) => s.id === target.id)
            ?.pendingConstruction),
      "next-season",
    );
    button.setAttribute("aria-label", button.textContent!);
    if (state.season === "fall")
      note(
        `Winter is next. All ${state.plots.filter(Boolean).length} field crops will die. Harvest first.`,
      );
    note(
      `${state.plots.length} plots · +${policyProduction(seasonalIncome(state), policy)} coins / season`,
    );
    if (
      policy.allowWork !== false &&
      !state.plots.some(Boolean) &&
      state.coins <
        (state.plots.length
          ? Math.max(1, policyCost(seedCost(state, "turnip"), policy))
          : policyCost(expansionCost(state), policy) +
            Math.max(1, policyCost(seedCost(state, "turnip"), policy)))
    )
      tileButton(
        "Unload a seed delivery · +4 coins",
        () => void act({ type: "work" }),
        false,
        "work",
      );
  }
  tileActions.parentElement!.scrollTop = scroll;
  if (hadFocus)
    (
      document.getElementById(focused) ??
      document.querySelector<HTMLButtonElement>("#close-service")
    )?.focus({ preventScroll: true });
  positionContext();
}
document.querySelector("#close-service")!.addEventListener("click", () => {
  navigationVersion++;
  closeService();
});
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
const startup = document.querySelector<HTMLElement>("#startup")!;
const startupFontReady = document.fonts
  .load(
    '400 64px "Farm Pixel"',
    "What We Sow Inherit your farm Preparing your land… Reload farm",
  )
  .catch(() => [])
  .then(() => startup.classList.add("fonts-ready"));
const startupCopy = document.querySelector<HTMLElement>("#startup-copy")!;
const beginFarm = document.querySelector<HTMLButtonElement>("#begin-farm")!;
const loadingProgress =
  document.querySelector<HTMLProgressElement>("#loading-progress")!;
const sceneReady = new Promise<void>((resolve) => {
  scene.onReady = resolve;
});
scene.onProgress = (value) => {
  loadingProgress.value = value;
};
let artworkFailed = false;
function showArtworkError() {
  loadingProgress.hidden = true;
  startupCopy.hidden = false;
  startupCopy.textContent =
    "Some farm artwork could not load. Reload to try again.";
  beginFarm.textContent = "Reload farm";
  beginFarm.hidden = false;
}
scene.onLoadError = () => {
  artworkFailed = true;
  showArtworkError();
};
function enterFarm() {
  startup.hidden = true;
  document.querySelector<HTMLElement>("main")!.inert = false;
  viewport.focus({ preventScroll: true });
}
beginFarm.addEventListener("click", () => {
  if (artworkFailed) location.reload();
  else enterFarm();
});
document.querySelector<HTMLElement>("main")!.inert = true;
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
let saving = false;
let loadFailed = false;
let navigationVersion = 0;
let buildMode: BuildingKind | "plot" | null = null;
let movingId: number | null = null;
let movingPlotId: number | null = null;
let pickingPlot = false;
let centered = false;
const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2];
let zoomIndex = 2;
let zoom = zoomLevels[zoomIndex];
const viewport = document.querySelector<HTMLElement>("#farm")!;
function fitScreen() {
  const height =
    window.visualViewport?.scale === 1
      ? window.visualViewport.height
      : window.innerHeight;
  document.documentElement.style.setProperty(
    "--viewport-height",
    `${height}px`,
  );
  // Keyboard occlusion can reduce the visual viewport without resizing layout.
  document.documentElement.classList.toggle(
    "keyboard-open",
    height < window.innerHeight - 120,
  );
}
fitScreen();
window.visualViewport?.addEventListener("resize", fitScreen);
window.addEventListener("resize", fitScreen);
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
  positionContext();
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
  .addEventListener("click", () => setZoom(2));
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
for (const [direction, left, top] of [
  ["left", -160, 0],
  ["right", 160, 0],
  ["up", 0, -160],
  ["down", 0, 160],
] as const) {
  document.querySelector(`#pan-${direction}`)!.addEventListener("click", () => {
    viewport.scrollBy({ left, top, behavior: "instant" });
  });
}
function centerFarm() {
  const tent = serviceLocations(state).find((service) => service.tent);
  const p = projectCell(tent ?? { row: 16, col: 16 });
  viewport.scrollLeft = p.x * zoom - viewport.clientWidth / 2;
  let centerY = viewport.clientHeight / 2;
  if (tent) {
    const viewportTop = viewport.getBoundingClientRect().top;
    const top = Math.max(
      ...[".hud-top", "#farm-status"].map(
        (selector) =>
          document.querySelector(selector)!.getBoundingClientRect().bottom,
      ),
    );
    const bottom = document
      .querySelector(".hud-bottom")!
      .getBoundingClientRect().top;
    centerY = (top + bottom) / 2 - viewportTop + TENT_CENTER_OFFSET * zoom;
  }
  viewport.scrollTop = p.y * zoom - centerY;
}
document.querySelector("#home-view")!.addEventListener("click", centerFarm);
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
    setZoom(event.key === "0" ? 2 : zoomIndex + (event.key === "-" ? -1 : 1));
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
    // Explicit crop, building, and service ground targets keep their own interactions under roof overhangs.
    if (
      e.target instanceof Element &&
      e.target.closest("[data-plot], [data-service], [data-structure]")
    )
      return;
    const groundButton =
      e.target instanceof Element
        ? e.target.closest<HTMLButtonElement>("[data-cell]")
        : null;
    if (groundButton && !groundButton.hasAttribute("data-building")) {
      const [row, col] = groundButton.dataset.cell!.split(",").map(Number);
      // An open front path remains walkable even beneath another building's roof.
      if (
        state.structures.some((s) => {
          const item = { ...buildings[s.kind], ...structureSize(s) };
          return (
            (row === s.row + item.height &&
              col >= s.col &&
              col < s.col + item.width) ||
            (col === s.col + item.width &&
              row >= s.row &&
              row < s.row + item.height)
          );
        })
      )
        return;
    }
    const bounds = viewport.getBoundingClientRect();
    const x = (e.clientX - bounds.left + viewport.scrollLeft) / zoom;
    const y = (e.clientY - bounds.top + viewport.scrollTop) / zoom;
    // Match the visible artwork as well as its keyboard-accessible ground tiles.
    const services = serviceLocations(state).filter((s) =>
      s.tent
        ? scene.hitsTent({ x, y }, s)
        : scene.hitsBuilding(
            { x, y },
            s,
            s.frame,
            false,
            distinctServices[s.id],
          ),
    );
    const structures = state.structures.filter((s) => {
      const item = { ...buildings[s.kind], ...structureSize(s) };
      if (isAnimal(s.kind))
        return scene.hitsAnimal(
          { x, y },
          { ...s, kind: s.kind, width: item.width, height: item.height },
        );
      if (!isTree(s.kind))
        return scene.hitsBuilding(
          { x, y },
          { ...s, width: item.width, height: item.height },
          item.frame,
          !!(s.pendingConstruction || s.pendingUpgrade),
          distinctStructures[s.kind],
        );
      const point = projectCell(s),
        size = 64 * 1.08;
      return (
        Math.abs(x - point.x) < size * 0.32 &&
        y > point.y + 14 - size * 0.8 &&
        y < point.y + 14
      );
    });
    // Phaser paints larger depths last. Services are added after structures
    // at equal depth, so they also win equal-depth artwork hits.
    const hits = [
      ...structures.map((s) => ({
        depth: projectCell(
          isTree(s.kind)
            ? s
            : {
                row: s.row + structureSize(s).height - 0.5,
                col: s.col + structureSize(s).width - 0.5,
              },
        ).y,
        select: () => inspectBuilding(s.id),
      })),
      ...services.map((s) => ({
        depth: s.tent
          ? projectCell(s).y + 24
          : projectCell({
              row: s.row + s.height - 0.5,
              col: s.col + s.width - 0.5,
            }).y,
        select: () => openContext({ type: "service", id: s.id, cell: s }),
      })),
    ].sort((a, b) => a.depth - b.depth);
    const hit = hits.at(-1);
    if (hit) {
      e.preventDefault();
      e.stopImmediatePropagation();
      hit.select();
    }
  },
  true,
);
function inspectBuilding(id: number) {
  if (!state.structures.some((s) => s.id === id)) return;
  openContext({ type: "building", id });
}
function harvestSelectedTree(id: number) {
  const building = state.structures.find((s) => s.id === id);
  if (!building) return;
  if (
    (isTree(building.kind) || isAnimal(building.kind)) &&
    Boolean(building.product) &&
    !building.pendingConstruction
  ) {
    closeService();
    const request = ++navigationVersion;
    const item = { ...buildings[building.kind], ...structureSize(building) };
    const reached = scene.travelTo(
      building,
      item.width,
      item.height,
      true,
      "rear",
      () => {
        if (request === navigationVersion)
          void act({
            type: isAnimal(building.kind) ? "collectAnimal" : "harvestTree",
            id,
          });
      },
    );
    message.textContent = reached
      ? "Walking to collect produce."
      : "No walking path to this building.";
    return;
  }
}
function clearBuild() {
  buildMode = null;
  movingId = null;
  movingPlotId = null;
  pickingPlot = false;
  preview.hidden = true;
  buildingTooltip.hidden = true;
  document.querySelector("#placement-hint")!.textContent =
    "Choose open land as the destination. Escape or Cancel placement cancels.";
  render();
}
document.querySelector("#farm-mode")!.addEventListener("click", clearBuild);
const message = document.querySelector<HTMLElement>("#farm-message")!;
const seasonTransition = new SeasonTransition();
let endingTurn = false;
let farmQueue: Promise<void> = Promise.resolve();
function act(action: FarmAction | { type: "season" }) {
  if (endingTurn) return farmQueue;
  if (action.type === "season") endingTurn = true;
  const requestedNavigation = navigationVersion;
  farmQueue = farmQueue.then(async () => {
    try {
      const previous = state;
      const result =
        action.type === "season"
          ? advanceSeason(state)
          : actOnFarm(state, action, farmContext(state));
      if (action.type === "season" && result.state !== previous)
        await seasonTransition.cover(result.state as typeof state);
      await apply(
        action.type === "season"
          ? (result.state as typeof state)
          : replaceDomain(state, "micro", result.state),
        false,
        false,
        action.type === "harvest" ||
          action.type === "harvestTree" ||
          action.type === "collectAnimal",
      );
      if (action.type !== "season" && requestedNavigation === navigationVersion)
        scene.performAction(action, previous);
      if (
        action.type === "harvest" ||
        action.type === "harvestTree" ||
        action.type === "collectAnimal"
      ) {
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
      serviceFeedback.hidden = true;
      if (contextTarget && requestedNavigation === navigationVersion) {
        if (action.type === "build") {
          const built = state.structures.find(
            (s) =>
              s.kind === action.kind && cellKey(s) === cellKey(action.cell),
          );
          if (built) contextTarget = { type: "building", id: built.id };
        }
        if (contextTarget.type === "service" && contextTarget.id === "home") {
          const home = state.structures.find(
            (s) => s.kind === "home" && !s.pendingConstruction,
          );
          if (home) contextTarget = { type: "building", id: home.id };
        }
        refreshContext();
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
      if (action.type === "season") await seasonTransition.reveal();
    } catch (error) {
      message.textContent =
        error instanceof Error ? error.message : "Could not work the farm.";
      if (!servicePanel.hidden) {
        serviceFeedback.textContent = message.textContent;
        serviceFeedback.hidden = false;
        positionContext();
      }
    } finally {
      if (action.type === "season") {
        seasonTransition.clear();
        endingTurn = false;
      }
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
      footprint(s, structureSize(s).width, structureSize(s).height).map(
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
          openContext({ type: "service", id: service.id, cell: service });
          return;
        }
        const index = state.plotCells.findIndex((c) => cellKey(c) === key);
        if (index >= 0) {
          openTile(cell);
          return;
        }
        const building = state.structures.find((s) =>
          footprint(s, structureSize(s).width, structureSize(s).height).some(
            (c) => cellKey(c) === key,
          ),
        );
        if (building) {
          inspectBuilding(building.id);
          return;
        }
        openTile(cell);
      });
      button.addEventListener("pointerenter", (event) => {
        if (event.pointerType === "mouse") showPreview(target);
      });
      button.addEventListener("focus", () => {
        if (button!.matches(":focus-visible")) showPreview(target);
      });
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
          ? `${buildings[structure.kind].name} ${structure.id}, ${isAnimal(structure.kind) ? `${structure.pendingConstruction ? "under construction" : structure.product ? `${animalProducts[structure.kind].product} ready to collect` : "collected, return next season"}` : isTree(structure.kind) ? treeStatus(structure) : structure.pendingConstruction ? "under construction, ready next season" : `level ${structure.level}`}`
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
        footprint(s, structureSize(s).width, structureSize(s).height).some(
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
          ? { ...buildings[hovered.kind], ...structureSize(hovered) }
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
      ? { ...buildings[hovered.kind], ...structureSize(hovered) }.name
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
const params = new URLSearchParams(location.search);
const instance = import.meta.env.DEV
  ? (params.get("instance") ?? "default")
  : "player";
const namespace = import.meta.env.DEV ? `dev-${instance}` : "player";
let store: Awaited<ReturnType<typeof openSaveStore>> | undefined;
function render() {
  document.querySelector("#season")!.innerHTML =
    `<span class="sr-only">Year ${state.year} · ${state.season} · ${state.coins.toLocaleString()} coins</span><span class="calendar" aria-hidden="true">${icon(state.season === "summer" ? "sun" : state.season)}<span><small>Year ${state.year}</small>${state.season}</span></span><span class="coin-balance" aria-hidden="true">${icon("coin")}<span id="coin-count">${harvestFeedback.balance(state.coins).toLocaleString()}</span></span>`;
  scene.setState(state);
  const placing = Boolean(
    buildMode || movingId !== null || movingPlotId !== null || pickingPlot,
  );
  document.querySelector<HTMLElement>(".farm-tools")!.hidden = !placing;
  document.querySelector<HTMLButtonElement>("#farm-mode")!.hidden = !placing;
  document.querySelector<HTMLElement>("#placement-hint")!.hidden = !placing;
  const ready = state.plots.filter(
    (p) => p && p.growth >= crops[p.crop].steps,
  ).length;
  document.querySelector("#farm-summary")!.textContent =
    `${state.plots.length} plots · ${ready} ready to harvest · Soil level ${state.soilLevel}/3`;
  const emptyPlots = document.querySelector("#empty-plots")!;
  const empty = state.plots.filter((plot) => plot === null).length;
  emptyPlots.setAttribute("aria-label", `${empty} empty plots`);
  emptyPlots.innerHTML = `${icon("expand")}<span aria-hidden="true">${empty}</span>`;
  const growing = state.plots.filter(
    (plot) => plot && plot.growth < crops[plot.crop].steps,
  ).length;
  const growingPlots = document.querySelector("#growing-plots")!;
  growingPlots.setAttribute("aria-label", `${growing} growing crops`);
  growingPlots.innerHTML = `${icon("sprout")}<span aria-hidden="true">${growing}</span>`;
  const harvestReady = document.querySelector("#harvest-ready")!;
  harvestReady.setAttribute("aria-label", `${ready} plots ready to harvest`);
  harvestReady.innerHTML = `${icon("harvest")}<span aria-hidden="true">${ready}</span>`;
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
let newFarm = false;
try {
  store = await openSaveStore(namespace);
  const saved = await store.load();
  newFarm =
    saved === undefined ||
    (saved.selfBuilt === true &&
      saved.year === 1 &&
      saved.season === "spring" &&
      saved.coins === 240 &&
      saved.structures.length === 0 &&
      saved.plots.length === 0);
  state = saved ?? initialState();
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
  try {
    const exported = loadFailed && store ? await store.readRaw() : state;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(exported, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "what-we-sow-save.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : "Could not export save.";
  }
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
  const { mountCrisisTrial } = await import("./dev/crisis-trial");
  mountCrisisTrial();
}

await Promise.all([
  sceneReady,
  startupFontReady,
  document.fonts.ready,
  document
    .querySelector<HTMLImageElement>(".startup-landscape")!
    .decode()
    .catch(() => {}),
]);
render();
await new Promise<void>((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
);
if (artworkFailed) {
  showArtworkError();
} else if (newFarm && !loadFailed) {
  loadingProgress.hidden = true;
  startupCopy.hidden = true;
  beginFarm.hidden = false;
  beginFarm.focus();
  message.textContent = "Visit your tent to begin.";
} else enterFarm();
