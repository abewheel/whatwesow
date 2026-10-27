import Phaser from "phaser";
import { FarmScene } from "./game/scene";
import { initialState, parseState } from "./game/state";
import { openSaveStore } from "./storage/save";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header><div><span class="eyebrow">A farm. A lifetime.</span><h1>What We Sow</h1></div><p>Grow a little. Leave something good.</p><span class="build-tag">Early preview</span></header><main><section class="farm-card" aria-label="Farm overview"><div class="farm-heading"><div><span class="eyebrow">Home, for now</span><h2>Your first acre</h2></div><output id="season"></output></div><div id="farm" role="img" aria-label="Isometric farm with tilled plots, a cottage, barn, garden shed, flowering trees, stone well, and stream"></div><div class="field-note"><span class="note-icon" aria-hidden="true">✦</span><div><strong>A place to begin</strong><p>The ground is ready. Our story is still taking root.</p></div><span class="preview-note">Farming & story coming later</span></div></section><aside class="save-bar"><span id="save-status" role="status">Opening your farm…</span><div><button id="export">Export save</button><label class="button" for="import">Import save</label><input id="import" type="file" accept="application/json,.json" hidden /></div></aside></main>`;
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
}
async function apply(next: typeof state) {
  const valid = parseState(next);
  if (!store) throw new Error("Local saves are unavailable.");
  await store.save(valid);
  state = valid;
  render();
  status.textContent = "Saved on this browser";
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
