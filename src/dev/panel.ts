import { parseMacroState } from "../macro/state";
import { presetState } from "./presets";
import {
  parseState,
  readDomain,
  replaceDomain,
  applyMacroChange,
  type Domain,
  type GameState,
} from "../game/state";
export function mountDevPanel(
  getState: () => GameState,
  apply: (state: GameState) => Promise<void>,
) {
  const panel = document.createElement("details");
  panel.className = "dev-panel";
  panel.open = true;
  panel.innerHTML = `<summary>Playtest tools</summary><p>Local development only. Changes save to this instance.</p><label for="scope">Work on</label><select id="scope"><option value="full">Whole game</option><option value="micro">Micro · farming</option><option value="macro">Macro · lifetime</option></select><button id="read-state">Read current state</button><p>Domain edits preserve the other domain. Load a preset or read current state, edit JSON, then apply.</p><label for="preset">Starting point</label><select id="preset"><option value="new">New farm</option><option value="expanse">Large estate · far corner</option><option value="homestead">Building · turn 1</option><option value="community">Community · turn 25</option><option value="industry">Industry · turn 81</option><option value="legacy">Legacy · turn 159</option><option value="restricted">Policy · land and building loss</option><option value="planting">Planting · empty fields</option><option value="growing">Growing · mixed seedlings</option><option value="harvesting">Harvesting · ripe fields</option><option value="reinvesting">Reinvesting · 250 coins</option><option value="mid">Year 20 · fall</option><option value="late">Year 40 · winter</option></select><button id="load-preset">Load preset</button><label for="state">Game state JSON</label><textarea id="state" spellcheck="false" rows="8"></textarea><button id="apply-state">Apply state</button><p id="dev-status" role="status"></p>`;
  document.querySelector("main")!.append(panel);
  const editor = panel.querySelector<HTMLTextAreaElement>("#state")!;
  const status = panel.querySelector<HTMLElement>("#dev-status")!;
  const scope = panel.querySelector<HTMLSelectElement>("#scope")!;
  const select = (state: GameState) =>
    scope.value === "full" ? state : readDomain(state, scope.value as Domain);
  const sync = () => {
    editor.value = JSON.stringify(select(getState()), null, 2);
  };
  scope.addEventListener("change", sync);
  panel.querySelector("#read-state")!.addEventListener("click", sync);
  sync();
  panel.querySelector("#load-preset")!.addEventListener("click", () => {
    const preset = panel.querySelector<HTMLSelectElement>("#preset")!.value;
    editor.value = JSON.stringify(select(presetState(preset)), null, 2);
  });
  panel.querySelector("#apply-state")!.addEventListener("click", async () => {
    try {
      const value: unknown = JSON.parse(editor.value);
      await apply(
        scope.value === "full"
          ? parseState(value)
          : scope.value === "macro"
            ? applyMacroChange(getState(), parseMacroState(value)).state
            : replaceDomain(getState(), scope.value as Domain, value),
      );
      sync();
      status.textContent = "State applied and saved.";
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Could not apply state.";
    }
  });
}
