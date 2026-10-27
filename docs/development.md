# Development

Start with [the session guide](session-start.md) for implemented scope and code entry points.

Use Node 22.13+ on the 22.x line (`.node-version` selects 22) and pnpm 10.20.0 (`corepack enable`). `package.json` also accepts Node 24.x and 26+.

```sh
pnpm install
pnpm dev
```

Open the printed URL. Vite reloads changes immediately. The page contains a playable Phaser farm and HTML controls. See [the farming loop](micro-game.md) for crops, reinvestment, rules, and stage presets. See [construction](construction.md) for building types and the 160-turn track, and [macro integration](macro-farm-contract.md) for policies and loss effects. Narrative events are still to come.

## Choose your work

Micro owns farming rules and money; macro owns lifetime progression and narrative. Read [game boundaries](game-boundaries.md) for ownership and integration contracts, then [playtesting recipes](playtesting.md) for isolated domain editing and automation.

## Jump to a state

In local development, use **Playtest tools** to load a preset, edit JSON, and apply it. Invalid states leave the current save untouched. Presets only fill the editor; **Apply state** saves and updates the view.

```sh
pnpm dev --instance validation-my-task
```

Named instances start their own server on a free port and print a URL with an instance name. Each name uses a separate IndexedDB database. Keep the printed query string when reloading. Stop the server with Ctrl+C. Production ignores instance parameters and excludes playtest tools from its bundle.

Saves are versioned, validated, and stored locally. Export/import transfers a save as JSON. Browser storage can be cleared or evicted, so export anything you want to keep. Saves belong to each origin, including its port; return to the same port to reuse them.

## Check a change

```sh
pnpm exec playwright install chromium # once
pnpm validate
```

Validation runs formatting, lint, types, unit/integration tests, a production build, development browser tests, and production browser tests. Browser tests launch their own server on port 5181 and refuse to reuse an existing one. If another builder is testing there, use `PLAYWRIGHT_PORT=5193 pnpm validate` for an isolated development browser-test port. Production tests separately require port 5182, configured in `playwright.production.config.ts`; `PLAYWRIGHT_PORT` does not change that port. For application changes, also launch a named local instance, exercise the changed behavior, inspect browser errors and network failures, capture and inspect Playwright screenshots, and stop the instance afterward.

## Structure

- `src/micro/`: farming state, validation, pure actions, construction, and loss reconciliation.
- `src/macro/`: calendar and farm-policy state and validation; authored narrative is still future work.
- `src/contracts/`: shared world dimensions and farm-policy types and validation.
- `src/game/state.ts`: save composition and domain integration.
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
