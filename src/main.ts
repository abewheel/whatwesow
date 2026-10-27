import Phaser from "phaser";
import { FarmScene } from "./game/scene";
import { initialState, parseState, replaceDomain } from "./game/state";
import { openSaveStore } from "./storage/save";
import "./style.css";
import { actOnFarm, type FarmAction } from "./micro/rules";
import {
  crops,
  expansionCost,
  harvestValue,
  soilCost,
  type CropId,
} from "./micro/state";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header><div><span class="eyebrow">A farm. A lifetime.</span><h1>What We Sow</h1></div><p>Grow a little. Leave something good.</p><span class="build-tag">Early preview</span></header><main><section class="farm-card" aria-label="Farm overview"><div class="farm-heading"><div><span class="eyebrow">Home, for now</span><h2>Your first acre</h2></div><output id="season"></output></div><div id="farm" aria-label="Interactive farm plots"></div><div class="field-note"><span class="note-icon" aria-hidden="true">✦</span><div><strong id="farm-message" role="status">Choose seeds, then click an empty plot.</strong><p>Plant → advance growth → harvest → reinvest. No real-time waiting.</p></div></div></section><section class="farm-tools" aria-label="Farming tools"><div class="seed-shop"><span class="eyebrow">Seed basket</span><div id="crop-options"></div></div><div class="work-tools"><button id="grow">Advance growth</button><button id="work" hidden>Help with a delivery · +4 coins</button><button id="expand"></button><button id="improve"></button><p id="farm-summary"></p><small>Growth steps stay within this season. Calendar progression comes later.</small></div></section><aside class="save-bar"><span id="save-status" role="status">Opening your farm…</span><div><button id="export">Export save</button><label class="button" for="import">Import save</label><input id="import" type="file" accept="application/json,.json" hidden /></div></aside></main>`;
const tools = document.querySelector(".farm-tools")!;
document.querySelector("main")!.prepend(tools);
const status = document.querySelector<HTMLElement>("#save-status")!;
const scene = new FarmScene();
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "farm",
  backgroundColor: "#83ad65",
  scene,
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  render: { antialias: false, pixelArt: true },
  audio: { noAudio: true },
});
let state = initialState();
let selected: CropId = "turnip";
let saving = false;
const message = document.querySelector<HTMLElement>("#farm-message")!;
const cropOptions = document.querySelector<HTMLElement>("#crop-options")!;
for (const [id, crop] of Object.entries(crops)) {
  const button = document.createElement("button");
  button.dataset.crop = id;
  button.innerHTML = `<strong>${crop.name}</strong><span>${crop.seed} coins · ${crop.steps} grow step${crop.steps === 1 ? "" : "s"}</span><span class="crop-return"></span>`;
  button.addEventListener("click", () => {
    selected = id as CropId;
    render();
    message.textContent = `${crop.name} seeds selected. Click an empty plot.`;
  });
  cropOptions.append(button);
}
let farmQueue: Promise<void> = Promise.resolve();
function act(action: FarmAction) {
  farmQueue = farmQueue.then(async () => {
    try {
      const result = actOnFarm(state, action);
      await apply(replaceDomain(state, "micro", result.state));
      message.textContent = result.message;
    } catch (error) {
      message.textContent =
        error instanceof Error ? error.message : "Could not work the farm.";
    }
  });
  return farmQueue;
}
scene.onLayout = (targets) => {
  const host = document.querySelector<HTMLElement>("#farm")!;
  for (const old of host.querySelectorAll<HTMLButtonElement>(".plot-hit"))
    if (!targets.some((t) => String(t.index) === old.dataset.plot))
      old.remove();
  for (const target of targets) {
    let button = host.querySelector<HTMLButtonElement>(
      `[data-plot="${target.index}"]`,
    );
    if (!button) {
      button = document.createElement("button");
      button.className = "plot-hit";
      button.dataset.plot = String(target.index);
      button.addEventListener("click", () => {
        const plot = state.plots[target.index];
        void act(
          plot
            ? { type: "harvest", plot: target.index }
            : { type: "plant", plot: target.index, crop: selected },
        );
      });
      host.append(button);
    }
    const plot = state.plots[target.index];
    const description = !plot
      ? "empty"
      : `${crops[plot.crop].name}, ${plot.growth === crops[plot.crop].steps ? "ready to harvest" : `growing ${plot.growth}/${crops[plot.crop].steps}`}`;
    button.setAttribute(
      "aria-label",
      `Plot ${target.index + 1}: ${description}`,
    );
    button.title = button.getAttribute("aria-label")!;
    Object.assign(button.style, {
      left: `${target.x}px`,
      top: `${target.y}px`,
      width: `${target.width}px`,
      height: `${target.height}px`,
    });
  }
};
document
  .querySelector("#work")!
  .addEventListener("click", () => void act({ type: "work" }));
document
  .querySelector("#grow")!
  .addEventListener("click", () => void act({ type: "grow" }));
document
  .querySelector("#expand")!
  .addEventListener("click", () => void act({ type: "expand" }));
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
  for (const button of cropOptions.querySelectorAll<HTMLButtonElement>(
    "button",
  )) {
    const id = button.dataset.crop as CropId;
    button.setAttribute("aria-pressed", String(id === selected));
    button.querySelector(".crop-return")!.textContent =
      `Harvest: ${harvestValue(state, id)} coins`;
  }
  document.querySelector<HTMLButtonElement>("#work")!.hidden =
    state.coins >= crops.turnip.seed || state.plots.some(Boolean);
  const grow = document.querySelector<HTMLButtonElement>("#grow")!;
  grow.disabled = !state.plots.some((p) => p && p.growth < crops[p.crop].steps);
  const expand = document.querySelector<HTMLButtonElement>("#expand")!;
  expand.textContent =
    state.plots.length === 49
      ? "All plots open"
      : `Open a plot · ${expansionCost(state)} coins`;
  expand.disabled =
    state.plots.length === 49 || state.coins < expansionCost(state);
  const improve = document.querySelector<HTMLButtonElement>("#improve")!;
  improve.textContent =
    state.soilLevel === 3
      ? "Soil fully improved"
      : `Improve soil · ${soilCost(state)} coins (+3 / harvest)`;
  improve.disabled = state.soilLevel === 3 || state.coins < soilCost(state);
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
