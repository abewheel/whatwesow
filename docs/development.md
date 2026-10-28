# Development

Start with [the session guide](session-start.md) for implemented scope and code entry points.

Use Node 22.13+ on the 22.x line (`.node-version` selects 22) and pnpm 10.20.0 (`corepack enable`). `package.json` also accepts Node 24.x and 26+.

```sh
pnpm install
pnpm dev
```

Open the printed URL. Vite reloads changes immediately. The page contains a playable Phaser farm and HTML controls. See [the farming loop](micro-game.md) for crops, reinvestment, rules, and stage presets. See [construction](construction.md) for building types and farming milestones, and [macro integration](macro-farm-contract.md) for policies and loss effects. Farming opportunities include short character notes, and [council crises](crises.md) put policy decisions to the player; other branching narrative events are still to come.

## Choose your work

Micro owns farming rules and money; macro owns lifetime progression and narrative. Read [game boundaries](game-boundaries.md) for ownership and integration contracts, then [playtesting recipes](playtesting.md) for isolated domain editing and automation.

## Jump to a state

In local development, use **Playtest tools** to load a preset, edit JSON, and apply it. Invalid states leave the current save untouched. Presets only fill the editor; **Apply state** saves and updates the view.

```sh
pnpm dev --instance validation-my-task
```

Named instances start their own server on a free port and print a URL with an instance name. Each name uses a separate IndexedDB database. Keep the printed query string when reloading. Stop the server with Ctrl+C. Production ignores instance parameters and excludes playtest tools from its bundle.

New games show a start screen after artwork, fonts, and local saves finish loading. Choose the male or female farmer using the picture buttons above Inherit your farm; male is selected by default. The choice persists through seasons, reloads, and save export/import. A failed game-artwork request keeps the farm covered and offers Reload farm; retrying preserves the saved season. They begin with no buildings or fields, a temporary tent, 240 coins, and scattered clearable debris. The tent provides End turn while the house is under construction. Founding farms persist the optional `selfBuilt: true` micro field, which controls village artwork. Existing saves retain their layout. Actions live on tiles and structures; End turn and recovery work live at home. Inventory opens from the top-right bag button or E / I, and its Shop button buys seeds using current council prices. Planting consumes owned stock.

Saves are versioned, validated, and stored locally. Export/import transfers a save as JSON. Browser storage can be cleared or evicted, so export anything you want to keep. Saves belong to each origin, including its port; return to the same port to reuse them.

## Check a change

```sh
pnpm exec playwright install chromium # once
pnpm validate
```

Validation runs formatting, lint, types, unit/integration tests, a production build, development browser tests, and production browser tests. Browser tests launch their own server on port 5181 and refuse to reuse an existing one. If another builder is testing there, use `PLAYWRIGHT_PORT=5193 pnpm validate` for an isolated development browser-test port. Production tests separately require port 5182, configured in `playwright.production.config.ts`; `PLAYWRIGHT_PORT` does not change that port. For application changes, also launch a named local instance, exercise the changed behavior, inspect browser errors and network failures, capture and inspect Playwright screenshots, and stop the instance afterward.

## Mobile checks

`pnpm exec playwright test tests/browser/mobile.spec.ts` checks touch play at 320 × 568, 390 × 844, and 667 × 375, including construction, farming, camera controls, on-screen keyboard resizing, zoom, panning, and save import/export. To check the same forms and menus in the iPhone browser engine, install WebKit with `pnpm exec playwright install webkit`, then run `pnpm exec playwright test tests/browser/mobile.spec.ts --browser=webkit --grep-invert "touch panning"`. The native gesture test uses Chromium’s touch protocol.

## Structure

- `src/micro/`: farming state, validation, pure actions, construction, and loss reconciliation.
- `src/macro/`: calendar, farm-policy and crisis-record state and validation; other authored narrative is still future work.
- `src/contracts/`: shared world dimensions and farm-policy types and validation.
- `src/game/state.ts`: save composition and domain integration.
- `src/game/crisis.ts`, `crisis-rules.ts`: when crises fire, council answers, and the farm rules they impose.
- `src/crisis/`: crisis engine loading, the council meeting, and the farmhouse's Council rules.
- `crisis-layer/`: crisis content, engine and tests, loaded as data; see [its contract](../crisis-layer/INTEGRATION.md).
- `src/game/scene.ts`, `layout.ts`, `boundary.ts`: Phaser rendering, projection, and seasonal scenery. No economic rules here.
- `src/game/farmer*.ts`: presentation tasks, adjacent-cell routing, and farmer animation.
- `src/storage/save.ts`: IndexedDB boundary.
- `src/main.ts`: application startup and HTML UI.
- `src/dev/`: development-only playtest tools.

Add narrative data and simulation rules when gameplay needs them. Do not add placeholder frameworks for future systems.

## Deployment

The `whatwesow` Cloudflare Pages project uses native GitHub integration for `abewheel/whatwesow`. Its production domain is [whatwesow.com](https://whatwesow.com), with [whatwesow.pages.dev](https://whatwesow.pages.dev) as the Pages hostname. Manage it in the personal Cloudflare account that owns the domain.

| Setting           | Value                        |
| ----------------- | ---------------------------- |
| Production branch | `main`                       |
| Build command     | `pnpm build`                 |
| Build output      | `dist`                       |
| Root directory    | Repository root              |
| Node version      | `22` (`.node-version`)       |
| pnpm version      | `10.20.0` (`packageManager`) |

Cloudflare installs dependencies, builds, and deploys on pushes. Enable branch previews for pull requests. No runtime secrets, backend, or deployment Action is needed. The separate GitHub Validate workflow checks every push and pull request; the Pages build also checks TypeScript. Pages deployments do not automatically wait for the Validate workflow. Require its check on pull requests through GitHub branch protection if needed.

Manage builds and custom domains in Cloudflare → Workers & Pages → whatwesow. Keep the GitHub app authorized for this repository. The apex domain uses a Cloudflare-managed CNAME to `whatwesow.pages.dev`. No deployment credentials belong in this repository or in GitHub secrets.

Sources: [Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

## GitHub validation performance

CI runs development browser tests across 19 timing-balanced shards alongside unit, build, and production checks. Every job must pass the aggregate `validate` gate. `scripts/browser-timings.json` contains scheduling estimates only; new tests default to ten seconds and remain included.

Failed jobs retain reports, screenshots, and traces for seven days. Inspect traces with `pnpm exec playwright show-trace path/to/trace.zip`. DOM snapshots and continuous trace screenshots are disabled to avoid copying the estate's 4,096 targets; failure screenshots remain enabled. Follow the CI rules in `AGENTS.md`.
