# Playtesting recipes

Launch an isolated instance:

```sh
pnpm dev --instance validation-my-feature
```

Keep its printed query string. Open **Playtest tools**, choose **Work on**, and edit JSON. **Apply state** validates, persists, and renders the change. Invalid input leaves the current game and save untouched. **Read current state** discards editor changes and reads the live state. Switching domains also refreshes the editor.

| Scope | Example JSON | Preserves |
| --- | --- | --- |
| Micro · farming | Read current state, then edit coins, crops, layout, or structures | Current year and season |
| Macro · lifetime | `{"year":20,"season":"fall"}` | Current farm state |
| Whole game | Version 3 export, or a legacy version 1 or 2 save | Nothing; replaces the save |

**Load preset** fills the editor for the selected scope without applying it. Presets cover a new farm, year 20 fall, year 40 winter, [each farming stage](micro-game.md#iterate), [construction and policy scenarios](construction.md#iterate), and [each council crisis](#crisis-content). For arbitrary supported states, edit those values. Extra fields are stripped, including fields owned by the other domain. Applying the macro scope also reconciles land revocation through `applyMacroChange`; micro edits preserve the current date and policy. Export save downloads the complete state for sharing; Import save accepts a complete version 3 save or migrates version 1 and 2 saves.

## Crisis content

Two separate tools play the [crisis layer](../crisis-layer/INTEGRATION.md).

**The farm's own crises.** Eight whole-game presets, from **Crisis · drought next turn** (year 2 spring) to **Crisis · second overproduction next turn** (year 30 summer), each sit one End turn before a crisis in the run order, with earlier crises answered by Ada Kessler. Apply one, then choose **End turn** to call the council. From these presets only the +80 and +40 policies can pass. Four more, labelled "…, toward control" (such as **Crisis · blight, toward control**), sit before the blight, the second drought, the second eminent domain and the second overproduction, with earlier crises answered by Nora Delgado. Picking her card again passes Blight 0, Drought 0, Eminent domain −40 and Overproduction −40, so the council's harsher rules show: dearer, treated seed and rotation, the sealed well, permits and the county's crop, the sales limit and fixed prices. Their crisis turns are `crisisTurns` (6, 22, 37, 55, 70, 86, 101 and 119) and `controlTurns` (the same, but 69 for the second drought) in `src/dev/presets.ts`. [Test crises](crises.md#test-crises) lists the presets, how to edit earlier `pick` values for other outcomes, and how to try any rule through the macro `farmPolicy`. These states change the farm and its save like any other playtest state.

**The development Crisis test.** In local development, **Crisis test** in the top bar plays a crisis layer run one crisis at a time. Each crisis shows five arguments from named speakers. After a pick it shows the outcome, any deal to accept or decline, and the policy's farm effects marked "not applied in this test". It then moves to the next crisis, and a summary follows the last one. The Crisis test is independent of the game: it keeps its picks in this browser's `localStorage` (`whatwesow-crisis-trial`) across reloads, and it never reads or writes the farm, its save, or the farm's own crisis records. **Undo last pick** steps back, and **Start over** clears its picks. Its dialog is `#crisis-trial`; the farm's council meeting is `#crisis`.

To change wording or numbers, edit `crisis-layer/content.json`, then in `crisis-layer/` run `npm run content` (keeps the prototype page in step) and `npm test`, and reload. Both tools pick up the change. Speaker names live in `src/crisis/view.ts` and portraits in `src/crisis/portraits.ts`, keyed by card key, and both tools share them. The Crisis test itself is `src/dev/crisis-trial.ts`.

## Fast rule iteration

```sh
pnpm test:micro
pnpm test:macro
pnpm test:integration
pnpm exec vitest src/micro # watch while editing
pnpm exec vitest run src/crisis src/game/crisis.test.ts # council meeting and crisis rules
(cd crisis-layer && npm test) # after editing content.json or engine.js
pnpm validate
```

Import the owning domain's parser and initial state directly in unit tests. Use integration tests for interactions between domains. See [ownership and contracts](game-boundaries.md) before extending the schema.

## Browser and agent iteration

Use Playwright against your own named instance. Wait for `#save-status` to read `Saved on this browser`, then select `Work on`, fill `Game state JSON`, and click `Apply state`. Wait for `#dev-status` to report success and inspect `#season` and the farm canvas. The regression example is `tests/browser/shell.spec.ts`. HUD behavior is covered by `tests/browser/hud.spec.ts`; farmer adjacency and animation by `tests/browser/farmer.spec.ts`. Crises are covered by `tests/browser/crisis-game.spec.ts` (council meeting, waiting, reload, one check per crisis, phones), `tests/browser/crisis-scene.spec.ts` (dry, withered, taken and sealed marks and the council office) and `tests/browser/crisis-trial.spec.ts` (the Crisis test). The `endTurn` helper in `tests/browser/helpers.ts` answers any council meeting that opens: it picks the first card, says no to a deal, and closes the meeting. Specs can import integration code such as `homesteadState` from `src/game/state.ts` and `answerCrisis` from `src/game/crisis.ts`: `src/crisis/content.ts` loads the crisis layer's `content.json` with a JSON import attribute, which Node accepts. Save status lives inside the farm menu, so `#save-status` can be asserted by text while the menu is closed; open **Open farm menu** to review it visually. Open **Estate controls** before clicking navigation, zoom, or season controls.

Check invalid input, switching scopes, persistence after reload, import/export when touched, console errors, failed requests, and server logs. Capture screenshots with Playwright and inspect each image. Specs that take screenshots write them only when an environment variable names a folder: `CROP_SCREENSHOTS_DIR` for `tests/browser/seasonal.spec.ts`, `SCENE_SCREENSHOTS_DIR` for `tests/browser/crisis-scene.spec.ts`, and `CRISIS_SCREENSHOTS_DIR` for `tests/browser/crisis-game.spec.ts` (the council meeting and Council rules), such as `CRISIS_SCREENSHOTS_DIR=test-results/crisis-shots pnpm exec playwright test crisis-game`. Without them, the specs write no screenshot files. Stop the named instance afterward. Playtest code is dynamically imported only in development; production tests verify tools are absent and instance parameters cannot split player saves.

State is local to the instance and origin. A different port has different storage. Use export/import for a durable handoff to your co-builder.
