import { hiveAnchor, hiveBounds } from "./game/hive-artwork";
import {
  cellAllowed,
  inBounds,
  debrisTypes,
  debrisFootprint,
  debrisAt,
} from "./micro/world";
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
  totalHarvests,
  type Opportunity,
} from "./micro/progression";
import { serviceMenus, isTree, type ServiceId } from "./game/services";
import { WORLD_CELLS } from "./contracts/world";
import {
  buildings,
  treeMaturity,
  structureSize,
  constructionCost,
  isAnimal,
  isProducer,
  buildingProducts,
  serviceLocations,
  serviceOptions,
  canPlace,
  cellKey,
  footprint,
  upgradeCost,
  policyCost,
  seasonalIncome,
  policyProduction,
  type Cell,
  type BuildingKind,
} from "./micro/world";
import Phaser from "phaser";
import { mountInventoryControls } from "./game/inventory-controls";
import { icon, type Icon } from "./game/icons";
import {
  FarmScene,
  TENT_CENTER_OFFSET,
  tentBounds,
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
import { councilFacts, waterFact } from "./crisis/council";
import { openSaveStore } from "./storage/save";
import "./style.css";
import { waterCrops, type FarmAction } from "./micro/rules";
import { waterInput } from "./game/crisis-rules";
import {
  canWork,
  plantQuote,
  saleQuote,
  seedQuote,
  previewSaleQuote,
  animalQuote,
  fruitQuote,
} from "./micro/money";
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
/** What a sale earns in words: over the limit, taxed, or held a season. */
const earnings = (sale: {
  value: number;
  tax: number;
  held: boolean;
  overQuota: boolean;
}) =>
  sale.overQuota
    ? "0 coins over this season's sales limit"
    : `${sale.value} coins${sale.tax ? ` after ${sale.tax} to the relief fund` : ""}${sale.held ? ", paid next season" : ""}`;
/** While the council waits, the farm waits: every farm action is refused until it has an answer. */
const councilWaiting = "The council is waiting for your answer.";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<main><section class="farm-card" aria-label="Farm overview">
<div id="farm" tabindex="0" aria-label="Farm. Drag to pan, scroll to zoom. WASD or arrow keys move the farmer; E or Space interacts ahead."><div id="farm-world"><div id="farm-renderer"></div></div></div>
<header class="hud-top"><div class="farm-title"><h1>What We Sow</h1></div><div class="hud-right"><div class="farm-overview"><output id="season"></output><section id="farm-status" aria-label="Farm status"><span id="empty-plots" role="img"></span><span id="growing-plots" role="img"></span><span id="harvest-ready" role="img"></span></section><div class="field-note"><strong id="farm-message" role="status">Tap a target, or use WASD/arrows then E/Space.</strong><span id="farm-summary" class="sr-only"></span></div></div><div class="corner-controls" role="group" aria-label="Farm controls"><button id="open-menu" aria-haspopup="dialog" aria-label="Open farm menu">${icon("menu")}<span class="sr-only">Menu</span></button><button id="open-actions" aria-label="Open action menu" aria-keyshortcuts="E Space" title="Interact ahead (E / Space)">${icon("build")}</button></div></div><button id="council-meeting" aria-haspopup="dialog" hidden>Council meeting</button></header>
<div class="hud-bottom">
<section class="farm-tools" aria-label="Farming tools"><div class="work-tools mode-bar"><button id="farm-mode" hidden>Cancel placement</button><p id="placement-hint" hidden></p></div></section></div>
<div id="service-controls" hidden><button id="home-view">Center farm</button><span class="zoom-controls" role="group" aria-label="Farm zoom"><button id="zoom-out" aria-label="Zoom out">−</button><output id="zoom-level">100%</output><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-reset" aria-label="Reset zoom to 100 percent">Reset</button></span></div>
<dialog id="farm-menu" aria-labelledby="menu-title"><form method="dialog" class="menu-heading"><h2 id="menu-title">Your farm</h2><button aria-label="Close farm menu">✕</button></form><div class="save-bar"><span id="save-status" role="status">Opening your farm…</span><div><button id="export">${icon("harvest")}Export save</button><button id="import-trigger">${icon("seeds")}Import save</button><input id="import" type="file" accept="application/json,.json" hidden /></div></div><button id="restart">${icon("restart")}Restart farm</button><button id="resume">${icon("home")}Back to the farm</button></dialog><dialog id="restart-confirm" aria-labelledby="restart-title"><h2 id="restart-title">Restart your farm?</h2><p>Your farm and progress will be erased.</p><div class="confirm-actions"><button id="cancel-restart">${icon("home")}Keep playing</button><button id="confirm-restart">${icon("restart")}Restart</button></div><p id="restart-error" role="alert"></p></dialog>

</section></main>`;
const menu = document.querySelector<HTMLDialogElement>("#farm-menu")!;
const menuButton = document.querySelector<HTMLButtonElement>("#open-menu")!;
menuButton.addEventListener("click", () => {
  // Safari does not focus buttons on click; dialogs restore their prior focus.
  menuButton.focus({ preventScroll: true });
  menu.showModal();
});
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
servicePanel.innerHTML = `<div class="service-heading"><h2 id="service-title"></h2><span id="destructive-slot"></span><button id="close-service" aria-label="Close actions">×</button></div><p id="service-feedback" role="alert" hidden></p><div class="service-body"><div id="tile-actions"></div></div>`;
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
  if (cameraControls.open) {
    releaseMovement();
    closeService();
  }
});
cameraControls.innerHTML = `<summary aria-label="View controls">${icon("view")}</summary><div class="camera-panel"><div class="camera-heading"><h3>View controls</h3><button id="close-camera" aria-label="Close view controls">×</button></div><div class="pan-controls" role="group" aria-label="Pan farm"><button id="pan-up" aria-label="Pan up">↑</button><button id="pan-left" aria-label="Pan left">←</button><button id="pan-down" aria-label="Pan down">↓</button><button id="pan-right" aria-label="Pan right">→</button></div></div>`;
cameraControls.querySelector("#close-camera")!.addEventListener("click", () => {
  cameraControls.open = false;
  cameraControls
    .querySelector<HTMLElement>("summary")!
    .focus({ preventScroll: true });
});
document.querySelector(".corner-controls")!.prepend(cameraControls);
document.querySelector("#open-actions")!.addEventListener("click", openActions);
moveControls(".camera-panel", ["#home-view", ".zoom-controls"]);
document.querySelector("#farm-mode")!.textContent = "Cancel placement";
const tileActions = document.querySelector<HTMLElement>("#tile-actions")!;
type ContextTarget =
  | { type: "cell"; cell: Cell }
  | { type: "shop"; cell: Cell }
  | { type: "inventory"; cell: Cell }
  | { type: "building"; id: number }
  | { type: "service"; id: ServiceId; cell: Cell };
let contextTarget: ContextTarget | null = null;
let placingKind: BuildingKind | null = null;
let placementLocked = false;
function openActions() {
  if (!startup.hidden || document.querySelector("dialog[open]")) return;
  if (
    !servicePanel.hidden &&
    contextTarget &&
    ["cell", "building", "service"].includes(contextTarget.type)
  ) {
    closeService();
    return;
  }
  const cell = scene.farmerFrontCell();
  if (cell && inBounds(cell)) openContext(tileContext(cell));
}

let shopQuantity = "1";
let shopPremium = false;
let planCategory = "farm";
let homeUpgrades = false;
function closeService() {
  homeUpgrades = false;
  if (contextTarget) navigationVersion++;
  contextTarget = null;
  document
    .querySelectorAll("[data-context]")
    .forEach((el) => el.removeAttribute("data-context"));
  if (!servicePanel.hidden) viewport.focus({ preventScroll: true });
  servicePanel.hidden = true;
  inventoryControls?.render();
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
      ? villageServices().find((s) => s.id === target.id)
      : undefined;
  if (building && isTree(building.kind)) {
    anchor = {
      left: x - 35 * zoom,
      right: x + 35 * zoom,
      top: y - 56 * zoom,
      bottom: y + 16 * zoom,
    };
  } else if (service?.id === "hive" || building?.kind === "beehive") {
    const lot = building
      ? { ...building, ...structureSize(building) }
      : service!;
    const art = hiveBounds(
      projectCell(hiveAnchor(lot)),
      service?.id === "hive",
    );
    anchor = {
      left: bounds.left - card.left + art.x * zoom - viewport.scrollLeft,
      right:
        bounds.left -
        card.left +
        (art.x + art.width) * zoom -
        viewport.scrollLeft,
      top: bounds.top - card.top + art.y * zoom - viewport.scrollTop,
      bottom: bounds.top - card.top + art.bottom * zoom - viewport.scrollTop,
    };
  } else if (service?.tent) {
    const art = tentBounds(service);
    anchor = {
      left: bounds.left - card.left + art.x * zoom - viewport.scrollLeft,
      right:
        bounds.left -
        card.left +
        (art.x + art.width) * zoom -
        viewport.scrollLeft,
      top: bounds.top - card.top + art.y * zoom - viewport.scrollTop,
      bottom:
        bounds.top -
        card.top +
        (art.y + art.height) * zoom -
        viewport.scrollTop,
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
      : distinctServices[service!.id as keyof typeof distinctServices];
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
  let topEdge = Math.max(margin, (visual?.offsetTop ?? 0) - card.top + margin);
  const bottomEdge = Math.min(
    card.height - margin,
    (visual?.offsetTop ?? 0) +
      (visual?.height ?? window.innerHeight) -
      card.top -
      margin,
  );
  const controlsBottom =
    document.querySelector(".corner-controls")!.getBoundingClientRect().bottom -
    card.top +
    margin;
  // Keep shortcuts reachable while leaving room for forms above a phone keyboard.
  if (bottomEdge - controlsBottom >= 200)
    topEdge = Math.max(topEdge, controlsBottom);
  if (bottomEdge - topEdge < 100 || rightEdge - leftEdge < 100) {
    // Focusing a form during keyboard resize can scroll the document before
    // the farm finishes shrinking. Keep that form open and restore its room.
    if (
      bottomEdge - topEdge < 100 &&
      rightEdge - leftEdge >= 100 &&
      window.scrollY > 0 &&
      servicePanel.contains(document.activeElement) &&
      document.activeElement?.matches("input, select, textarea")
    ) {
      window.scrollTo({ top: 0, behavior: "instant" });
      requestAnimationFrame(positionContext);
      return;
    }
    closeService();
    return;
  }
  const width = Math.min(300, rightEdge - leftEdge);
  servicePanel.style.width = `${width}px`;
  const panelLimit = tileActions.querySelector(".seed-grid")
    ? bottomEdge - topEdge
    : 440;
  servicePanel.style.maxHeight = `${Math.min(panelLimit, bottomEdge - topEdge)}px`;
  const height = servicePanel.getBoundingClientRect().height;
  const rightSpace = rightEdge - anchor.right - gap;
  const leftSpace = anchor.left - leftEdge - gap;
  const rightFits = rightSpace >= width;
  const leftFits = leftSpace >= width;
  const farmer = scene.farmerPosition();
  const farmerX = farmer
    ? bounds.left - card.left + farmer.x * zoom - viewport.scrollLeft
    : x;
  const farmerY = farmer
    ? bounds.top - card.top + farmer.y * zoom - viewport.scrollTop
    : y;
  // Keep the menu across the target from the farmer when that side fits.
  // If the farmer stands directly above or below it, use the wider side.
  const preferRight =
    Math.abs(farmerX - x) > 24 * zoom ? farmerX < x : rightSpace >= leftSpace;
  let left: number, top: number;
  if (rightFits || leftFits) {
    const useRight = rightFits && (!leftFits || preferRight);
    left = useRight ? anchor.right + gap : anchor.left - gap - width;
    top = (anchor.top + anchor.bottom) / 2 - Math.min(height / 2, 80);
  } else {
    left = x - width / 2;
    const below = bottomEdge - anchor.bottom - gap,
      above = anchor.top - topEdge - gap;
    const available = tileActions.querySelector(".seed-grid")
      ? bottomEdge - topEdge
      : Math.max(Math.min(240, bottomEdge - topEdge), Math.max(below, above));
    servicePanel.style.maxHeight = `${Math.min(panelLimit, available)}px`;
    const actualHeight = servicePanel.getBoundingClientRect().height;
    top =
      (farmerY < y && below >= actualHeight) || above < actualHeight
        ? anchor.bottom + gap
        : anchor.top - gap - actualHeight;
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
  art: Icon = "build",
  copy = label,
) {
  const button = document.createElement("button");
  button.setAttribute("aria-label", label);
  button.innerHTML = copy.includes("pixel-icon")
    ? copy
    : `${icon(art)}<span>${copy}</span>`;
  button.disabled = disabled;
  if (id) button.id = id;
  button.addEventListener("click", action);
  tileActions.append(button);
  return button;
}
function note(text: string, id?: string) {
  const p = document.createElement("p");
  p.textContent = text;
  if (id) p.id = id;
  tileActions.append(p);
}
const deleteConfirm = document.createElement("dialog");
deleteConfirm.id = "delete-confirm";
deleteConfirm.setAttribute("aria-labelledby", "delete-title");
deleteConfirm.innerHTML = `<h2 id="delete-title"></h2><p id="delete-description"></p><div class="confirm-actions"><button id="cancel-delete" autofocus>Keep it</button><button id="confirm-delete">${icon("teardown")}Remove</button></div>`;
document.body.append(deleteConfirm);
let pendingDelete: FarmAction | undefined;
deleteConfirm
  .querySelector("#cancel-delete")!
  .addEventListener("click", () => deleteConfirm.close());
deleteConfirm.addEventListener("close", () => {
  pendingDelete = undefined;
});
deleteConfirm
  .querySelector("#confirm-delete")!
  .addEventListener("click", () => {
    const action = pendingDelete;
    pendingDelete = undefined;
    deleteConfirm.close();
    if (action) {
      scene.stopFarmer();
      void act(action);
    }
  });
function deleteControl(
  label: string,
  name: string,
  action: FarmAction,
  disabled: boolean,
  id: string,
) {
  const button = tileButton(
    label,
    () => {
      pendingDelete = action;
      deleteConfirm.querySelector("#delete-title")!.textContent =
        action.type === "deletePlot"
          ? "Delete this field?"
          : `Tear down ${name}?`;
      deleteConfirm.querySelector("#delete-description")!.textContent =
        action.type === "deletePlot"
          ? "This removes the field and any crop on it immediately. You will not receive a refund."
          : "This clears the space next season. Any produce and paid work will be lost. You will not receive a refund.";
      deleteConfirm
        .querySelector("#confirm-delete")!
        .setAttribute(
          "aria-label",
          action.type === "deletePlot"
            ? "Confirm delete field"
            : "Confirm teardown",
        );
      button.focus({ preventScroll: true });
      deleteConfirm.showModal();
    },
    disabled,
    id,
    "teardown",
    icon("teardown"),
  );
  button.className = "delete-control";
  document.querySelector("#destructive-slot")!.append(button);
}
function progressionSummary() {
  note(
    `${totalHarvests(state)} crops harvested · ${state.harvests.corn} corn · ${state.plots.length} plots · Soil ${state.soilLevel}/3`,
    "progression-counts",
  );
}
function workPlot(cell: Cell, crop?: CropId, premiumSeed = false) {
  closeService();
  const index = state.plotCells.findIndex((c) => cellKey(c) === cellKey(cell));
  if (index < 0) return;
  const plotId = state.plotIds[index],
    request = ++navigationVersion;
  const reached = scene.travelTo(cell, 1, 1, true, "nearest", () => {
    if (request !== navigationVersion) return;
    const current = state.plotIds.indexOf(plotId);
    if (current < 0 || cellKey(state.plotCells[current]) !== cellKey(cell))
      return;
    void act(
      crop
        ? {
            type: "plant",
            plot: current,
            crop,
            ...(premiumSeed ? { premium: true as const } : {}),
          }
        : { type: "harvest", plot: current },
    );
  });
  message.textContent = reached
    ? `Walking to ${crop ? "plant" : "harvest"} this plot.`
    : "No walking path to this plot.";
}
function startConstruction(kind: BuildingKind, cell: Cell) {
  const request = ++navigationVersion;
  const item = buildings[kind];
  const reached = scene.travelTo(
    cell,
    item.width,
    item.height,
    true,
    "nearest",
    () => {
      if (request !== navigationVersion) return;
      clearBuild();
      const committedNavigation = navigationVersion;
      void act({ type: "build", kind, cell }).then(() => {
        const built = state.structures.find(
          (s) => s.kind === kind && cellKey(s) === cellKey(cell),
        );
        if (built && navigationVersion === committedNavigation)
          openContext({ type: "building", id: built.id }, false);
      });
    },
    true,
  );
  if (!reached) {
    placementLocked = false;
    message.textContent =
      "No walking path to start this building. Choose another lot.";
    return;
  }
  // Keep the chosen lot visible while the farmer steps out of its future
  // footprint. The new building must never force a reset back to spawn.
  for (const button of tileActions.querySelectorAll<HTMLButtonElement>(
    "button",
  ))
    button.disabled = true;
  message.textContent = `Walking to start ${item.name.toLowerCase()}.`;
}
function openSeedShop() {
  viewport.scrollIntoView({ block: "start" });
  const destination =
    villageServices().find((s) => s.id === "seeds") ??
    state.structures.find(
      (s) =>
        s.kind === "home" && !s.pendingConstruction && !s.pendingDemolition,
    ) ??
    villageServices().find((s) => s.id === "home");
  if (destination) openContext({ type: "shop", cell: destination });
}
function openInventory() {
  viewport.scrollIntoView({ block: "start" });
  const cell = state.structures.find(
    (s) => s.kind === "home" && !s.pendingDemolition,
  ) ??
    villageServices().find((s) => s.id === "home") ?? { row: 16, col: 16 };
  openContext({ type: "inventory", cell });
}
const restartConfirm =
  document.querySelector<HTMLDialogElement>("#restart-confirm")!;
document
  .querySelector("#restart")!
  .addEventListener("click", () => restartConfirm.showModal());
document
  .querySelector("#cancel-restart")!
  .addEventListener("click", () => restartConfirm.close());
document
  .querySelector("#confirm-restart")!
  .addEventListener("click", async () => {
    const button =
      document.querySelector<HTMLButtonElement>("#confirm-restart")!;
    button.disabled = true;
    try {
      await farmQueue;
      navigationVersion++;
      scene.stopFarmer();
      await apply(
        { ...initialState(), farmerVariant: state.farmerVariant },
        true,
        true,
      );
      restartConfirm.close();
      menu.close();
      centerFarm();
    } catch (error) {
      document.querySelector("#restart-error")!.textContent =
        error instanceof Error ? error.message : "Could not restart.";
    } finally {
      button.disabled = false;
    }
  });
/** Shared dispatch keeps explicit actions and direct entity visits consistent. */
function tileContext(cell: Cell): ContextTarget {
  const key = cellKey(cell);
  const service = villageServices().find((s) =>
    footprint(s, s.width, s.height).some((c) => cellKey(c) === key),
  );
  if (service) return { type: "service", id: service.id, cell: service };
  const building = state.structures.find((s) =>
    footprint(s, structureSize(s).width, structureSize(s).height).some(
      (c) => cellKey(c) === key,
    ),
  );
  return building
    ? { type: "building", id: building.id }
    : { type: "cell", cell };
}
function openContext(target: ContextTarget, travel = true) {
  releaseMovement();
  if (travel && harvestTarget(target)) return;
  closeService();
  cameraControls.open = false;
  clearBuild();
  const request = ++navigationVersion;
  contextTarget = target;
  if (target.type === "cell") planCategory = "farm";
  const destination = contextCell();
  if (destination) {
    highlightContext(destination);
  }
  const show = () => {
    if (request !== navigationVersion || contextTarget !== target) return;
    serviceFeedback.hidden = true;
    refreshContext();
    servicePanel.hidden = false;
    inventoryControls?.render();
    positionContext();
    document
      .querySelector<HTMLButtonElement>("#close-service")!
      .focus({ preventScroll: true });
  };
  if (travel && destination && target.type !== "inventory") {
    const structure =
      target.type === "building"
        ? state.structures.find((s) => s.id === target.id)
        : undefined;
    const service =
      target.type === "service"
        ? villageServices().find((s) => s.id === target.id)
        : target.type === "shop"
          ? villageServices().find((s) => cellKey(s) === cellKey(destination))
          : undefined;
    const house =
      target.type === "shop"
        ? state.structures.find((s) => cellKey(s) === cellKey(destination))
        : undefined;
    const debris =
      target.type === "cell" ? debrisAt(state.debris, destination) : undefined;
    const lot = structure
      ? structureSize(structure)
      : house
        ? structureSize(house)
        : debris
          ? debrisTypes[debris.kind]
          : (service ?? { width: 1, height: 1 });
    const reached = scene.travelTo(
      debris ?? destination,
      lot.width,
      lot.height,
      true,
      "nearest",
      show,
    );
    if (!reached) {
      contextTarget = null;
      message.textContent = "No walking path to this tile.";
    }
    return;
  }
  show();
}
function highlightContext(cell: Cell) {
  document
    .querySelectorAll("[data-context]")
    .forEach((el) => el.removeAttribute("data-context"));
  const target = contextTarget;
  const structure =
    target?.type === "building"
      ? state.structures.find((s) => s.id === target.id)
      : undefined;
  const service =
    target?.type === "service"
      ? villageServices().find((s) => s.id === target.id)
      : undefined;
  const debris = debrisAt(state.debris, cell);
  const cells = structure
    ? footprint(
        structure,
        structureSize(structure).width,
        structureSize(structure).height,
      )
    : service
      ? footprint(service, service.width, service.height)
      : debris
        ? debrisFootprint(debris)
        : [cell];
  for (const selected of cells)
    cellButtons.get(cellKey(selected))?.setAttribute("data-context", "true");
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
  document.querySelector("#destructive-slot")!.replaceChildren();
  highlightContext(cell);
  const { turn, policy, drought, water } = rules(),
    final = turn === 160,
    waiting = pendingCrisis(state) !== undefined;
  const blockedMetric = (blocked: boolean) =>
    blocked ? " action-blocker" : "";
  const buildingBenefit = (kind: BuildingKind) =>
    isProducer(kind)
      ? ""
      : isTree(kind)
        ? "Harvest each fall"
        : buildings[kind].benefit;
  const accessibleBenefit = (kind: BuildingKind) =>
    buildings[kind].benefit.replace(/: \d+ coins(?: per level)?/, "");
  const benefitMarkup = (kind: BuildingKind) =>
    `${isTree(kind) ? `<span class="tree-maturity resource" aria-label="First harvest after ${treeMaturity(kind) / 4} years">${icon("sprout")}${treeMaturity(kind) / 4}y</span>` : ""}${buildingBenefit(kind) ? `<small class="plan-benefit">${buildingBenefit(kind)}</small>` : ""}`;
  const harvestPrice = (kind: BuildingKind, level = 1) => {
    if (!isTree(kind) && !isProducer(kind)) return "";
    const structure = { kind, level, id: 0, row: 0, col: 0 };
    const sale = isTree(kind)
      ? fruitQuote(state, structure, policy, turn)
      : animalQuote(state, structure, policy, turn);
    return `<span class="resource harvest-price" aria-label="Harvest sells for ${earnings(sale)}">${icon("harvestValue")}${sale.value}</span>`;
  };
  // Every menu leads with the council while it waits, since farm actions wait too.
  if (waiting) {
    const wait = document.createElement("div");
    wait.id = "council-waiting";
    wait.innerHTML = `<p id="council-wait">${councilWaiting}</p><button id="council-return">${icon("home")}Answer the council</button>`;
    wait
      .querySelector("#council-return")!
      .addEventListener("click", () => crisisDialog.open());
    tileActions.append(wait);
  }
  const title = document.querySelector("#service-title")!;
  const home =
    target.type === "service"
      ? target.id === "home"
      : target.type === "building" &&
        state.structures.find((s) => s.id === target.id)?.kind === "home";
  const shop =
    target.type === "shop" ||
    (target.type === "service" && target.id === "seeds");
  if (home && homeUpgrades) {
    title.textContent = "Farm upgrades";
    tileButton(
      "Back to home",
      () => {
        homeUpgrades = false;
        refreshContext();
      },
      false,
      "back-home",
      "home",
      "Back to home",
    );
    note(
      `Soil level ${state.soilLevel}/3 · +${state.soilLevel * 3} coins per harvest on every plot.`,
      "soil-level",
    );
    const offer = `soil${state.soilLevel + 1}` as Opportunity,
      available = state.soilLevel < 3 && hasOpportunity(state, offer),
      soilPrice = policyCost(soilCost(state), policy),
      soilStatus = state.pendingSoilUpgrade
        ? "Underway · ready next season"
        : state.soilLevel === 3
          ? "Fully improved"
          : final
            ? "No next season to finish"
            : !available
              ? opportunities[offer].need
              : state.coins < soilPrice
                ? `Need ${soilPrice - state.coins} more coins`
                : "Ready next season";
    tileButton(
      `Improve soil · +3 coins per harvest on all plots · ${soilStatus}${!state.pendingSoilUpgrade && state.soilLevel < 3 ? ` · ${soilPrice} coins` : ""}`,
      () => void act({ type: "improve" }),
      waiting ||
        !!state.pendingSoilUpgrade ||
        final ||
        !available ||
        state.coins < soilPrice,
      "improve",
      "improve",
      `${icon("improve")}<strong>Improve soil</strong>${!state.pendingSoilUpgrade && state.soilLevel < 3 ? `<span class="resource soil-price${blockedMetric(state.coins < soilPrice)}">${icon("coin")}${soilPrice}</span>` : ""}<small>+3 coins / harvest on all plots</small><small class="soil-status${blockedMetric((!available && state.soilLevel < 3) || final || !!state.pendingSoilUpgrade || state.coins < soilPrice)}">${!available && state.soilLevel < 3 ? icon("locked") : final || state.pendingSoilUpgrade ? icon("duration") : ""}${soilStatus}</small>`,
    );
    const upcoming = document.createElement("section");
    upcoming.className = "upcoming-unlocks";
    upcoming.innerHTML = "<h3>Next unlocks</h3>";
    progressionSummary();
    tileActions.append(upcoming);
    for (const id of Object.keys(opportunities) as Opportunity[]) {
      if (hasOpportunity(state, id)) continue;
      const entry = document.createElement("p");
      const name = id.startsWith("soil")
        ? `Soil level ${id.slice(-1)}`
        : id === "corn"
          ? "Corn seeds"
          : buildings[id as BuildingKind].name;
      const benefit = id.startsWith("soil")
        ? "+3 coins per harvest on every plot"
        : id === "corn"
          ? "Grow corn in spring and summer"
          : benefitMarkup(id as BuildingKind);
      entry.innerHTML = `<strong>${name}</strong><span class="action-blocker">${icon("locked")}<span>${opportunities[id].need}</span></span><small>${benefit}</small>`;
      upcoming.append(entry);
    }
    if (upcoming.children.length === 1)
      upcoming.insertAdjacentHTML(
        "beforeend",
        "<p>All farming opportunities unlocked.</p>",
      );
  } else if (target.type === "inventory") {
    title.textContent = "Inventory";
    const grid = document.createElement("div");
    grid.className = "seed-grid stock-grid";
    for (const id of Object.keys(crops) as CropId[]) {
      if (!state.seeds[id] && !state.premiumSeeds[id]) continue;
      const card = document.createElement("div");
      card.className = "stock-card";
      card.dataset.inventoryCrop = id;
      card.innerHTML = `${icon(id)}<strong>${crops[id].name} seeds</strong>${state.seeds[id] ? `<span>${icon("seeds")}${state.seeds[id]}</span>` : ""}${state.premiumSeeds[id] ? `<span class="premium-stock">★ ${state.premiumSeeds[id]}</span>` : ""}`;
      card.setAttribute(
        "aria-label",
        `${crops[id].name}: ${state.seeds[id]} seeds, ${state.premiumSeeds[id]} premium seeds`,
      );
      grid.append(card);
    }
    if (grid.children.length) tileActions.append(grid);
    else note("You’re not holding anything.", "inventory-empty");
    tileButton(
      "Open seed shop",
      openSeedShop,
      false,
      "open-seed-shop",
      "seeds",
      "Shop",
    );
  } else if (shop) {
    title.textContent = "Seed shop";
    if (state.owed)
      note(`Sales first repay ${state.owed} coins owed.`, "sale-debt-note");
    if (!policy.premiumSeed) shopPremium = false;
    const controls = document.createElement("div");
    controls.className = "shop-controls";
    controls.innerHTML = `<label class="quantity-control"><span aria-hidden="true">${icon("seeds")} ×</span><input id="seed-quantity" type="number" min="1" max="999" step="1" inputmode="numeric" aria-label="Seed quantity" value="${shopQuantity}" /></label><span id="quantity-error" role="alert"></span>`;
    tileActions.append(controls);
    if (policy.premiumSeed) {
      const qualities = document.createElement("div");
      qualities.className = "seed-qualities";
      for (const premium of [false, true]) {
        const button = document.createElement("button");
        button.dataset.seedQuality = premium ? "premium" : "regular";
        button.setAttribute("aria-pressed", String(shopPremium === premium));
        button.innerHTML = `${icon("seeds")}${premium ? "★ Premium" : "Seeds"}`;
        button.addEventListener("click", () => {
          shopPremium = premium;
          refreshContext();
        });
        qualities.append(button);
      }
      tileActions.append(qualities);
      if (shopPremium)
        note(
          `Premium: +${Math.round((policy.premiumSeed.yield - 1) * 100)}% yield; 1 in ${policy.premiumSeed.failOneIn} may fail.`,
        );
    }
    if (policy.plantingFee)
      note(
        `Planting fee: ${policy.plantingFee} coins per plot, paid when planted.`,
      );
    const grid = document.createElement("div");
    grid.className = "seed-grid";
    tileActions.append(grid);
    for (const id of Object.keys(crops) as CropId[]) {
      const premium = shopPremium,
        unit = seedQuote(state, id, policy, premium),
        sale = previewSaleQuote(
          { ...state, seasonSales: undefined },
          id,
          policy,
          turn,
          premium,
        ),
        quote = plantQuote(state, id, policy, turn, premium);
      const rule =
        quote.blocked ??
        (quote.reasons.length
          ? `${quote.reasons.map(sentence).join(" ")}${quote.fine ? ` Planting anyway costs a ${quote.fine}-coin fine.` : ""}`
          : "");
      const button = tileButton(
        `Buy ${premium ? "Premium " : ""}${crops[id].name} seeds`,
        () => {
          const quantity = Number(shopQuantity);
          if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999)
            return;
          void act({
            type: "buySeeds",
            crop: id,
            quantity,
            ...(premium ? { premium: true as const } : {}),
          });
        },
        false,
        `buy-${premium ? "premium-" : ""}${id}`,
        "seeds",
      );
      if (premium) button.dataset.buyPremium = id;
      else button.dataset.buySeed = id;
      button.dataset.unitPrice = String(unit);
      const drySale = previewSaleQuote(
        { ...state, seasonSales: undefined },
        id,
        policy,
        turn,
        premium,
        false,
        true,
      );
      const saleRange = crops[id].thirsty
        ? `<span class="seed-sale-range" data-dry="${drySale.value}" data-wet="${sale.value}" role="img" aria-label="Harvest at current prices: ${earnings(drySale)} if dried during growth; ${earnings(sale)} without drought damage"><span>${icon("dryWater")}${drySale.value}</span><span aria-hidden="true">–</span><span>${icon("water")}${sale.value}</span>${icon("coin")}</span>`
        : `<span class="resource">${icon("harvestValue")}${sale.value}</span>`;
      button.dataset.saleDescription = crops[id].thirsty
        ? `${earnings(sale)} without drought damage, ${earnings(drySale)} dry, at current prices`
        : earnings(sale);
      button.innerHTML = `${icon(id)}<strong>${premium ? "★ " : ""}${crops[id].name}</strong><span class="shop-price"></span><span class="seed-stock">${icon("seeds")}${premium ? state.premiumSeeds[id] : state.seeds[id]}</span><span class="control-detail"><span class="resource${blockedMetric(final)}">${icon("duration")}${growthSeasons(state, id, policy)}</span> ${crops[id].plantingSeasons.map((season) => icon(season === "summer" ? "sun" : season)).join("")} ${saleRange}${sale.tax ? `<small>−${sale.tax} tax</small>` : ""}${sale.held ? "<small>Next season</small>" : ""}${sale.overQuota ? "<small>Sales limit</small>" : ""}</span>${rule ? `<span class="crop-rule">${rule}</span>` : ""}${!cropUnlocked(state, id) ? `<span class="crop-rule action-blocker">${icon("locked")}${opportunities.corn.need}</span>` : ""}`;
      grid.append(button);
    }
    const update = () => {
      const count = Number(shopQuantity),
        valid =
          shopQuantity.trim() !== "" &&
          Number.isInteger(count) &&
          count >= 1 &&
          count <= 999;
      controls
        .querySelector<HTMLInputElement>("input")!
        .setAttribute("aria-invalid", String(!valid));
      controls.querySelector("#quantity-error")!.textContent = valid
        ? ""
        : "Use 1–999 seeds.";
      for (const button of grid.querySelectorAll<HTMLButtonElement>("button")) {
        const id = (button.dataset.buySeed ??
            button.dataset.buyPremium) as CropId,
          cost = Number(button.dataset.unitPrice) * count;
        button.disabled =
          waiting ||
          !valid ||
          !cropUnlocked(state, id) ||
          final ||
          state.coins < cost;
        button.querySelector(".shop-price")!.innerHTML =
          `${icon("coin")}${valid ? cost : "?"}`;
        button
          .querySelector(".shop-price")!
          .classList.toggle("action-blocker", valid && state.coins < cost);
        button.setAttribute(
          "aria-label",
          !cropUnlocked(state, id)
            ? `${crops[id].name}: ${opportunities.corn.need}`
            : `Buy ${shopPremium ? "Premium " : ""}${crops[id].name} seeds · ${valid ? cost : "?"} coins · ${valid ? count : "?"} seeds · harvest ${button.dataset.saleDescription}${policy.plantingFee ? ` · planting includes a ${policy.plantingFee}-coin fee paid per plot` : ""}`,
        );
      }
    };
    controls
      .querySelector<HTMLInputElement>("input")!
      .addEventListener("input", (event) => {
        shopQuantity = (event.target as HTMLInputElement).value;
        update();
        positionContext();
      });
    update();
  } else if (target.type === "building") {
    const building = state.structures.find((s) => s.id === target.id);
    if (!building) {
      closeService();
      return;
    }
    const item = buildings[building.kind],
      remaining = upgradeRemaining(state, building),
      cost = policyCost(upgradeCost(building), policy);
    const pending = !!(
      building.pendingConstruction ||
      building.pendingUpgrade ||
      building.pendingDemolition
    );
    title.textContent = item.name;
    if (building.pendingConstruction || building.pendingUpgrade)
      note(
        `${building.pendingConstruction ? "Under construction" : "Upgrade underway"} · ${readyIn(building.wait)}`,
      );
    if (policy.sealedBuildings?.includes(building.kind))
      note("Sealed by the council: no benefits.");
    const stats = document.createElement("div");
    stats.className = "building-stats";
    stats.innerHTML = `${icon("improve")}${building.level}/${item.levels} ${pending ? icon("duration") + "1" : ""}${benefitMarkup(building.kind)}${harvestPrice(building.kind, building.level)}`;
    stats.setAttribute(
      "aria-label",
      `${accessibleBenefit(building.kind)} · Level ${building.level}/${item.levels}${building.pendingDemolition ? " · Teardown underway, clears next season" : building.pendingConstruction ? " · Under construction, ready next season" : building.pendingUpgrade ? " · Upgrade underway, ready next season" : ""}`,
    );
    tileActions.append(stats);
    if (
      isProducer(building.kind) &&
      !building.pendingConstruction &&
      !building.pendingDemolition
    ) {
      if (!building.product) note("Collected · returns next season");
    }
    if (
      isTree(building.kind) &&
      !building.pendingConstruction &&
      !building.pendingDemolition
    ) {
      const status = document.createElement("span");
      status.className = "tree-status";
      status.textContent = treeStatus(building);
      tileActions.append(status);
    }
    if (item.levels > 1) {
      const label = building.pendingDemolition
        ? "Teardown underway · clears next season"
        : building.pendingConstruction
          ? `Under construction · ${readyIn(building.wait)}`
          : building.pendingUpgrade
            ? `Upgrade underway · ${readyIn(building.wait)}`
            : building.level === item.levels
              ? "Fully upgraded"
              : `${isTree(building.kind) ? "Improve tree care" : "Upgrade"} · ${cost} coins${remaining ? ` · Harvest ${remaining} more ${building.kind === "mill" ? "corn crops" : "crops"}` : ""}`;
      tileButton(
        label,
        () => void act({ type: "upgrade", id: building.id }),
        waiting ||
          pending ||
          final ||
          building.level === item.levels ||
          remaining > 0 ||
          state.coins < cost ||
          policy.frozenUpgrades === true ||
          policy.blockedBuildings?.includes(building.kind) === true,
        "upgrade-building",
        "improve",
        pending
          ? `<span class="action-blocker">${icon("duration")}1</span>`
          : `${icon("improve")}<span class="resource${blockedMetric(state.coins < cost)}">${icon("coin")}${cost}</span>${remaining ? `<small class="action-blocker">${icon("locked")}${icon("harvest")}${remaining} ${building.kind === "mill" ? "corn crops" : "crops"}</small>` : ""}${final ? `<small class="action-blocker">${icon("duration")}No next season</small>` : ""}${policy.frozenUpgrades ? `<small class="action-blocker">${icon("locked")}Upgrades frozen</small>` : ""}${policy.blockedBuildings?.includes(building.kind) ? `<small class="action-blocker">${icon("locked")}Not allowed by the council</small>` : ""}`,
      );
    }
    deleteControl(
      building.pendingDemolition
        ? "Teardown underway · clears next season"
        : "Tear down building · next season · no refund",
      item.name,
      { type: "teardown", id: building.id },
      waiting || !!building.pendingDemolition || final,
      "teardown-building",
    );
  } else if (target.type === "service") {
    // An answer can lift permits: the council office's popup goes with the office.
    if (!villageServices().some((s) => s.id === target.id)) {
      closeService();
      return;
    }
    title.textContent =
      villageServices().find((s) => s.id === target.id)?.name ??
      serviceMenus[target.id].name;
    if (target.id === "council") {
      const permits = state.permits ?? [];
      note(serviceMenus.council.description);
      note(
        `This season: ${permits.includes(turn) ? "permit granted" : "no permit"}. Next season: ${permits.includes(turn + 1) ? "permit filed" : "not filed yet"}.`,
        "permit-status",
      );
      tileButton(
        permits.includes(turn + 1)
          ? "Next season's permit is filed"
          : "File next season's permit · free",
        () => void act({ type: "filePermit" }),
        waiting || final || permits.includes(turn + 1),
        "file-permit",
      );
    } else if (target.id === "hive") {
      note(
        state.honeyReady !== false
          ? "Honey ready · 12 coins"
          : "Collected · returns next season",
      );
      tileActions.insertAdjacentHTML(
        "beforeend",
        `<span class="resource harvest-price" aria-label="Harvest sells for 12 coins">${icon("harvestValue")}12</span>`,
      );
      note("Wild honey returns every season, including winter.");
    } else if (!home)
      tileButton(
        "Open seed shop",
        openSeedShop,
        false,
        undefined,
        "seeds",
        "Seeds",
      );
  } else {
    const index = state.plotCells.findIndex(
        (c) => cellKey(c) === cellKey(cell),
      ),
      plot = index < 0 ? null : state.plots[index];
    title.textContent =
      index < 0
        ? "Open land"
        : plot
          ? crops[plot.crop].name
          : "Plant this plot";
    if (index >= 0) {
      if (plot) {
        const ready = plot.growth >= crops[plot.crop].steps;
        if (plot.premium || plot.withered)
          note(sentence(plotCondition({ ...plot, dry: undefined })));
        if (crops[plot.crop].thirsty && !plot.withered) {
          const nextPlot =
            state.season === "fall" || final
              ? plot
              : waterCrops(state, waterInput(drought, water)).state.plots[
                  index
                ]!;
          const status = nextPlot.withered
            ? "withering"
            : plot.dry
              ? "dry"
              : nextPlot.dry
                ? "danger"
                : "watered";
          const affected = status !== "watered";
          const sale = saleQuote(
            { ...state, seasonSales: undefined },
            plot.crop,
            policy,
            turn,
            index,
            nextPlot,
          );
          const forecast = document.createElement("div");
          forecast.className = "crop-water-status";
          forecast.dataset.water = status;
          forecast.setAttribute("role", "img");
          forecast.setAttribute(
            "aria-label",
            status === "dry"
              ? `Drought damage is permanent. Harvest ${earnings(sale)} at current prices.`
              : status === "danger"
                ? `${state.season} drought damages this growing crop when you end this turn. Harvest ${earnings(sale)} at current prices.`
                : status === "withering"
                  ? "This crop will wither when you end this turn under the irrigation limit."
                  : ready
                    ? `Ripe crop is safe from drought. Harvest ${earnings(sale)} at current prices.`
                    : `Water available this season. Harvest ${earnings(sale)} at current prices if no later drought damage.`,
          );
          forecast.innerHTML = `${icon(plot.crop)}${status === "danger" || status === "withering" ? `${icon(state.season === "summer" ? "sun" : state.season)}<span>→</span>` : ""}${icon(status === "withering" ? "withered" : affected ? "dryWater" : "water")}<span>${status === "withering" ? "0" : sale.value}</span>${icon("coin")}`;
          tileActions.append(forecast);
        }
        if (ready && !plot.withered)
          note(
            `Sells for ${earnings(saleQuote(state, plot.crop, policy, turn, index))}.`,
          );
        if (plot.withered)
          tileButton("Clear withered crop", () => workPlot(cell), waiting);
        else if (!ready)
          note(`Growing · ${plot.growth}/${crops[plot.crop].steps}`);
      } else {
        const last = state.lastCrops?.[String(state.plotIds[index])];
        if (policy.rotation && last)
          note(
            `${crops[last].name} grew here last; the council's rotation rule applies.`,
          );
        if (!(Object.keys(crops) as CropId[]).some((id) => canPlant(id, turn)))
          note(
            state.year === 40
              ? "No planting seasons remain."
              : "Planting resumes in spring.",
            "planting-season-note",
          );
        const seasonalBlock = document.querySelector("#planting-season-note");
        if (seasonalBlock) {
          seasonalBlock.classList.add("action-blocker");
          seasonalBlock.insertAdjacentHTML("afterbegin", icon("duration"));
        }
        const grid = document.createElement("div");
        grid.className = "seed-grid inventory-grid";
        tileActions.append(grid);
        for (const id of Object.keys(crops) as CropId[]) {
          if (!cropUnlocked(state, id) || !canPlant(id, turn)) continue;
          for (const premium of [false, true]) {
            const count = premium ? state.premiumSeeds[id] : state.seeds[id];
            if (premium && !count) continue;
            const proposedPlot: NonNullable<Plot> = { crop: id, growth: 0 };
            const nextPlot =
              state.season === "fall" || state.season === "winter" || final
                ? proposedPlot
                : waterCrops(
                    {
                      ...state,
                      plots: state.plots.map((plot, i) =>
                        i === index ? proposedPlot : plot,
                      ),
                    },
                    waterInput(drought, water),
                  ).state.plots[index]!;
            const dry = !!nextPlot.dry,
              withering = !!nextPlot.withered;
            const quote = plantQuote(state, id, policy, turn, premium, index),
              sale = withering
                ? { value: 0, tax: 0, held: false, overQuota: false }
                : previewSaleQuote(
                    { ...state, seasonSales: undefined },
                    id,
                    policy,
                    turn,
                    premium,
                    true,
                    dry,
                  ),
              seasons = growthSeasons(state, id, policy),
              cost = quote.fee + quote.fine;
            const rule =
              quote.blocked ??
              (quote.reasons.length
                ? `${quote.reasons.map(sentence).join(" ")}${quote.fine ? ` Planting anyway costs a ${quote.fine}-coin fine.` : ""}`
                : "");
            const label = `Plant ${premium ? "Premium " : ""}${crops[id].name} · ${count} seeds · ${cost} coins · ${seasons} seasons · harvest ${earnings(sale)}${quote.fee ? ` · includes a ${quote.fee}-coin fee` : ""}${rule ? ` · ${rule}` : ""}${withering ? " · This crop will wither at End turn under the irrigation limit" : dry ? " · Drought: half yield without water" : crops[id].thirsty ? " · Thirsty" : ""}`;
            const button = tileButton(
              label,
              () => workPlot(cell, id, premium),
              waiting ||
                count === 0 ||
                final ||
                !!quote.blocked ||
                state.coins < cost,
              undefined,
              id,
            );
            button.dataset.crop = id;
            if (premium) button.dataset.premium = "true";
            button.classList.add("plant-card");
            button.innerHTML = `<span class="plant-card-heading">${icon(id)}<strong>${premium ? "★ " : ""}${crops[id].name}</strong></span><span class="plant-metrics"><span class="resource" data-metric="seeds">${icon("seeds")}<span>Seeds</span><span class="metric-value">${count}</span></span><span class="resource${blockedMetric(final)}" data-metric="seasons">${icon("duration")}<span>Seasons</span><span class="metric-value">${seasons}</span></span><span class="resource" data-metric="harvest" data-water="${withering ? "withering" : dry ? "dry" : "watered"}">${icon("harvestValue")}<span>${crops[id].thirsty ? icon(withering ? "withered" : dry ? "dryWater" : "water") : ""}</span><span class="metric-value">${sale.value}</span></span>${cost ? `<span class="resource${blockedMetric(state.coins < cost)}" data-metric="cost">${icon("coin")}<span>Planting</span><span class="metric-value">${cost}</span></span>` : ""}</span>${sale.tax || sale.held || sale.overQuota ? `<span class="plant-sale-notes">${sale.tax ? `<small>−${sale.tax} tax</small>` : ""}${sale.held ? "<small>Next season</small>" : ""}${sale.overQuota ? "<small>Sales limit</small>" : ""}</span>` : ""}${rule ? `<span class="crop-rule">${rule}</span>` : ""}`;
            grid.append(button);
          }
        }
      }
      const footer = document.createElement("div");
      footer.className = "plot-footer";
      const shopButton = tileButton(
        "Open seed shop",
        openSeedShop,
        false,
        "plot-shop",
        "seeds",
        "Shop",
      );
      deleteControl(
        "Delete field · no refund",
        "field",
        { type: "deletePlot", id: state.plotIds[index] },
        waiting,
        "delete-plot",
      );
      footer.append(shopButton);
      tileActions.append(footer);
    } else if (debrisAt(state.debris, cell)) {
      const item = debrisAt(state.debris, cell)!;
      const spec = debrisTypes[item.kind];
      title.textContent = spec.name;
      note(
        `${debrisFootprint(item).length} ${debrisFootprint(item).length === 1 ? "tile" : "tiles"}${item.kind === "fallenTree" ? " · L-shaped" : ` · ${spec.width}×${spec.height}`} · Clear to make room for fields and buildings.`,
      );
      tileButton(
        spec.cost < 0
          ? `Gather berries & clear · +${-spec.cost} coins`
          : spec.cost === 0
            ? "Clear · Free"
            : `Clear · ${spec.cost} coins`,
        () => void act({ type: "clearDebris", cell }),
        waiting ||
          final ||
          state.coins < spec.cost ||
          !cellAllowed(cell, policy),
        undefined,
        "build",
        `${icon("build")}<span>${spec.cost < 0 ? "Gather berries & clear" : "Clear"}</span><span class="resource${blockedMetric(state.coins < spec.cost)}">${icon("coin")}${spec.cost < 0 ? `+${-spec.cost}` : spec.cost}</span>${final ? `<span class="action-blocker">${icon("duration")}</span>` : ""}`,
      );
    } else {
      if (policy.takenCells?.some((c) => cellKey(c) === cellKey(cell)))
        note("The county took this land for its reservoir.");
      const categories = document.createElement("div");
      categories.className = "plan-categories";
      for (const [category, art, label] of [
        ["farm", "build", "Farm"],
        ["animals", "harvest", "Animals"],
        ["trade", "improve", "Trade"],
        ["trees", "sprout", "Trees"],
      ] as const) {
        const button = document.createElement("button");
        button.dataset.category = category;
        button.setAttribute("aria-label", `${label} plans`);
        button.setAttribute("aria-pressed", String(planCategory === category));
        button.innerHTML = `${icon(art)}<span>${label}</span>`;
        button.addEventListener("click", () => {
          planCategory = category;
          refreshContext();
        });
        categories.append(button);
      }
      progressionSummary();
      note(
        "Harvest crops to unlock plans. Locked plans show what to work toward.",
        "progression-help",
      );
      tileActions.append(categories);
      const grid = document.createElement("div");
      grid.className = "plan-grid";
      tileActions.append(grid);
      if (planCategory === "farm") {
        const cost = policyCost(expansionCost(state), policy);
        const button = tileButton(
          `Prepare crop plot · ${cost} coins`,
          () => void act({ type: "expand", cell }),
          waiting ||
            final ||
            state.coins < cost ||
            state.plots.length >= (policy.maxPlots ?? WORLD_CELLS) ||
            !canPlace(state, cell, 1, 1, policy),
          "expand",
          "expand",
          `${icon("expand")}<strong>Crop plot</strong><span class="plan-cost${blockedMetric(state.coins < cost)}">${icon("coin")}${cost}</span><span class="plan-duration${blockedMetric(final)}">${final ? icon("duration") : ""}Ready now</span><small class="plan-benefit">Plant seasonal crops</small>`,
        );
        grid.append(button);
      }
      for (const kind of Object.keys(buildings) as BuildingKind[]) {
        const item = buildings[kind],
          count = state.structures.filter((s) => s.kind === kind).length,
          cost = policyCost(constructionCost(state, kind), policy),
          limit = policy.buildingLimits?.[kind],
          delay = isTree(kind) ? 0 : (policy.buildDelay ?? 0);
        const available =
          canBuild(state, kind) ||
          policy.unlockedBuildings?.includes(kind) === true;
        if (kind === "home" && count > 0) continue;
        const requirement =
          kind === "oak"
            ? "Finish a farmhouse"
            : kind === "home" || kind === "beehive"
              ? "Available now"
              : opportunities[kind].need;
        // Why the council's rules stop this plan, stated on the plan itself.
        const rule = policy.blockedBuildings?.includes(kind)
          ? " · Not allowed by the council"
          : limit !== undefined && count >= limit
            ? " · No more allowed by the council"
            : "";
        const category = isTree(kind)
          ? "trees"
          : isAnimal(kind)
            ? "animals"
            : ["mill", "greenhouse", "market", "hall"].includes(kind)
              ? "trade"
              : "farm";
        if (category !== planCategory) continue;
        const button = tileButton(
          `${item.name} · ${cost} coins · ${accessibleBenefit(kind)} · ${readyIn(delay)}${!available ? ` · Locked: ${requirement}` : ""}${rule}`,
          () => beginPlacement(kind, cell),
          !available ||
            waiting ||
            final ||
            state.coins < cost ||
            policy.blockedBuildings?.includes(kind) === true ||
            (limit !== undefined && count >= limit),
          undefined,
          "build",
        );
        button.dataset.build = kind;
        button.dataset.locked = String(!available);
        button.innerHTML = `${icon(isTree(kind) ? "sprout" : isAnimal(kind) ? "harvest" : "build")}<strong>${item.name}</strong><span class="plan-cost${blockedMetric(state.coins < cost)}">${icon("coin")}${cost}</span><span class="plan-duration${blockedMetric(final)}">${icon("duration")}${delay + 1}</span>${benefitMarkup(kind)}${harvestPrice(kind)}${!available ? `<small class="plan-requirement action-blocker">${icon("locked")}<span>${requirement}</span></small>` : ""}${rule ? `<small class="plan-rule action-blocker">${icon("locked")}<span>${rule.slice(3)}</span></small>` : ""}`;
        grid.append(button);
      }
    }
  }
  if (home && !homeUpgrades) {
    tileButton(
      "Farm upgrades",
      () => {
        homeUpgrades = true;
        tileActions.parentElement!.scrollTop = 0;
        refreshContext();
      },
      false,
      "farm-upgrades",
      "improve",
      `${icon("improve")}Farm upgrades`,
    );
    tileButton(
      "Open seed shop",
      openSeedShop,
      false,
      undefined,
      "seeds",
      "Seeds",
    );
    const button = tileButton(
      final ? "Final season · 160/160" : `End turn · ${rules().turn}/160`,
      () => {
        const request = ++navigationVersion,
          building =
            target.type === "building"
              ? state.structures.find((s) => s.id === target.id)
              : undefined;
        const item = building
          ? structureSize(building)
          : (villageServices().find((s) => s.id === "home") ?? {
              width: 2,
              height: 2,
            });
        const reached = scene.travelTo(
          cell,
          item.width,
          item.height,
          true,
          "nearest",
          () => {
            if (request === navigationVersion) void act({ type: "season" });
          },
        );
        if (!reached) {
          serviceFeedback.textContent =
            "No walking path home. Tear down nearby buildings to clear access.";
          serviceFeedback.hidden = false;
          positionContext();
        }
      },
      waiting ||
        final ||
        (target.type === "building" &&
          !!state.structures.find((s) => s.id === target.id)
            ?.pendingConstruction),
      "next-season",
      "duration",
      `${icon("duration")}<span>${final ? "Final season" : "End turn"} · ${rules().turn}/160</span>`,
    );
    const waterFee = water.atCost && !water.sold ? water.thirsty : 0;
    if (!final && (water.drying || water.withering || waterFee)) {
      const transition = document.createElement("div");
      transition.id = "water-transition";
      transition.dataset.drying = String(water.drying);
      transition.dataset.withering = String(water.withering);
      transition.setAttribute("role", "img");
      transition.setAttribute(
        "aria-label",
        `Ending ${state.season}: ${water.drying} growing crops receive permanent drought damage${water.withering ? `; ${water.withering} crops wither under the irrigation limit` : ""}${waterFee ? `; water costs ${waterFee} coins at End turn` : ""}. Ripe crops are safe from drought.`,
      );
      const nextSeason =
        state.season === "spring"
          ? "sun"
          : state.season === "summer"
            ? "fall"
            : state.season === "fall"
              ? "winter"
              : "spring";
      transition.innerHTML = `${water.drying || water.withering ? `<span>${icon(state.season === "summer" ? "sun" : state.season)}${icon(drought ? "drought" : "dryWater")}</span><span>→</span><span>${icon(nextSeason)}</span>${water.drying ? `<span class="water-drying">${icon("sprout")}${icon("dryWater")}<strong>${water.drying}</strong></span>` : ""}${water.withering ? `<span class="water-withering">${icon("withered")}<strong>${water.withering}</strong></span>` : ""}` : ""}${waterFee ? `<span class="water-fee">${icon("water")}<span>−${waterFee}</span>${icon("coin")}</span>` : ""}`;
      button.after(transition);
      button.setAttribute("aria-describedby", "water-transition");
    }
    // Described by the council's note only while that note is true.
    if (waiting) button.setAttribute("aria-describedby", "council-wait");
    if (state.season === "fall")
      note(
        `Winter is next. All ${state.plots.filter(Boolean).length} field crops will die. Harvest first.`,
      );
    note(
      `${state.plots.length} plots · +${policyProduction(seasonalIncome(state, policy), policy)} coins / season`,
    );
    // Delivery work shows exactly when the farm rules allow it.
    if (canWork(state, policy, turn))
      tileButton(
        "Unload a seed delivery · +4 coins",
        () => void act({ type: "work" }),
        waiting,
        "work",
        "seeds",
        `${icon("seeds")}${icon("coin")}+4`,
      );
    councilRules(waiting);
  }
  tileActions.parentElement!.scrollTop = scroll;
  if (hadFocus) {
    // A control the action disabled cannot hold focus: fall back to close.
    const again = document.getElementById(focused) as HTMLButtonElement | null;
    (again && !again.disabled
      ? again
      : document.querySelector<HTMLButtonElement>("#close-service")
    )?.focus({ preventScroll: true });
  }
  positionContext();
}
/** The farmhouse's council rules: what they mean this season, the trades on offer, and every standing rule. */
function councilRules(waiting: boolean) {
  const council = councilFacts(state, rules());
  // Icons carry the visible outlook; retain its precise account for screen readers.
  const waterOutlook = waterFact(state, rules());
  if (
    !state.crises?.length &&
    !council.facts.length &&
    !council.water &&
    !council.lock
  )
    return;
  const section = document.createElement("section");
  section.id = "council-rules";
  section.setAttribute("aria-labelledby", "council-rules-title");
  section.innerHTML = `<h3 id="council-rules-title">Council rules</h3><ul id="council-facts"></ul><div id="council-trades"></div><ul id="council-standing" class="crisis-standing"></ul>`;
  const list = (selector: string, items: (string | Node)[][]) => {
    const element = section.querySelector<HTMLElement>(selector)!;
    element.hidden = !items.length;
    element.replaceChildren(
      ...items.map((parts) => {
        const item = document.createElement("li");
        item.append(...parts);
        return item;
      }),
    );
  };
  list(
    "#council-facts",
    council.facts.map((fact) => [fact]),
  );
  for (const item of section.querySelectorAll("#council-facts li"))
    if (item.textContent === waterOutlook) item.classList.add("sr-only");
  list(
    "#council-standing",
    council.standing.map((rule) => [
      Object.assign(document.createElement("strong"), {
        textContent: `${rule.policy}:`,
      }),
      ` ${rule.text}`,
    ]),
  );
  const trades = section.querySelector<HTMLElement>("#council-trades")!;
  const trade = (
    id: string,
    label: string,
    type: "buyWater" | "sellWater" | "lockPrice",
    disabled: boolean,
  ) => {
    const button = document.createElement("button");
    button.id = id;
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", () => void act({ type }));
    trades.append(button);
  };
  // Bought water reaches the crops growing now; one sale gives up the season's water.
  const water = council.water;
  if (water) {
    if (!water.covered || water.traded === "bought")
      trade(
        "buy-water",
        water.traded === "bought" && !water.unwatered
          ? "Water bought this season"
          : `Buy water · ${water.buy} coins`,
        "buyWater",
        waiting ||
          water.traded === "sold" ||
          !water.unwatered ||
          state.coins < water.buy,
      );
    trade(
      "sell-water",
      water.traded === "sold"
        ? "Water rights sold this season"
        : `Sell water rights · +${water.sell}`,
      "sellWater",
      waiting || !!water.traded || !water.thirsty,
    );
  }
  if (council.lock)
    trade("lock-price", council.lock.label, "lockPrice", waiting);
  trades.hidden = !trades.childElementCount;
  tileActions.append(section);
}
document.querySelector("#close-service")!.addEventListener("click", () => {
  navigationVersion++;
  closeService();
});
const movementKeys = new Map<string, Cell>();
const releaseMovement = () => {
  movementKeys.clear();
  scene.holdFarmerDirection();
};
window.addEventListener("blur", releaseMovement);
new MutationObserver((records) => {
  if (
    records.some(
      (record) =>
        record.target instanceof HTMLDialogElement && record.target.open,
    )
  )
    releaseMovement();
}).observe(document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ["open"],
});
document.addEventListener("pointerdown", releaseMovement);
document.addEventListener("focusin", (event) => {
  if (
    event.target instanceof Element &&
    event.target.closest("input, textarea, select, [contenteditable]")
  )
    releaseMovement();
});
document.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (!movementKeys.delete(key)) return;
  scene.holdFarmerDirection([...movementKeys.values()].at(-1));
});
document.addEventListener("keydown", (event) => {
  if (
    (event.key.toLowerCase() === "e" || event.code === "Space") &&
    !event.repeat &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !(
      event.target instanceof Element &&
      event.target.closest("input, textarea, select, [contenteditable]")
    ) &&
    !document.querySelector("dialog[open]")
  ) {
    if (
      event.code === "Space" &&
      event.target instanceof Element &&
      event.target.closest("button:not(.plot-hit), #service-panel")
    )
      return;
    event.preventDefault();
    releaseMovement();
    openActions();
  }
  const directions: Record<string, Cell> = {
    w: { row: -1, col: 0 },
    ArrowUp: { row: -1, col: 0 },
    s: { row: 1, col: 0 },
    ArrowDown: { row: 1, col: 0 },
    a: { row: 0, col: -1 },
    ArrowLeft: { row: 0, col: -1 },
    d: { row: 0, col: 1 },
    ArrowRight: { row: 0, col: 1 },
  };
  const direction =
    directions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
  if (
    direction &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    startup.hidden &&
    !document.querySelector("dialog[open]") &&
    !(
      event.target instanceof Element &&
      event.target.closest("input, textarea, select, [contenteditable]")
    )
  ) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (event.repeat && !movementKeys.has(key)) return;
    event.preventDefault();
    closeService();
    clearBuild();
    navigationVersion++;
    if (!event.repeat) movementKeys.set(key, direction);
    scene.holdFarmerDirection([...movementKeys.values()].at(-1));
  }
  // Escape closes the council meeting on its own.
  if (event.key === "Escape" && !document.querySelector("#crisis[open]")) {
    releaseMovement();
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
let selectedFarmer: "male" | "female" = "male";
const characterSelect =
  document.querySelector<HTMLElement>("#character-select")!;
characterSelect
  .querySelectorAll<HTMLButtonElement>("button")
  .forEach((button) => {
    button.addEventListener("click", () => {
      selectedFarmer = button.dataset.farmer as "male" | "female";
      characterSelect.querySelectorAll("button").forEach((choice) => {
        choice.setAttribute("aria-pressed", String(choice === button));
      });
    });
  });
const loadingProgress =
  document.querySelector<HTMLProgressElement>("#loading-progress")!;
let sceneCreated = false;
const sceneReady = new Promise<void>((resolve) => {
  scene.onReady = () => {
    sceneCreated = true;
    resolve();
  };
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
beginFarm.addEventListener("click", async () => {
  if (artworkFailed) location.reload();
  else {
    state = { ...state, farmerVariant: selectedFarmer };
    scene.setState(state);
    try {
      if (!store) throw new Error("Local saves are unavailable.");
      await store.save(state);
      enterFarm();
    } catch {
      startupCopy.hidden = false;
      startupCopy.textContent = "Could not save your farmer. Please try again.";
    }
  }
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
  serviceLocations(state, serviceOptions(rules().policy));
const harvestFeedback = new HarvestFeedback(state.coins);
let saving = false;
let loadFailed = false;
let navigationVersion = 0;
let centered = false;
const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2];
let zoom = 1;
const viewport = document.querySelector<HTMLElement>("#farm")!;
const inventoryControls = mountInventoryControls({
  open: openInventory,
  close: closeService,
  isOpen: () =>
    (contextTarget?.type === "inventory" ||
      contextTarget?.type === "shop" ||
      (contextTarget?.type === "service" && contextTarget.id === "seeds")) &&
    !servicePanel.hidden,
  count: () =>
    Object.values(state.seeds).reduce((a, b) => a + b, 0) +
    Object.values(state.premiumSeeds).reduce((a, b) => a + b, 0),
});
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
function setZoom(
  value: number,
  anchor = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 },
) {
  const next = Math.max(0.5, Math.min(2, value));
  if (next === zoom) return;
  const previousScroll = { x: viewport.scrollLeft, y: viewport.scrollTop };
  const center = {
    x: (viewport.scrollLeft + anchor.x) / zoom,
    y: (viewport.scrollTop + anchor.y) / zoom,
  };
  zoom = next;
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
  viewport.scrollLeft = center.x * zoom - anchor.x;
  viewport.scrollTop = center.y * zoom - anchor.y;
  if (drag) {
    drag.left += viewport.scrollLeft - previousScroll.x;
    drag.top += viewport.scrollTop - previousScroll.y;
  }
  document.querySelector("#zoom-level")!.textContent =
    `${Math.round(zoom * 100)}%`;
  document.querySelector<HTMLButtonElement>("#zoom-out")!.disabled =
    zoom === 0.5;
  document.querySelector<HTMLButtonElement>("#zoom-in")!.disabled = zoom === 2;
  if (hoveredCell) showPreview(hoveredCell);
  updateViewport();
}
function stepZoom(direction: number) {
  stopWheel();
  const levels = direction > 0 ? zoomLevels : [...zoomLevels].reverse();
  setZoom(
    levels.find((level) =>
      direction > 0 ? level > zoom + 0.001 : level < zoom - 0.001,
    ) ?? zoom,
  );
}
let wheelFrame = 0;
let wheelTarget = zoom;
let wheelAnchor = { x: 0, y: 0 };
viewport.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const bounds = viewport.getBoundingClientRect();
    wheelAnchor = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    const pixels =
      event.deltaY *
      (event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? viewport.clientHeight
          : 1);
    wheelTarget = Math.max(
      0.5,
      Math.min(
        2,
        (wheelFrame ? wheelTarget : zoom) * Math.exp(-pixels * 0.002),
      ),
    );
    if (!wheelFrame) wheelFrame = requestAnimationFrame(animateWheel);
  },
  { passive: false },
);
function animateWheel() {
  const next = zoom + (wheelTarget - zoom) * 0.3;
  const done = Math.abs(wheelTarget - next) < 0.001;
  setZoom(done ? wheelTarget : next, wheelAnchor);
  wheelFrame = done ? 0 : requestAnimationFrame(animateWheel);
}
function stopWheel() {
  cancelAnimationFrame(wheelFrame);
  wheelFrame = 0;
}
document
  .querySelector("#zoom-out")!
  .addEventListener("click", () => stepZoom(-1));
document
  .querySelector("#zoom-in")!
  .addEventListener("click", () => stepZoom(1));
document.querySelector("#zoom-reset")!.addEventListener("click", () => {
  stopWheel();
  setZoom(1);
});
let hoveredCell: Cell | null = null;
const preview = document.createElement("div");
preview.id = "placement-preview";
preview.hidden = true;
world.append(preview);
const ghost = document.createElement("img");
ghost.id = "placement-ghost";
ghost.alt = "";
ghost.hidden = true;
world.append(ghost);
const buildingTooltip = document.createElement("div");
buildingTooltip.id = "building-tooltip";
buildingTooltip.setAttribute("role", "tooltip");
buildingTooltip.hidden = true;
world.append(buildingTooltip);
world.addEventListener("pointerleave", () => {
  if (!placingKind) hoveredCell = null;
  if (!placingKind) preview.hidden = true;
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
  const tent = villageServices().find((service) => service.tent);
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
    stopWheel();
    if (event.key === "0") setZoom(1);
    else stepZoom(event.key === "-" ? -1 : 1);
    return;
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
const touches = new Map<number, { x: number; y: number }>();
function touchPair() {
  const [a, b] = [...touches.values()];
  const bounds = viewport.getBoundingClientRect();
  return {
    distance: Math.hypot(b.x - a.x, b.y - a.y),
    x: (a.x + b.x) / 2 - bounds.left,
    y: (a.y + b.y) / 2 - bounds.top,
  };
}
let pinch: ReturnType<typeof touchPair> | null = null;
viewport.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch") {
    stopWheel();
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size >= 2) {
      pinch = touchPair();
      drag = null;
      suppressClick = true;
      return;
    }
  } else if (e.button !== 0) return;
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
  if (
    placingKind &&
    !placementLocked &&
    !drag &&
    e.pointerType === "mouse" &&
    e.target instanceof Element
  ) {
    const tile = e.target.closest<HTMLElement>("[data-cell]");
    if (tile) {
      const [row, col] = tile.dataset.cell!.split(",").map(Number);
      showPreview({ row, col });
    }
  }
  if (touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size >= 2) {
      const next = touchPair();
      setZoom((zoom * next.distance) / Math.max(1, pinch.distance), pinch);
      viewport.scrollLeft -= next.x - pinch.x;
      viewport.scrollTop -= next.y - pinch.y;
      pinch = next;
      updateViewport();
      return;
    }
  }
  if (!drag) return;
  if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 6) {
    drag.active = true;
    suppressClick = true;
    viewport.setPointerCapture(e.pointerId);
    viewport.scrollLeft = drag.left - (e.clientX - drag.x);
    viewport.scrollTop = drag.top - (e.clientY - drag.y);
  }
});
function endPointer(event: PointerEvent) {
  touches.delete(event.pointerId);
  if (pinch) suppressClick = true;
  pinch = touches.size >= 2 ? touchPair() : null;
  drag = null;
  const remaining = [...touches.values()][0];
  if (remaining)
    drag = {
      ...remaining,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
      active: false,
    };
}
viewport.addEventListener("pointerup", endPointer);
viewport.addEventListener("pointercancel", endPointer);
viewport.addEventListener(
  "click",
  (e) => {
    if (suppressClick) {
      e.preventDefault();
      e.stopImmediatePropagation();
      suppressClick = false;
      return;
    }
    if (!e.detail || placingKind) return;
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
    const services = villageServices().filter((s) =>
      s.id === "hive"
        ? scene.hitsHive({ x, y }, s)
        : s.tent
          ? scene.hitsTent({ x, y }, s)
          : s.id !== "council" &&
            scene.hitsBuilding(
              { x, y },
              s,
              s.frame,
              false,
              distinctServices[s.id as keyof typeof distinctServices],
            ),
    );
    const structures = state.structures.filter((s) => {
      const item = { ...buildings[s.kind], ...structureSize(s) };
      if (s.kind === "beehive")
        return scene.hitsHive(
          { x, y },
          { ...s, width: item.width, height: item.height },
          false,
        );
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
          !!(s.pendingConstruction || s.pendingUpgrade || s.pendingDemolition),
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
        depth:
          s.kind === "beehive"
            ? hiveBounds(projectCell(hiveAnchor({ ...s, ...structureSize(s) })))
                .bottom
            : projectCell(
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
        depth:
          s.id === "hive"
            ? hiveBounds(projectCell(s), true).bottom
            : s.tent
              ? tentBounds(s).y + tentBounds(s).height
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
function harvestTarget(target: ContextTarget): boolean {
  if (pendingCrisis(state)) return false;
  if (target.type === "cell") {
    const index = state.plotCells.findIndex(
      (cell) => cellKey(cell) === cellKey(target.cell),
    );
    const plot = state.plots[index];
    if (plot && !plot.withered && plot.growth >= crops[plot.crop].steps) {
      workPlot(target.cell);
      return true;
    }
  }
  if (target.type === "building") {
    const building = state.structures.find((item) => item.id === target.id);
    if (
      building &&
      (isTree(building.kind) || isProducer(building.kind)) &&
      building.product &&
      !building.pendingConstruction &&
      !building.pendingDemolition
    ) {
      harvestSelectedTree(building.id);
      return true;
    }
  }
  if (
    target.type === "service" &&
    target.id === "hive" &&
    state.honeyReady !== false
  ) {
    closeService();
    const request = ++navigationVersion;
    const reached = scene.travelTo(target.cell, 1, 1, true, "nearest", () => {
      if (request === navigationVersion) void act({ type: "collectHoney" });
    });
    message.textContent = reached
      ? "Walking to collect honey."
      : "No walking path to this honey tree.";
    return true;
  }
  return false;
}
function inspectBuilding(id: number) {
  if (!state.structures.some((s) => s.id === id)) return;
  openContext({ type: "building", id });
}
function harvestSelectedTree(id: number) {
  const building = state.structures.find((s) => s.id === id);
  if (!building) return;
  if (
    (isTree(building.kind) || isProducer(building.kind)) &&
    Boolean(building.product) &&
    !building.pendingConstruction &&
    !building.pendingDemolition
  ) {
    closeService();
    const request = ++navigationVersion;
    const item = { ...buildings[building.kind], ...structureSize(building) };
    const reached = scene.travelTo(
      building,
      item.width,
      item.height,
      true,
      "nearest",
      () => {
        if (request === navigationVersion)
          void act({
            type:
              building.kind === "beehive"
                ? "collectHive"
                : isAnimal(building.kind)
                  ? "collectAnimal"
                  : "harvestTree",
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
function beginPlacement(kind: BuildingKind, cell: Cell) {
  closeService();
  navigationVersion++;
  scene.stopFarmer();
  placingKind = kind;
  document.querySelector<HTMLElement>(".farm-tools")!.hidden = false;
  document.querySelector<HTMLButtonElement>("#farm-mode")!.hidden = false;
  document.querySelector<HTMLElement>("#placement-hint")!.hidden = false;
  showPreview(cell);
  // Fit the whole plan between the HUD and cancel control, even on short phones.
  const art = scene.placementArtwork(kind, cell);
  const view = viewport.getBoundingClientRect();
  const top =
    document.querySelector(".farm-overview")!.getBoundingClientRect().bottom -
    view.top +
    12;
  const bottom =
    document.querySelector(".hud-bottom")!.getBoundingClientRect().top -
    view.top -
    12;
  setZoom(
    Math.min(zoom, (bottom - top) / art.height, (view.width - 24) / art.width),
  );
  viewport.scrollLeft = (art.x + art.width / 2) * zoom - view.width / 2;
  viewport.scrollTop = (art.y + art.height / 2) * zoom - (top + bottom) / 2;
  viewport.focus({ preventScroll: true });
}
function clearBuild() {
  if (placingKind) {
    navigationVersion++;
    scene.stopFarmer();
  }
  placementLocked = false;
  placingKind = null;
  ghost.hidden = true;
  document.querySelector<HTMLElement>(".farm-tools")!.hidden = true;
  preview.hidden = true;
  buildingTooltip.hidden = true;
  document.querySelector("#placement-hint")!.textContent =
    "Choose open land as the destination. Escape or Cancel placement cancels.";
  // Cancelling placement changes controls, not the farm artwork.
}
document.querySelector("#farm-mode")!.addEventListener("click", clearBuild);
const message = document.querySelector<HTMLElement>("#farm-message")!;
const seasonTransition = new SeasonTransition();
let endingTurn = false;
let farmQueue: Promise<void> = Promise.resolve();
function act(action: FarmAction | { type: "season" } | CouncilAnswer) {
  // The meeting can open while the new season is still being revealed: its answers queue.
  if (endingTurn && action.type !== "answer" && action.type !== "offer")
    return farmQueue;
  if (action.type === "season") endingTurn = true;
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
      if (action.type === "season" && result.state !== previous)
        await seasonTransition.cover(result.state);
      await apply(
        result.state,
        false,
        false,
        action.type === "harvest" ||
          action.type === "harvestTree" ||
          action.type === "collectAnimal" ||
          action.type === "collectHive" ||
          action.type === "collectHoney",
      );
      if (action.type === "answer" || action.type === "offer")
        crisisDialog.answered(result.message);
      else if (
        action.type !== "season" &&
        action.type !== "collectHoney" &&
        requestedNavigation === navigationVersion
      )
        scene.performAction(action, previous);
      if (
        action.type === "harvest" ||
        action.type === "harvestTree" ||
        action.type === "collectAnimal" ||
        action.type === "collectHive" ||
        action.type === "collectHoney"
      ) {
        const cell =
          action.type === "collectHoney"
            ? serviceLocations(previous).find((s) => s.id === "hive")
            : action.type === "harvest"
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
            (s) =>
              s.kind === "home" &&
              !s.pendingConstruction &&
              !s.pendingDemolition,
          );
          if (home) contextTarget = { type: "building", id: home.id };
        }
        refreshContext();
      }
      message.textContent = result.message;
      if (action.type === "season") await seasonTransition.reveal();
    } catch (error) {
      message.textContent =
        error instanceof Error ? error.message : "Could not work the farm.";
      if (action.type === "answer" || action.type === "offer")
        crisisDialog.fail(message.textContent);
      else if (!servicePanel.hidden) {
        serviceFeedback.textContent = message.textContent;
        serviceFeedback.hidden = false;
        positionContext();
      }
    } finally {
      if (action.type === "season") {
        seasonTransition.clear();
        endingTurn = false;
        // The council meets once the new season is showing, unless it already opened.
        if (pendingCrisis(state) && !document.querySelector("#crisis[open]"))
          crisisDialog.open();
      }
    }
  });
  return farmQueue;
}
const crisisDialog = mountCrisisDialog(document.querySelector(".farm-card")!, {
  records: () => state.crises ?? [],
  answer: act,
  // The meeting's opener is often hidden or disabled once it closes: focus the way back
  // to it while it waits (on the HUD, or in the open menu), else End turn, else the farm.
  onClose: () => {
    // Not checkVisibility(): Safari before 17.4 lacks it.
    const shown = (el: HTMLElement | null): el is HTMLElement =>
      !!el && el.getClientRects().length > 0;
    const endTurn = document.querySelector<HTMLButtonElement>("#next-season");
    const target =
      [
        councilMeeting,
        document.querySelector<HTMLElement>("#council-return"),
      ].find(shown) ??
      (shown(endTurn) && !endTurn.disabled ? endTurn : viewport);
    target.focus({ preventScroll: true });
  },
});
const councilMeeting =
  document.querySelector<HTMLButtonElement>("#council-meeting")!;
councilMeeting.addEventListener("click", () => crisisDialog.open());
scene.onLayout = (targets) => {
  const keys = new Set(targets.map(cellKey));
  for (const [key, button] of cellButtons)
    if (!keys.has(key)) {
      button.remove();
      cellButtons.delete(key);
    }
  const services = villageServices();
  const serviceMap = new Map(
    services.flatMap((service) =>
      footprint(service, service.width, service.height).map(
        (cell) => [cellKey(cell), service] as const,
      ),
    ),
  );
  const { policy } = rules();
  const taken = new Set((policy.takenCells ?? []).map(cellKey));
  const sealed = new Set(policy.sealedBuildings ?? []);
  const plotMap = new Map(state.plotCells.map((c, i) => [cellKey(c), i]));
  const debrisMap = new Map(
    (state.debris ?? []).flatMap((d) =>
      debrisFootprint(d).map((c) => [cellKey(c), d] as const),
    ),
  );
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
        world
          .querySelector("[data-selected]")
          ?.removeAttribute("data-selected");
        button!.setAttribute("data-selected", "true");
        if (placingKind) {
          if (placementLocked) return;
          const kind = placingKind,
            item = buildings[kind];
          showPreview(cell);
          if (!canPlace(state, cell, item.width, item.height, rules().policy))
            return;
          placementLocked = true;
          startConstruction(kind, cell);
          return;
        }
        openContext(tileContext(cell));
      });
      button.addEventListener("pointerenter", (event) => {
        if (event.pointerType === "mouse" && !placingKind) showPreview(target);
      });
      button.addEventListener("focus", () => {
        if (!placementLocked && button!.matches(":focus-visible"))
          showPreview(target);
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
    const service = serviceMap.get(key);
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
          ? structure.pendingDemolition
            ? `${buildings[structure.kind].name} ${structure.id}, teardown underway, clears next season`
            : `${buildings[structure.kind].name} ${structure.id}, ${isProducer(structure.kind) ? `${structure.pendingConstruction ? `under construction, ${readyIn(structure.wait)}` : structure.product ? `${buildingProducts[structure.kind].product} ready to collect` : "collected, return next season"}` : isTree(structure.kind) ? treeStatus(structure) : structure.pendingConstruction ? `under construction, ${readyIn(structure.wait)}` : `level ${structure.level}${sealed.has(structure.kind) ? ", sealed by the council" : ""}`}`
          : service
            ? `Visit ${service.name}`
            : debrisMap.has(key)
              ? `${debrisTypes[debrisMap.get(key)!.kind].name}, ${debrisFootprint(debrisMap.get(key)!).length} tiles, ${debrisTypes[debrisMap.get(key)!.kind].cost < 0 ? `gather for ${-debrisTypes[debrisMap.get(key)!.kind].cost} coins` : `clear for ${debrisTypes[debrisMap.get(key)!.kind].cost} coins`}`
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
  const kind = placingKind;
  const hovered = !kind
    ? state.structures.find((s) =>
        footprint(s, structureSize(s).width, structureSize(s).height).some(
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
  const debris =
    !hovered && !service ? debrisAt(state.debris, cell) : undefined;
  if (!kind && !hovered && !service && !debris) {
    preview.hidden = true;
    buildingTooltip.hidden = true;
    return;
  }
  const item = kind
    ? buildings[kind]
    : hovered
      ? { ...buildings[hovered.kind], ...structureSize(hovered) }
      : debris
        ? debrisTypes[debris.kind]
        : service!;
  const anchor = kind ? cell : (hovered ?? service ?? debris)!;
  preview.dataset.mode = kind ? "placement" : "hover";
  const layout = state;
  const fits = canPlace(layout, cell, item.width, item.height, rules().policy),
    pos = projectCell(anchor);
  preview.hidden = false;
  preview.dataset.valid = String(!kind || fits);
  ghost.hidden = !kind;
  if (kind) {
    const art = scene.placementArtwork(kind, cell);
    if (ghost.dataset.kind !== kind || ghost.dataset.season !== state.season) {
      ghost.src = art.src;
      ghost.dataset.kind = kind;
      ghost.dataset.season = state.season;
    }
    Object.assign(ghost.style, {
      left: `${art.x * zoom}px`,
      top: `${art.y * zoom}px`,
      width: `${art.width * zoom}px`,
      height: `${art.height * zoom}px`,
    });
    ghost.dataset.valid = String(fits);
    document.querySelector("#placement-hint")!.textContent =
      `${buildings[kind].name} · ${fits ? "Click or tap to place" : "Needs open land"}`;
  }
  preview.replaceChildren();
  if (kind) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String((item.width + item.height) * 32 * zoom));
    svg.setAttribute("height", String((item.width + item.height) * 16 * zoom));
    for (const tile of footprint(cell, item.width, item.height)) {
      const point = projectCell(tile),
        x = (point.x - pos.x + item.height * 32) * zoom,
        y = (point.y - pos.y + 16) * zoom;
      const polygon = document.createElementNS(svg.namespaceURI, "polygon");
      polygon.setAttribute(
        "points",
        `${x},${y - 16 * zoom} ${x + 32 * zoom},${y} ${x},${y + 16 * zoom} ${x - 32 * zoom},${y}`,
      );
      polygon.setAttribute("fill", "none");
      polygon.setAttribute("stroke", "#fff4c9");
      polygon.setAttribute("stroke-width", "1.5");
      svg.append(polygon);
    }
    preview.append(svg);
  }
  const total = item.width + item.height;
  if (!kind && (hovered || service || debris)) {
    buildingTooltip.textContent = hovered
      ? { ...buildings[hovered.kind], ...structureSize(hovered) }.name
      : debris
        ? debrisTypes[debris.kind].name
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
    clipPath:
      debris?.kind === "fallenTree"
        ? "polygon(50% 0,100% 50%,83.333% 66.667%,50% 33.333%,16.667% 66.667%,0 50%)"
        : `polygon(${(item.height / total) * 100}% 0,100% ${(item.width / total) * 100}%,${(item.width / total) * 100}% 100%,0 ${(item.height / total) * 100}%)`,
  });
}
const params = new URLSearchParams(location.search);
const instance = import.meta.env.DEV
  ? (params.get("instance") ?? "default")
  : "player";
const namespace = import.meta.env.DEV ? `dev-${instance}` : "player";
let store: Awaited<ReturnType<typeof openSaveStore>> | undefined;
let renderedFarmState: GameState | undefined;
function render() {
  inventoryControls?.render();
  const owed = state.owed ?? 0,
    drought = rules().drought;
  document.querySelector("#season")!.innerHTML =
    `<span class="sr-only">Year ${state.year}/40 · ${state.season} · ${state.coins.toLocaleString()} coins${owed ? ` · ${owed.toLocaleString()} coins owed` : ""}</span><span class="calendar"><span aria-hidden="true">${icon(state.season === "summer" ? "sun" : state.season)}</span><span aria-hidden="true"><small>Year ${state.year}/40</small>${state.season}</span><span id="weather-status" data-weather="${drought ? "drought" : "normal"}" role="img" aria-label="${drought ? `Drought this ${state.season}.${state.season === "fall" ? " Winter clears field crops when this season ends." : " Unwatered growing crops lose yield when this season ends; ripe crops are safe."}` : `No drought this ${state.season}.`}">${icon(drought ? "dryWater" : "water")}</span></span><span class="coin-balance" aria-hidden="true">${icon("coin")}<span id="coin-count">${harvestFeedback.balance(state.coins).toLocaleString()}</span>${owed ? `<span id="owed">Owed ${owed.toLocaleString()}</span>` : ""}</span>`;
  // The scene draws the farm under the rules in force, the council's included.
  if (state !== renderedFarmState) {
    scene.setState({ ...state, farmPolicy: rules().policy });
    renderedFarmState = sceneCreated ? state : undefined;
  }
  councilMeeting.hidden = pendingCrisis(state) === undefined;
  crisisDialog.refresh();
  const placing = placingKind !== null;
  document.querySelector<HTMLElement>(".farm-tools")!.hidden = !placing;
  document.querySelector<HTMLButtonElement>("#farm-mode")!.hidden = !placing;
  document.querySelector<HTMLElement>("#placement-hint")!.hidden = !placing;
  const ready = state.plots.filter(
    (p) => p && !p.withered && p.growth >= crops[p.crop].steps,
  ).length;
  const withered = state.plots.filter((p) => p?.withered).length;
  document.querySelector("#farm-summary")!.textContent =
    `${state.plots.length} plots · ${ready} ready to harvest${withered ? ` · ${withered} withered` : ""} · Soil level ${state.soilLevel}/3`;
  const emptyPlots = document.querySelector("#empty-plots")!;
  const empty = state.plots.filter((plot) => plot === null).length;
  emptyPlots.setAttribute("aria-label", `${empty} empty plots`);
  emptyPlots.innerHTML = `${icon("expand")}<span aria-hidden="true">${empty}</span>`;
  const growing = state.plots.filter(
    (plot) => plot && !plot.withered && plot.growth < crops[plot.crop].steps,
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
      clearBuild();
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
    (saved.farmerVariant === undefined &&
      saved.selfBuilt === true &&
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
  characterSelect.hidden = false;
  loadingProgress.hidden = true;
  startupCopy.hidden = true;
  beginFarm.hidden = false;
  beginFarm.focus();
  message.textContent = "Visit your tent to begin.";
} else enterFarm();
