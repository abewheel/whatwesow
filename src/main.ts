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
app.innerHTML = `<header><div><span class="eyebrow">A farm. A lifetime.</span><h1>What We Sow</h1></div><p>Grow a little. Leave something good.</p><span class="build-tag">Early preview</span></header><main><section class="farm-card" aria-label="Farm overview"><div class="farm-heading"><div><span class="eyebrow">Home, for now</span><h2>Your growing farm</h2></div><output id="season"></output></div><div id="farm" tabindex="0" aria-label="Scrollable farm. Drag, use arrow keys, or scroll to explore."><div id="farm-world"><div id="farm-renderer"></div></div></div><div class="field-note"><span class="note-icon" aria-hidden="true">✦</span><div><strong id="farm-message" role="status">Choose seeds, then click an empty plot.</strong><p>Plant → advance growth → harvest → reinvest. No real-time waiting.</p></div></div></section><section class="farm-tools" aria-label="Farming tools"><div class="seed-shop"><span class="eyebrow">Seed basket</span><div id="crop-options"></div></div><div class="work-tools"><button id="grow">Advance growth</button><button id="work" hidden>Help with a delivery · +4 coins</button><button id="expand"></button><button id="improve"></button><p id="farm-summary"></p><button id="next-season">Next season</button><button id="farm-mode">Farm tool / cancel build</button><button id="move-plot">Move a plot</button><button id="home-view">Center farm</button><button id="pan-left" aria-label="Pan left">←</button><button id="pan-right" aria-label="Pan right">→</button><label>Row <input id="view-row" aria-label="View row" type="number" min="0" max="127" value="16"></label><label>Column <input id="view-col" aria-label="View column" type="number" min="0" max="127" value="16"></label><button id="go-to-cell">Go to land</button><p id="placement-hint">Drag the field or use arrow keys to explore 16,384 cells.</p></div></section><details id="build-shop"><summary>Build & progression</summary><p id="progression"></p><div id="build-options"></div><p id="selected-building">Click a placed structure to inspect, upgrade, or move it.</p><button id="upgrade-building" hidden>Upgrade selected building</button><button id="move-building" hidden>Move selected building</button></details><aside class="save-bar"><span id="save-status" role="status">Opening your farm…</span><div><button id="export">Export save</button><label class="button" for="import">Import save</label><input id="import" type="file" accept="application/json,.json" hidden /></div></aside></main>`;
const tools = document.querySelector(".farm-tools")!;
document.querySelector("main")!.prepend(document.querySelector("#build-shop")!);
document.querySelector("main")!.prepend(tools);
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
  scene.setViewport(viewport.scrollLeft, viewport.scrollTop, width, height);
}
viewport.addEventListener("scroll", () => {
  if (!viewportFrame) viewportFrame = requestAnimationFrame(updateViewport);
});
new ResizeObserver(updateViewport).observe(viewport);
const cellButtons = new Map<string, HTMLButtonElement>();
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
  viewport.scrollLeft = p.x - viewport.clientWidth / 2;
  viewport.scrollTop = p.y - viewport.clientHeight / 2;
});
function centerFarm() {
  const p = projectCell({ row: 16, col: 16 });
  viewport.scrollLeft = p.x - viewport.clientWidth / 2;
  viewport.scrollTop = p.y - viewport.clientHeight / 2;
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
document.querySelector("#farm-mode")!.addEventListener("click", clearBuild);
function selectBuild(kind: BuildingKind | "plot") {
  buildMode = kind;
  movingId = null;
  movingPlotId = null;
  pickingPlot = false;
  preview.hidden = true;
  render();
  document.querySelector<HTMLDetailsElement>("#build-shop")!.open = false;
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
  button.innerHTML = `<strong>${crop.name}</strong><span>${crop.steps} grow step${crop.steps === 1 ? "" : "s"}</span><span class="crop-return"></span>`;
  button.addEventListener("click", () => {
    buildMode = null;
    movingId = null;
    movingPlotId = null;
    pickingPlot = false;
    preview.hidden = true;
    selected = id as CropId;
    render();
    message.textContent = `${crop.name} seeds selected. Click an empty plot.`;
  });
  cropOptions.append(button);
}
let farmQueue: Promise<void> = Promise.resolve();
function act(action: FarmAction | { type: "season" }) {
  farmQueue = farmQueue.then(async () => {
    try {
      const result =
        action.type === "season"
          ? advanceSeason(state)
          : actOnFarm(state, action, farmContext(state));
      await apply(
        action.type === "season"
          ? (result.state as typeof state)
          : replaceDomain(state, "micro", result.state),
      );
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
          document.querySelector<HTMLDetailsElement>("#build-shop")!.open =
            true;
          render();
          return;
        }
        message.textContent =
          "Open land. Choose a plot, tree, or structure in Build & progression.";
      });
      button.addEventListener("pointerenter", () => showPreview(target));
      button.addEventListener("focus", () => showPreview(target));
      Object.assign(button.style, {
        left: `${target.x}px`,
        top: `${target.y}px`,
        width: "64px",
        height: "32px",
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
    left: `${pos.x - item.height * 32}px`,
    top: `${pos.y - 16}px`,
    width: `${total * 32}px`,
    height: `${total * 16}px`,
    clipPath: `polygon(${(item.height / total) * 100}% 0,100% ${(item.width / total) * 100}%,${(item.width / total) * 100}% 100%,0 ${(item.height / total) * 100}%)`,
  });
}
document.querySelector("#move-plot")!.addEventListener("click", () => {
  buildMode = null;
  movingId = null;
  movingPlotId = null;
  pickingPlot = true;
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
  document.querySelector<HTMLDetailsElement>("#build-shop")!.open = false;
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
  document.querySelector("#season")!.textContent =
    `Year ${state.year} · ${state.season} · ${state.coins.toLocaleString()} coins`;
  scene.setState(state);
  const turn = turnNumber(state),
    policy = state.farmPolicy ?? {};
  document.querySelector<HTMLButtonElement>("#next-season")!.disabled =
    turn === 160;
  document.querySelector("#next-season")!.textContent =
    turn === 160 ? "Final season · 160/160" : `Next season · ${turn}/160`;
  document.querySelector("#progression")!.textContent =
    `Turn ${turn}/160 · ${state.structures.length} structures · Seasonal income ${policyProduction(seasonalIncome(state), policy)} coins. Unlocks follow the seasons; growth stays within a season.`;
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
    const unlock = buildUnlock(kind, policy),
      cost = policyCost(item.cost, policy),
      limit = policy.buildingLimits?.[kind];
    button.textContent = `${item.name} · ${item.width}×${item.height} · ${cost} coins · ${turn < unlock ? `Unlock turn ${unlock}` : `${count} built`} · ${item.benefit}`;
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
    button.querySelector(".crop-return")!.textContent =
      `Seeds: ${policyCost(seedCost(state, id), policy)} · Harvest: ${policyProduction(harvestValue(state, id), policy)} coins`;
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
  expand.textContent =
    state.plots.length === WORLD_CELLS
      ? "All 16384 plots open"
      : `Open a plot · ${policyCost(expansionCost(state), state.farmPolicy)} coins`;
  expand.disabled =
    state.plots.length >= (policy.maxPlots ?? WORLD_CELLS) ||
    state.coins < policyCost(expansionCost(state), policy);
  const improve = document.querySelector<HTMLButtonElement>("#improve")!;
  improve.textContent =
    state.soilLevel === 3
      ? "Soil fully improved"
      : `Improve soil · ${policyCost(soilCost(state), policy)} coins (+3 / harvest)`;
  improve.disabled =
    state.soilLevel === 3 ||
    state.coins < policyCost(soilCost(state), policy) ||
    turn < [1, 33, 97][state.soilLevel];
  if (state.soilLevel < 3 && turn < [1, 33, 97][state.soilLevel])
    improve.textContent += ` · unlock turn ${[1, 33, 97][state.soilLevel]}`;
  const ready = state.plots.filter(
    (p) => p && p.growth === crops[p.crop].steps,
  ).length;
  document.querySelector("#farm-summary")!.textContent =
    `${state.plots.length} plots · ${ready} ready to harvest · Soil level ${state.soilLevel}/3`;
}
async function apply(next: typeof state) {
  const valid = parseState(next);
  if (!store) throw new Error("Local saves are unavailable.");
  if (saving) throw new Error("A save is in progress. Try again.");
  saving = true;
  try {
    await store.save(valid);
    state = valid;
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
  mountDevPanel(() => state, apply);
}
