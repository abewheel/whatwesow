import {
  distinctStructures,
  distinctServices,
  distinctBuildingRects,
} from "./game/building-artwork";
import { HarvestFeedback } from "./game/harvest-feedback";
import { treeFrames } from "./game/tree-sprites";
import { treeStatus } from "./micro/world";
import {
  canBuild,
  canPlant as cropUnlocked,
  hasOpportunity,
  opportunities,
  totalHarvests,
  upgradeRemaining,
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
import {
  buildings,
  constructionCost,
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
  actOnGame,
  initialState,
  parseState,
  farmContext,
  type GameState,
} from "./game/state";
import {
  answerCrisis,
  answerOffer,
  endTurn,
  pendingCrisis,
} from "./game/crisis";
import { mountCrisisDialog, type CouncilAnswer } from "./crisis/dialog";
import { councilFacts } from "./crisis/council";
import { openSaveStore } from "./storage/save";
import "./style.css";
import type { FarmAction } from "./micro/rules";
import type { FarmPolicy } from "./contracts/farm-policy";
import { canWork, plantQuote, saleQuote } from "./micro/money";
import {
  crops,
  canPlant,
  expansionCost,
  soilCost,
  growthSeasons,
  type CropId,
  type Plot,
} from "./micro/state";

/** A planted plot's state in words for its accessible name; colour never carries it alone. */
const plotCondition = (plot: NonNullable<Plot>) =>
  [
    plot.withered
      ? "withered"
      : plot.growth === crops[plot.crop].steps
        ? "ready to harvest"
        : `growing ${plot.growth}/${crops[plot.crop].steps}`,
    plot.dry && !plot.withered ? "dry" : "",
    plot.premium ? "premium seed" : "",
  ]
    .filter(Boolean)
    .join(", ");
/** Pending work waits extra seasons under a county permit delay. */
const readyIn = (wait = 0) =>
  wait ? `ready in ${wait + 1} seasons` : "ready next season";
/** A council rule's reason as its own sentence. */
const sentence = (reason: string) =>
  `${reason[0].toUpperCase()}${reason.slice(1)}.`;
/** While the council waits, the farm waits: every farm action is refused until it has an answer. */
const councilWaiting = "The council is waiting for your answer.";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<main><section class="farm-card" aria-label="Farm overview">
<div id="farm" tabindex="0" aria-label="Scrollable farm. Drag, use arrow keys, or scroll to explore."><div id="farm-world"><div id="farm-renderer"></div></div></div>
<header class="hud-top"><div class="farm-title"><h1>What We Sow</h1></div><output id="season"></output><button id="council-meeting" aria-haspopup="dialog" hidden>Council meeting</button><button id="open-menu" aria-haspopup="dialog" aria-label="Open farm menu">${icon("menu")}<span class="sr-only">Menu</span></button></header>
<div class="hud-bottom"><div class="field-note"><strong id="farm-message" role="status">Click a building to visit, or an empty plot to plant.</strong><span id="farm-summary" class="sr-only"></span><div id="farm-stats" aria-hidden="true"></div></div>
<section class="farm-tools" aria-label="Farming tools"><div class="work-tools mode-bar"><button id="seed-selection" aria-label="Choose seeds"></button><button id="farm-mode" hidden>Cancel placement</button><p id="placement-hint" hidden></p></div></section></div>
<div id="service-controls" hidden><div class="seed-shop"><div id="crop-options"></div><p id="crop-opportunity"></p></div><button id="next-season">End turn</button><p id="progression"></p><p id="frost-warning"></p><button id="work" hidden>Unload a seed delivery · +4 coins</button><button id="expand"></button><button id="improve"></button><button id="move-plot">Move a plot</button><details id="build-shop"><summary>Building plans</summary><details id="farm-news"><summary>Farm news</summary><div id="opportunity-notes"></div></details><div id="build-options"></div></details><p id="selected-building"></p><button id="upgrade-building" hidden></button><button id="move-building" hidden></button><button id="home-view">Center farm</button><span class="zoom-controls" role="group" aria-label="Farm zoom"><button id="zoom-out" aria-label="Zoom out">−</button><output id="zoom-level">100%</output><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-reset" aria-label="Reset zoom to 100 percent">Reset</button></span><label>Row <input id="view-row" aria-label="View row" type="number" min="0" max="63" value="16"></label><label>Column <input id="view-col" aria-label="View column" type="number" min="0" max="63" value="16"></label><button id="go-to-cell">Go to land</button></div>
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
// Keep only field work and view controls on the HUD. Services own their menus.
const servicePanel = document.createElement("section");
servicePanel.id = "service-panel";
servicePanel.hidden = true;
servicePanel.setAttribute("aria-labelledby", "service-title");
servicePanel.innerHTML = `<div class="service-heading"><h2 id="service-title"></h2><button id="close-service" aria-label="Close building menu">×</button></div><div class="service-body"><p id="service-description" class="sr-only"></p><div id="home-actions" hidden></div><div id="seed-actions" hidden></div><div id="builder-actions" hidden></div><div id="field-actions" hidden></div><div id="council-office" hidden><p id="permit-status"></p><button id="file-permit">File next season's permit · free</button></div></div>`;
document.querySelector(".farm-card")!.append(servicePanel);
const serviceFeedback = document.createElement("p");
serviceFeedback.id = "service-feedback";
serviceFeedback.hidden = true;
serviceFeedback.setAttribute("role", "alert");
document.querySelector(".service-heading")!.after(serviceFeedback);
function moveControls(target: string, selectors: string[]) {
  for (const selector of selectors)
    document.querySelector(target)!.append(document.querySelector(selector)!);
}
moveControls("#home-actions", [
  "#next-season",
  "#progression",
  "#frost-warning",
]);
const seasonGuide = document.createElement("p");
seasonGuide.id = "season-guide";
const nextOpportunity = document.createElement("p");
nextOpportunity.id = "next-opportunity";
const goals = document.createElement("details");
goals.innerHTML = "<summary>Next unlocks</summary>";
goals.append(nextOpportunity);
// The council's rules for this farm, and the trades a crisis opens up.
const councilSection = document.createElement("section");
councilSection.id = "council-rules";
councilSection.setAttribute("aria-labelledby", "council-rules-title");
councilSection.innerHTML = `<h3 id="council-rules-title">Council rules</h3><ul id="council-facts"></ul><div id="council-trades"><button id="buy-water"></button><button id="sell-water"></button><button id="lock-price"></button></div><ul id="council-standing" class="crisis-standing"></ul>`;
// Every building menu leads with the council while it waits, since farm actions wait too.
const councilWait = document.createElement("div");
councilWait.id = "council-waiting";
councilWait.innerHTML = `<p id="council-wait">${councilWaiting}</p><button id="council-return">Answer the council</button>`;
const councilReturn =
  councilWait.querySelector<HTMLButtonElement>("#council-return")!;
document.querySelector("#service-description")!.after(councilWait);
document
  .querySelector("#home-actions")!
  .append(seasonGuide, councilSection, goals);

moveControls("#seed-actions", [".seed-shop", "#work"]);
const premiumToggle = document.createElement("label");
premiumToggle.id = "premium-seed";
premiumToggle.innerHTML = `<input type="checkbox" id="premium-choice"><span>Premium seed<small id="premium-terms"></small></span>`;
document.querySelector("#crop-options")!.before(premiumToggle);
const premiumChoice =
  premiumToggle.querySelector<HTMLInputElement>("#premium-choice")!;
const premiumTerms =
  premiumToggle.querySelector<HTMLElement>("#premium-terms")!;
premiumChoice.addEventListener("change", () => {
  premium = premiumChoice.checked;
  render();
});
moveControls("#field-actions", ["#expand", "#improve", "#move-plot"]);
moveControls("#builder-actions", ["#build-shop"]);
document.querySelector<HTMLButtonElement>("#expand")!.dataset.build = "plot";
const saplings = document.createElement("div");
saplings.innerHTML = `<h3>Saplings & shade trees</h3><div id="sapling-options"></div>`;
document.querySelector("#seed-actions")!.append(saplings);
const inspection = document.createElement("section");
inspection.id = "structure-inspection";
inspection.innerHTML = `<h3 id="inspection-heading" class="sr-only">Your buildings</h3><label for="structure-target" id="inspection-label" class="sr-only">Choose a building</label><select id="structure-target"></select>`;
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
cameraControls.innerHTML = `<summary aria-label="View controls">${icon("grow")}<span>View</span></summary><div class="camera-panel"><div class="camera-heading"><h3>View</h3><button id="close-camera" aria-label="Close view controls">×</button></div><form id="coordinate-form"><p id="camera-error" role="status" hidden></p></form></div>`;
cameraControls.querySelector("#close-camera")!.addEventListener("click", () => {
  cameraControls.open = false;
  cameraControls
    .querySelector<HTMLElement>("summary")!
    .focus({ preventScroll: true });
});
document.querySelector(".work-tools")!.append(cameraControls);
moveControls(".camera-panel", ["#home-view", ".zoom-controls"]);
for (const input of ["#view-row", "#view-col"])
  document
    .querySelector("#coordinate-form")!
    .append(document.querySelector(input)!.closest("label")!);
moveControls("#coordinate-form", ["#go-to-cell"]);
document.querySelector<HTMLButtonElement>("#go-to-cell")!.type = "submit";
for (const id of ["#view-row", "#view-col"]) {
  const input = document.querySelector<HTMLInputElement>(id)!;
  input.required = true;
  input.step = "1";
  input.inputMode = "numeric";
  input.setAttribute("aria-describedby", "camera-error");
}
document.querySelector("#farm-mode")!.textContent = "Cancel placement";
function closeService() {
  if (!servicePanel.hidden) viewport.focus({ preventScroll: true });
  servicePanel.hidden = true;
}
const campActions = document.createElement("div");
campActions.className = "camp-actions";
for (const [service, label] of [
  ["builder", "Build your house"],
  ["fields", "Prepare fields"],
  ["seeds", "Choose seeds"],
] as const) {
  const button = document.createElement("button");
  button.innerHTML = `${icon(service === "builder" ? "build" : service === "fields" ? "expand" : "seeds")}<span>${service === "builder" ? "Build" : service === "fields" ? "Fields" : "Seeds"}</span>`;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", () => openService(service));
  campActions.append(button);
}
document.querySelector("#home-actions")!.prepend(campActions);
const backToCamp = document.createElement("button");
backToCamp.textContent = "Back to your tent";
backToCamp.addEventListener("click", () => openService("home"));
document.querySelector(".service-body")!.append(backToCamp);
let activeService: ServiceId | null = null;
let clearingAccess = false;
function openService(service: ServiceId, recovery = false) {
  serviceFeedback.hidden = true;
  clearingAccess = recovery;
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
  document.querySelector(".service-body")!.scrollTop = 0;
  updateServiceDetails(service);
  for (const [id, entry] of Object.entries(serviceMenus))
    document.getElementById(entry.container)!.hidden = id !== service;
  document
    .querySelector<HTMLButtonElement>("#close-service")!
    .focus({ preventScroll: true });
  if (service === "builder")
    document.querySelector<HTMLDetailsElement>("#build-shop")!.open = true;
}
function updateServiceDetails(service: ServiceId) {
  const menu = serviceMenus[service];
  const camping = !state.structures.some(
    (s) => s.kind === "home" && !s.pendingConstruction,
  );
  campActions.hidden = !camping && !state.selfBuilt;
  const homePlan = campActions.querySelector<HTMLButtonElement>("button")!;
  const buildingHome = state.structures.some(
    (s) => s.kind === "home" && s.pendingConstruction,
  );
  const homePlanLabel = buildingHome
    ? "House ready next season"
    : camping
      ? "Build your house"
      : "Building plans";
  homePlan.setAttribute("aria-label", homePlanLabel);
  homePlan.querySelector("span:last-child")!.textContent = buildingHome
    ? "Building…"
    : "Build";
  homePlan.disabled = buildingHome;
  backToCamp.hidden = (!camping && !state.selfBuilt) || service === "home";
  backToCamp.textContent = camping
    ? "Back to your tent"
    : "Back to the farmhouse";
  document.querySelector("#service-title")!.textContent =
    camping && service === "home" ? "Your tent" : menu.name;
  document.querySelector("#service-description")!.textContent =
    camping && service === "home"
      ? "Your first shelter on this land. Prepare fields, plant your first crop, and commission a house. Construction takes one season. Rest here to end the turn."
      : menu.description;
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
  .querySelector("#seed-selection")!
  .setAttribute("aria-label", "Open seed basket");
document.querySelector("#seed-selection")!.addEventListener("click", () => {
  const store = serviceLocations(state).find((s) => s.id === "seeds");
  const home = state.structures.find(
    (s) => s.kind === "home" && !s.pendingConstruction,
  );
  const tent = serviceLocations(state).find((s) => s.id === "home");
  const destination =
    store ??
    (home && {
      ...home,
      width: buildings.home.width,
      height: buildings.home.height,
    }) ??
    tent;
  if (destination) visit("seeds", destination);
});
document
  .querySelector("#close-service")!
  .addEventListener("click", closeService);
const layoutHelp = document.createElement("button");
layoutHelp.id = "layout-help";
layoutHelp.textContent = "Clear blocked access";
layoutHelp.addEventListener("click", () => {
  menu.close();
  navigationVersion++;
  clearBuild();
  openService("builder", true);
  message.textContent =
    "Choose a building and move it for free to clear a walking path.";
});
document.querySelector("#resume")!.before(layoutHelp);
document.addEventListener("keydown", (event) => {
  // Escape closes the council meeting on its own; the farm behind it stays as it was.
  if (event.key === "Escape" && !document.querySelector("#crisis[open]")) {
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
  // A crisis saved before the answer reopens once the farm is visible.
  if (pendingCrisis(state)) crisisDialog.open();
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
// Farm rules now: the macro policy merged with the council's, derived once per saved state.
let ruled: { state: GameState; context: ReturnType<typeof farmContext> } = {
  state,
  context: farmContext(state),
};
const rules = () => {
  if (ruled.state !== state) ruled = { state, context: farmContext(state) };
  return ruled.context;
};
/** Village services, with the council office while planting permits are required. */
const villageServices = () =>
  serviceLocations(state, { council: rules().policy.permitsRequired === true });
const harvestFeedback = new HarvestFeedback(state.coins);
let selected: CropId = "turnip";
let premium = false;
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
const coordinateForm =
  document.querySelector<HTMLFormElement>("#coordinate-form")!;
coordinateForm.noValidate = true;
document.querySelector(".camera-panel")!.append(coordinateForm);
coordinateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const inputs = ["#view-row", "#view-col"].map((id) =>
    document.querySelector<HTMLInputElement>(id)!,
  );
  const invalid = inputs.find((input) => !input.validity.valid);
  const error = document.querySelector<HTMLElement>("#camera-error")!;
  for (const input of inputs)
    input.setAttribute("aria-invalid", String(!input.validity.valid));
  const row = Number(
      document.querySelector<HTMLInputElement>("#view-row")!.value,
    ),
    col = Number(document.querySelector<HTMLInputElement>("#view-col")!.value);
  if (
    invalid ||
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    row < 0 ||
    col < 0 ||
    row >= WORLD_SIZE ||
    col >= WORLD_SIZE
  ) {
    error.hidden = false;
    error.textContent = "Enter a row and column from 0 to 63.";
    invalid?.focus();
    return;
  }
  error.hidden = true;
  const p = projectCell({ row, col });
  viewport.scrollLeft = p.x * zoom - viewport.clientWidth / 2;
  viewport.scrollTop = p.y * zoom - viewport.clientHeight / 2;
  viewport.focus({ preventScroll: true });
});
function centerFarm() {
  const p = projectCell({ row: 16, col: 16 });
  viewport.scrollLeft = p.x * zoom - viewport.clientWidth / 2;
  viewport.scrollTop = p.y * zoom - viewport.clientHeight / 2;
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
    // The council office is a drawn placeholder: its ground tiles take the clicks.
    const services = villageServices().filter(
      (s) =>
        s.id !== "council" &&
        scene.hitsBuilding(
          { x, y },
          s,
          s.frame,
          false,
          distinctServices[s.id as keyof typeof distinctServices],
        ),
    );
    const structures = state.structures.filter((s) => {
      const item = buildings[s.kind];
      if (!isTree(s.kind))
        return scene.hitsBuilding(
          { x, y },
          { ...s, width: item.width, height: item.height },
          item.frame,
          !!(s.pendingConstruction || s.pendingUpgrade),
          distinctStructures[s.kind],
        );
      const point = projectCell(s);
      const size = 64 * 1.08;
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
                row: s.row + buildings[s.kind].height - 0.5,
                col: s.col + buildings[s.kind].width - 0.5,
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
        select: () => visit(s.id, s),
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
  const building = state.structures.find((s) => s.id === id);
  if (!building) return;
  if (isTree(building.kind) && Boolean(building.product)) {
    closeService();
    if (pendingCrisis(state)) {
      message.textContent = councilWaiting;
      return;
    }
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
function planIcon(kind: BuildingKind) {
  if (kind === "apple" || kind === "oak") {
    const [x, y, width, height] = treeFrames[kind][2];
    return `<span class="plan-icon" aria-hidden="true" style="background-image:url('/art/${kind}-stages.png');background-size:${125400 / width}% ${125400 / height}%;background-position:${(x / (1254 - width)) * 100}% ${(y / (1254 - height)) * 100}%"></span>`;
  }
  const distinct = distinctStructures[kind];
  if (distinct !== undefined) {
    const [x, y, width, height] = distinctBuildingRects[distinct];
    return `<span class="plan-icon" aria-hidden="true" style="background-image:url('/art/distinct-buildings.png');background-size:${128000 / width}% ${128000 / height}%;background-position:${(x / (1280 - width)) * 100}% ${(y / (1280 - height)) * 100}%"></span>`;
  }
  const frame = buildings[kind].frame;
  return `<span class="plan-icon" aria-hidden="true" style="background-image:url('/art/farm-atlas.png');background-size:300% 200%;background-position:${(frame % 3) * 50}% ${Math.floor(frame / 3) * 100}%"></span>`;
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
    const { turn, policy } = rules();
    const seasons = growthSeasons(state, id as CropId, policy);
    message.textContent = `${crop.name} · ${seasons} season${seasons === 1 ? "" : "s"} to grow · Harvest ${saleQuote(state, id as CropId, policy, turn).value} coins.`;
  });
  cropOptions.append(button);
}
let farmQueue: Promise<void> = Promise.resolve();
function act(action: FarmAction | { type: "season" } | CouncilAnswer) {
  const requestedNavigation = navigationVersion;
  farmQueue = farmQueue.then(async () => {
    try {
      const previous = state;
      // End turn and council answers are whole-game transitions; farm actions change micro only.
      let result: { state: GameState; message: string };
      if (action.type === "season") result = endTurn(state);
      else if (action.type === "answer")
        result = answerCrisis(state, action.card);
      else if (action.type === "offer")
        result = answerOffer(state, action.accept);
      else result = actOnGame(state, action, rules());
      await apply(
        result.state,
        false,
        false,
        action.type === "harvest" || action.type === "harvestTree",
      );
      if (action.type === "answer" || action.type === "offer")
        crisisDialog.answered(result.message);
      else if (action.type === "season") {
        if (pendingCrisis(state)) crisisDialog.open();
      } else if (requestedNavigation === navigationVersion)
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
      serviceFeedback.hidden = true;
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
      if (action.type === "answer" || action.type === "offer")
        crisisDialog.fail(message.textContent);
      else if (!servicePanel.hidden) {
        serviceFeedback.textContent = message.textContent;
        serviceFeedback.hidden = false;
      }
    }
  });
  return farmQueue;
}
const crisisDialog = mountCrisisDialog(document.querySelector(".farm-card")!, {
  records: () => state.crises ?? [],
  answer: act,
  // The meeting's opener is often hidden or disabled once it closes: focus the way back
  // to it while it waits (on the HUD, or in the open menu on phones), else End turn, else the farm.
  onClose: () => {
    const endTurn = document.querySelector<HTMLButtonElement>("#next-season")!;
    // Not checkVisibility(): Safari before 17.4 lacks it.
    const shown = (el: HTMLElement) => el.getClientRects().length > 0;
    const target =
      [councilMeeting, councilReturn].find(shown) ??
      (shown(endTurn) && !endTurn.disabled ? endTurn : viewport);
    target.focus({ preventScroll: true });
  },
});
const councilMeeting =
  document.querySelector<HTMLButtonElement>("#council-meeting")!;
for (const button of [councilMeeting, councilReturn])
  button.addEventListener("click", () => crisisDialog.open());
scene.onLayout = (targets) => {
  const keys = new Set(targets.map(cellKey));
  for (const [key, button] of cellButtons)
    if (!keys.has(key)) {
      button.remove();
      cellButtons.delete(key);
    }
  const services = villageServices();
  const { policy } = rules();
  const taken = new Set((policy.takenCells ?? []).map(cellKey));
  const sealed = new Set(policy.sealedBuildings ?? []);
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
        const service = villageServices().find((s) =>
          footprint(s, s.width, s.height).some((c) => cellKey(c) === key),
        );
        if (service) {
          visit(service.id, service);
          return;
        }
        const index = state.plotCells.findIndex((c) => cellKey(c) === key);
        if (index >= 0) {
          closeService();
          // Planting and harvesting wait for the council; the HUD offers the way back to it.
          if (pendingCrisis(state)) {
            navigationVersion++;
            message.textContent = councilWaiting;
            return;
          }
          const request = ++navigationVersion;
          const plotId = state.plotIds[index],
            crop = selected,
            premiumSeed = premium && !!rules().policy.premiumSeed;
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
                : {
                    type: "plant",
                    plot: currentIndex,
                    crop,
                    ...(premiumSeed ? { premium: true as const } : {}),
                  },
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
    // Under crop rotation, an empty plot names the crop that cannot follow itself there.
    const last =
      index !== undefined && !plot && policy.rotation
        ? state.lastCrops?.[String(state.plotIds[index])]
        : undefined;
    const label =
      index !== undefined
        ? `Plot ${index + 1}: ${!plot ? `empty${last ? `, ${crops[last].name.toLowerCase()} grew here last` : ""}` : `${crops[plot.crop].name}, ${plotCondition(plot)}`}`
        : structure
          ? `${buildings[structure.kind].name} ${structure.id}, ${isTree(structure.kind) ? treeStatus(structure) : structure.pendingConstruction ? `under construction, ${readyIn(structure.wait)}` : `level ${structure.level}${sealed.has(structure.kind) ? ", sealed by the council" : ""}`}`
          : service
            ? `Visit ${service.name}`
            : `Land ${target.row},${target.col}${taken.has(key) ? ", taken by the county" : ""}`;
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
      ? villageServices().find((s) =>
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
  const fits = canPlace(layout, cell, item.width, item.height, rules().policy),
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
for (const [id, type] of [
  ["#buy-water", "buyWater"],
  ["#sell-water", "sellWater"],
  ["#lock-price", "lockPrice"],
  ["#file-permit", "filePermit"],
] as const)
  document
    .querySelector(id)!
    .addEventListener("click", () => void act({ type }));

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
  if (activeService) updateServiceDetails(activeService);
  if (!cropUnlocked(state, selected)) selected = "turnip";
  const owed = state.owed ?? 0;
  document.querySelector("#season")!.innerHTML =
    `<span class="sr-only">Year ${state.year} · ${state.season} · ${state.coins.toLocaleString()} coins${owed ? ` · ${owed.toLocaleString()} coins owed` : ""}</span><span class="calendar" aria-hidden="true">${icon(state.season === "summer" ? "sun" : state.season)}<span><small>Year ${state.year}</small>${state.season}</span></span><span class="coin-balance" aria-hidden="true">${icon("coin")}<span id="coin-count">${harvestFeedback.balance(state.coins).toLocaleString()}</span>${owed ? `<span id="owed">Owed ${owed.toLocaleString()}</span>` : ""}</span>`;
  const { turn, policy } = rules();
  // The scene draws the farm under the rules in force, the council's included.
  scene.setState({ ...state, farmPolicy: policy });
  const waiting = pendingCrisis(state) !== undefined;
  councilMeeting.hidden = councilWait.hidden = !waiting;
  crisisDialog.refresh();
  const placing = Boolean(
    buildMode || movingId !== null || movingPlotId !== null || pickingPlot,
  );
  document.querySelector<HTMLButtonElement>("#farm-mode")!.hidden = !placing;
  document.querySelector<HTMLElement>("#placement-hint")!.hidden = !placing;
  document.querySelector("#seed-selection")!.innerHTML =
    `${icon(selected)}<span>${crops[selected].name}</span>`;
  const nextSeason = document.querySelector<HTMLButtonElement>("#next-season")!;
  nextSeason.disabled = turn === 160 || waiting;
  // Described by the council's note only while that note is true.
  if (waiting) nextSeason.setAttribute("aria-describedby", "council-wait");
  else nextSeason.removeAttribute("aria-describedby");
  document.querySelector("#frost-warning")!.textContent =
    state.season === "fall"
      ? `Winter is next. Harvest now: all ${state.plots.filter(Boolean).length} field crops will die, including ripe crops. Trees survive.`
      : "Field crops die when winter begins. Harvest before ending fall.";
  document.querySelector("#next-season")!.textContent =
    turn === 160 ? "Final season · 160/160" : `End turn · ${turn}/160`;
  document.querySelector("#progression")!.innerHTML =
    `<span>${icon("expand")}${state.plots.length} plots</span><span>${icon("harvest")}${totalHarvests(state)} harvests</span><span>${icon("coin")}+${policyProduction(seasonalIncome(state, policy), policy)} / season</span>`;
  const ready = state.plots.filter(
    (p) => p && !p.withered && p.growth >= crops[p.crop].steps,
  ).length;
  const growing = state.plots.filter(
    (p) => p && !p.withered && p.growth < crops[p.crop].steps,
  ).length;
  const withered = state.plots.filter((p) => p?.withered).length;
  const planting = (Object.keys(crops) as CropId[])
    .filter(
      (id) =>
        cropUnlocked(state, id) &&
        canPlant(id, turn) &&
        !policy.recoveringCrops?.includes(id),
    )
    .map((id) => crops[id].name.toLowerCase());
  seasonGuide.textContent =
    turn === 160
      ? `Final winter · ${ready} ready to harvest`
      : `${ready} ready · ${growing} growing${withered ? ` · ${withered} withered` : ""} · ${planting.length ? `Plant ${planting.join(" or ")}` : state.season === "winter" ? "Winter · no planting" : "No planting this season"}`;
  nextOpportunity.textContent =
    turn === 160
      ? ""
      : (Object.keys(opportunities) as Opportunity[])
          .filter((id) => !hasOpportunity(state, id))
          .slice(0, 2)
          .map(
            (id) =>
              `${id === "corn" ? "Corn seeds" : id.startsWith("soil") ? "Soil improvement" : buildings[id as BuildingKind].name}: ${opportunities[id].need.toLowerCase()}.`,
          )
          .join(" ");
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
      button.textContent = `Crop plot · 1×1 · ${policyCost(expansionCost(state), policy)} coins`;
      button.disabled =
        waiting ||
        state.plots.length >= (policy.maxPlots ?? WORLD_CELLS) ||
        state.coins < policyCost(expansionCost(state), policy);
      continue;
    }
    const item = buildings[kind],
      count = state.structures.filter((s) => s.kind === kind).length;
    const available =
        canBuild(state, kind) ||
        policy.unlockedBuildings?.includes(kind) === true,
      cost = policyCost(constructionCost(state, kind), policy),
      limit = policy.buildingLimits?.[kind],
      delay = isTree(kind) ? 0 : (policy.buildDelay ?? 0);
    const payback =
      kind === "market"
        ? ` · ${policyProduction(item.income, policy) > 0 ? Math.ceil(cost / policyProduction(item.income, policy)) : "No"} seasons to repay · ${160 - turn} seasons left`
        : "";
    // Why the council's rules stop this plan, stated on the plan itself.
    const rule = policy.blockedBuildings?.includes(kind)
      ? "Not allowed by the council"
      : limit !== undefined && count >= limit
        ? "No more allowed by the council"
        : "";
    const label = `${item.name} · ${item.width}×${item.height} · ${cost} coins · ${!available ? (opportunities[kind as Opportunity]?.need ?? "Complete your farmhouse") : `${count} built`} · ${item.benefit} · ${readyIn(delay)}${payback}${rule ? ` · ${rule}` : ""}`;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = `${planIcon(kind)}<span class="plan-copy"><strong>${item.name}</strong><small>${item.benefit}</small><small>${item.width} × ${item.height} · ${count} built · ${delay ? `In ${delay + 1} seasons` : "Next season"}${payback}</small>${rule ? `<small class="plan-rule">${rule}</small>` : ""}</span><span class="tool-price">${icon("coin")}${cost.toLocaleString()}</span>`;
    button.hidden = !available || (kind === "home" && count > 0);
    button.disabled =
      waiting ||
      turn === 160 ||
      !available ||
      state.coins < cost ||
      policy.blockedBuildings?.includes(kind) === true ||
      (limit !== undefined && count >= limit);
  }
  saplings.hidden = !Array.from(
    document.querySelectorAll<HTMLButtonElement>("#sapling-options button"),
  ).some((b) => !b.hidden);
  document.querySelector<HTMLElement>("#build-shop")!.hidden = !Array.from(
    document.querySelectorAll<HTMLButtonElement>("#build-options button"),
  ).some((b) => !b.hidden);
  document.querySelector<HTMLElement>("#farm-news")!.hidden =
    state.opportunities.length === 0;
  goals.hidden = !nextOpportunity.textContent;
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
      .filter((s) => clearingAccess || isTree(s.kind) === orchard)
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
  inspection.hidden = target.options.length === 1;
  document.querySelector<HTMLElement>("#selected-building")!.hidden =
    !inspected;
  upgrade.hidden = !inspected || buildings[inspected.kind].levels === 1;
  move.hidden = !inspected;
  move.disabled = waiting;
  document.querySelector<HTMLButtonElement>("#move-plot")!.disabled = waiting;
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
    const returnHint =
      inspected.kind === "market" && inspected.level < item.levels
        ? ` Upgrade repays in ${policyProduction(item.income, policy) > 0 ? Math.ceil(cost / policyProduction(item.income, policy)) : "no"} seasons; ${160 - turn} seasons remain.`
        : "";
    document.querySelector("#selected-building")!.textContent =
      `${item.name} · Level ${inspected.level}/${item.levels}. ${item.benefit}. ${policy.sealedBuildings?.includes(inspected.kind) ? "Sealed by the council: no benefits. " : ""}${inspected.pendingConstruction ? `${readyIn(inspected.wait).replace("r", "R")}.` : inspected.pendingUpgrade ? `Level ${inspected.level + 1} ${inspected.wait ? `in ${inspected.wait + 1} seasons` : "next season"}.` : !remaining && inspected.level < item.levels ? "Ready to upgrade." : ""}${returnHint}`;
    upgrade.textContent = inspected.pendingConstruction
      ? isTree(inspected.kind)
        ? "Growing · ready next season"
        : `⚒ ${readyIn(inspected.wait).replace("r", "R")}`
      : inspected.pendingUpgrade
        ? `⚒ Upgrade underway · ${readyIn(inspected.wait)}`
        : inspected.level === item.levels
          ? "Fully upgraded"
          : policy.frozenUpgrades
            ? "Upgrades are frozen by the council"
            : `${isTree(inspected.kind) ? "Improve tree care" : "Upgrade"} · ${cost} coins${remaining ? ` · Harvest ${remaining} more ${inspected.kind === "mill" ? "corn crops" : "crops"}` : ""}`;
    upgrade.disabled =
      waiting ||
      !!inspected.pendingConstruction ||
      !!inspected.pendingUpgrade ||
      turn === 160 ||
      inspected.level === item.levels ||
      remaining > 0 ||
      state.coins < cost ||
      policy.frozenUpgrades === true ||
      policy.blockedBuildings?.includes(inspected.kind) === true;
  }

  document.querySelector("#crop-opportunity")!.textContent = cropUnlocked(
    state,
    "corn",
  )
    ? ""
    : "Eli is looking for a grower. Harvest a turnip and a carrot to hear his offer.";
  // Premium seed is on offer only while a council rule allows it.
  const offer = policy.premiumSeed;
  if (!offer) premium = false;
  premiumToggle.hidden = !offer;
  premiumChoice.checked = premium;
  premiumTerms.textContent = offer
    ? `Seed costs ${Math.round((offer.seed - 1) * 100)}% more · yields ${Math.round((offer.yield - 1) * 100)}% more · 1 planting in ${offer.failOneIn} fails`
    : "";
  for (const button of cropOptions.querySelectorAll<HTMLButtonElement>(
    "button",
  )) {
    const id = button.dataset.crop as CropId;
    button.setAttribute("aria-pressed", String(id === selected));
    const crop = crops[id];
    const seasons = growthSeasons(state, id, policy);
    const quote = plantQuote(state, id, policy, turn, premium),
      sale = saleQuote(state, id, policy, turn);
    const price = quote.seed + quote.fee;
    // The council's rules this planting breaks and the fine it costs, or why it is refused.
    const rule =
      quote.blocked ??
      (quote.reasons.length
        ? `${quote.reasons.map(sentence).join(" ")}${quote.fine ? ` Planting anyway costs a ${quote.fine}-coin fine.` : ""}`
        : rotationRule(id, policy, turn, premium));
    const earns = sale.overQuota
      ? "0 coins over this season's sales limit"
      : `${sale.value} coins${sale.tax ? ` after ${sale.tax} to the relief fund` : ""}${sale.held ? ", paid next season" : ""}`;
    const detail = !cropUnlocked(state, id)
      ? `${crop.name}: ${opportunities.corn.need}. Eli can find you seeds.`
      : `${crop.name}: ${price} coins to plant${quote.fee ? ` including a ${quote.fee}-coin fee` : ""}, ${seasons} season${seasons === 1 ? "" : "s"} to grow · Plant ${crop.plantingSeasons.join(" / ")}, harvest ${earns}.${crop.thirsty ? " Thirsty." : ""}${rule ? ` ${rule}` : ""} Harvest before winter frost.`;

    button.querySelector(".seed-price")!.innerHTML = `${icon("coin")}${price}`;
    button.disabled =
      waiting ||
      !cropUnlocked(state, id) ||
      !canPlant(id, turn) ||
      !!quote.blocked;
    button.setAttribute("aria-label", detail);
    button.querySelector(".control-detail")!.innerHTML = !cropUnlocked(
      state,
      id,
    )
      ? `<span>${opportunities.corn.need}</span>`
      : `<span>${icon("grow")}${seasons} season${seasons === 1 ? "" : "s"} to grow</span><span>${icon("harvest")}${earns}</span>${crop.thirsty ? '<span class="crop-tag thirsty">Thirsty</span>' : ""}<span class="planting-seasons" aria-label="Plant in ${crop.plantingSeasons.join(" or ")}">${crop.plantingSeasons.map((s) => `<span title="${s}">${icon(s === "summer" ? "sun" : (s as "spring" | "fall"))}</span>`).join("")}</span>${rule ? `<span class="crop-rule">${rule}</span>` : ""}`;
  }
  renderCouncil(turn, waiting);
  // Delivery work shows exactly when the farm rules allow it.
  const work = document.querySelector<HTMLButtonElement>("#work")!;
  work.hidden = !canWork(state, policy, turn);
  work.disabled = waiting;
  const expand = document.querySelector<HTMLButtonElement>("#expand")!;
  const expandLabel =
    state.plots.length === WORLD_CELLS
      ? "All plots open"
      : `Open a plot · ${policyCost(expansionCost(state), policy)} coins`;
  expand.setAttribute("aria-label", expandLabel);
  expand.title = expandLabel;
  expand.innerHTML = `${icon("expand")}<span>Expand</span><span class="tool-price" aria-hidden="true">${state.plots.length === WORLD_CELLS ? "✓" : `${icon("coin")}${policyCost(expansionCost(state), policy)}`}</span>`;
  expand.disabled =
    waiting ||
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
    waiting ||
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
  const soilStatus = state.pendingSoilUpgrade
    ? "Ready next season"
    : state.soilLevel === 3
      ? "Fully improved"
      : turn === 160
        ? "No next season"
        : !soilAvailable
          ? opportunities[soilOffer].need
          : "Next season";
  improve.innerHTML = `${icon("improve")}<span>Soil${state.soilLevel < 3 ? "<small>+3 / harvest</small>" : ""}<small id="soil-status">${soilStatus}</small></span><span class="tool-price" aria-hidden="true">${state.soilLevel === 3 ? "✓" : `${icon("coin")}${policyCost(soilCost(state), policy)}`}</span>`;
  document.querySelector("#farm-summary")!.textContent =
    `${state.plots.length} plots · ${ready} ready to harvest · Soil level ${state.soilLevel}/3`;
  document.querySelector("#farm-stats")!.innerHTML =
    `<span title="${state.plots.length} plots">${icon("expand")}${state.plots.length}</span><span title="${ready} ready to harvest">${icon("harvest")}${ready}</span><span title="Soil level ${state.soilLevel}/3">${icon("improve")}<span class="soil-meter">${[1, 2, 3].map((level) => `<i class="${level <= state.soilLevel ? "filled" : ""}"></i>`).join("")}</span></span>`;
}
/**
 * Crop rotation in the seed basket: the empty plots where this crop grew last, and what
 * planting it there costs. The council's assigned crop is exempt.
 */
function rotationRule(
  crop: CropId,
  policy: FarmPolicy,
  turn: number,
  premium: boolean,
) {
  if (!policy.rotation || policy.assignedCrops?.includes(crop)) return "";
  const plots = state.plots.flatMap((plot, i) =>
    !plot && state.lastCrops?.[String(state.plotIds[i])] === crop ? [i] : [],
  );
  if (!plots.length) return "";
  const there = plantQuote(state, crop, policy, turn, premium, plots[0]);
  return `${crops[crop].name} grew last in ${plots.length} empty plot${plots.length === 1 ? "" : "s"}. ${there.blocked ? "It cannot be planted there." : `Planting it there costs a ${there.fine}-coin fine.`}`;
}
/** The farmhouse's council rules and trades, and the council office's permit desk. */
function renderCouncil(turn: number, waiting: boolean) {
  const council = councilFacts(state, rules());
  councilSection.hidden =
    !state.crises?.length &&
    !council.facts.length &&
    !council.water &&
    !council.lock;
  document.querySelector("#council-facts")!.replaceChildren(
    ...council.facts.map((fact) => {
      const item = document.createElement("li");
      item.textContent = fact;
      return item;
    }),
  );
  const standingRules =
    document.querySelector<HTMLElement>("#council-standing")!;
  standingRules.hidden = !council.standing.length;
  standingRules.replaceChildren(
    ...council.standing.map((rule) => {
      const item = document.createElement("li");
      item.append(
        Object.assign(document.createElement("strong"), {
          textContent: `${rule.policy}:`,
        }),
        ` ${rule.text}`,
      );
      return item;
    }),
  );
  const buy = document.querySelector<HTMLButtonElement>("#buy-water")!,
    sell = document.querySelector<HTMLButtonElement>("#sell-water")!,
    lock = document.querySelector<HTMLButtonElement>("#lock-price")!;
  // Bought water reaches the crops growing now; one sale gives up the season's water.
  const water = council.water;
  buy.hidden = !water || (water.covered && water.traded !== "bought");
  sell.hidden = !water;
  if (water) {
    buy.textContent =
      water.traded === "bought" && !water.unwatered
        ? "Water bought this season"
        : `Buy water · ${water.buy} coins`;
    sell.textContent =
      water.traded === "sold"
        ? "Water rights sold this season"
        : `Sell water rights · +${water.sell}`;
    buy.disabled =
      waiting ||
      water.traded === "sold" ||
      !water.unwatered ||
      state.coins < water.buy;
    sell.disabled = waiting || !!water.traded || !water.thirsty;
  }
  lock.hidden = !council.lock;
  lock.textContent = council.lock?.label ?? "";
  lock.disabled = waiting;
  const permits = state.permits ?? [];
  document.querySelector("#permit-status")!.textContent =
    `This season: ${permits.includes(turn) ? "permit granted" : "no permit"}. Next season: ${permits.includes(turn + 1) ? "permit filed" : "not filed yet"}.`;
  const file = document.querySelector<HTMLButtonElement>("#file-permit")!;
  file.disabled = waiting || turn === 160 || permits.includes(turn + 1);
  file.textContent = permits.includes(turn + 1)
    ? "Next season's permit is filed"
    : "File next season's permit · free";
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
