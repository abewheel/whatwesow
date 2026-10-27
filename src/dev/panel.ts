import { initialState, parseState, type GameState } from "../game/state";
export function mountDevPanel(
  getState: () => GameState,
  apply: (state: GameState) => Promise<void>,
) {
  const panel = document.createElement("details");
  panel.className = "dev-panel";
  panel.open = true;
  panel.innerHTML = `<summary>Playtest tools</summary><p>Local development only. Changes save to this instance.</p><label for="preset">Starting point</label><select id="preset"><option value="new">New farm</option><option value="mid">Year 20 · fall</option><option value="late">Year 40 · winter</option></select><button id="load-preset">Load preset</button><label for="state">Game state JSON</label><textarea id="state" spellcheck="false" rows="8"></textarea><button id="apply-state">Apply state</button><p id="dev-status" role="status"></p>`;
  document.querySelector("main")!.append(panel);
  const editor = panel.querySelector<HTMLTextAreaElement>("#state")!;
  const status = panel.querySelector<HTMLElement>("#dev-status")!;
  const sync = () => {
    editor.value = JSON.stringify(getState(), null, 2);
  };
  sync();
  panel.querySelector("#load-preset")!.addEventListener("click", () => {
    const preset = panel.querySelector<HTMLSelectElement>("#preset")!.value;
    editor.value = JSON.stringify(
      preset === "new"
        ? initialState()
        : {
            version: 1,
            year: preset === "mid" ? 20 : 40,
            season: preset === "mid" ? "fall" : "winter",
            coins: preset === "mid" ? 5000 : 12000,
          },
      null,
      2,
    );
  });
  panel.querySelector("#apply-state")!.addEventListener("click", async () => {
    try {
      await apply(parseState(JSON.parse(editor.value)));
      sync();
      status.textContent = "State applied and saved.";
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Could not apply state.";
    }
  });
}
