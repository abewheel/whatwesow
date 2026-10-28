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

**Load preset** fills the editor for the selected scope without applying it. Presets cover a new farm, year 20 fall, year 40 winter, [each farming stage](micro-game.md#iterate), and [construction and policy scenarios](construction.md#iterate). For arbitrary supported states, edit those values. Extra fields are stripped, including fields owned by the other domain. Applying the macro scope also reconciles land revocation through `applyMacroChange`; micro edits preserve the current date and policy. Export save downloads the complete state for sharing; Import save accepts a complete version 3 save or migrates version 1 and 2 saves.

## Crisis content

In local development, **Crisis test** in the top bar plays a [crisis layer](../crisis-layer/INTEGRATION.md) run one crisis at a time. Each crisis shows five arguments from named speakers. After a pick it shows the outcome and any deal to accept or decline, then moves to the next crisis, and a summary follows the last one. It calls `crisis-layer/engine.js` with `crisis-layer/content.json` and does not change the farm or its save. Picks are kept in this browser across reloads; **Start over** clears them. To change wording or numbers, edit `content.json`, then in `crisis-layer/` run `npm run content` (keeps the prototype page in step) and `npm test`, and reload. Speaker names and portraits live in `src/dev/crisis-trial.ts` and `src/dev/crisis-portraits.ts`, keyed by card key.

## Fast rule iteration

```sh
pnpm test:micro
pnpm test:macro
pnpm test:integration
pnpm exec vitest src/micro # watch while editing
pnpm validate
```

Import the owning domain's parser and initial state directly in unit tests. Use integration tests for interactions between domains. See [ownership and contracts](game-boundaries.md) before extending the schema.

## Browser and agent iteration

Use Playwright against your own named instance. Wait for `#save-status` to read `Saved on this browser`, then select `Work on`, fill `Game state JSON`, and click `Apply state`. Wait for `#dev-status` to report success and inspect `#season` and the farm canvas. The regression example is `tests/browser/shell.spec.ts`. HUD behavior is covered by `tests/browser/hud.spec.ts`; farmer adjacency and animation by `tests/browser/farmer.spec.ts`. Save status lives inside the farm menu, so `#save-status` can be asserted by text while the menu is closed; open **Open farm menu** to review it visually. Open **Estate controls** before clicking navigation, zoom, or season controls.

Check invalid input, switching scopes, persistence after reload, import/export when touched, console errors, failed requests, and server logs. Capture screenshots with Playwright and inspect each image. Stop the named instance afterward. Playtest code is dynamically imported only in development; production tests verify tools are absent and instance parameters cannot split player saves.

State is local to the instance and origin. A different port has different storage. Use export/import for a durable handoff to your co-builder.
