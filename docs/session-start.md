# Start a session

Read this after the repository's `AGENTS.md` and `README.md`. It describes the implemented slice; the project overview in `AGENTS.md` also includes the longer-term design.

## Current playable scope

- Start on bare land with a tent and 240 coins. Use the tent for house plans, fields, seeds, and End turn. The house takes one season to build and replaces the tent; the same services then live in the farmhouse menu. Existing developed saves retain their village services.
- Plant turnips, carrots, and corn in their allowed seasons; end a turn to grow crops across seasons; harvest crops and ripe fruit for coins; buy plots and soil improvements.
- Place, repeat, move, and upgrade structures on a 64 × 64 estate. Pan, jump to coordinates, and zoom from 25% to 200%.
- Advance through four seasons across 40 years, ending at turn 160. Construction and upgrades charge immediately, complete next season, and then apply their benefits. Apple trees mature after three years and oaks after ten; mature trees produce harvestable apples or acorns each fall. Markets pay seasonal income. Authored construction unlocks work, but the full lifetime economy is not balanced.
- Apply macro farm policies and explicit losses through integration. Narrative dialogue, authored community decisions, relationships, animals, and the legacy ending are still future work.
- See seasonal scenery, exterior woodland and river, and an animated farmer who walks to adjacent work positions. Clicking ground sends the farmer there. Building menus open on arrival, and planting and harvesting commit only after reaching the plot or tree. A new destination or Escape cancels unfinished travel actions.
- Autosave locally, export/import saves, and edit development-only playtest states. Current saves are version 3; versions 1 and 2 migrate.

On a new farm, click the tent, then the farmhouse, for the calendar, building plans, fields, and seeds. On older developed farms, click the farmhouse for the calendar, the nursery for seeds and saplings, the field shed for plots, soil and tree care, and the builder for structures. The compact HUD shows the selected seeds, placement cancellation, and folded View controls for camera navigation. Open the farm menu for save status and export/import. See [construction](construction.md) for controls and [farming](micro-game.md) for the loop.

## Find the owning code

| Task | Start here | Supporting guide |
| --- | --- | --- |
| Crops, prices, soil, farming actions | `src/micro/state.ts`, `src/micro/rules.ts` | [Farming loop](micro-game.md) |
| Buildings, footprints, placement, unlocks | `src/micro/world.ts`, `src/micro/progression.ts` | [Construction](construction.md) |
| Calendar and policy state | `src/macro/state.ts` | [Macro contract](macro-farm-contract.md) |
| Save migration and cross-domain transitions | `src/game/state.ts` | [Ownership](game-boundaries.md) |
| Shared grid and policy types | `src/contracts/world.ts`, `src/contracts/farm-policy.ts` | [Ownership](game-boundaries.md) |
| Farm rendering, projection, exterior scenery | `src/game/scene.ts`, `src/game/layout.ts`, `src/game/boundary.ts` | [Design system](design-system.md) |
| Farmer routing and animation | `src/game/farmer-route.ts`, `src/game/farmer-task.ts`, `src/game/farmer.ts` | [Art assets](art-assets.md) |
| HTML controls, icons, styling | `src/main.ts`, `src/game/icons.ts`, `src/style.css` | [HUD artwork](art/hud-generation.md) |
| Persistence and playtest tools | `src/storage/save.ts`, `src/dev/` | [Playtesting](playtesting.md) |

Read [ownership and contracts](game-boundaries.md) before changing rules. Domain modules stay pure and do not import the other domain, integration, storage, or rendering. Use integration for whole-state transitions, including calendar income and policy losses. Art requirements in [the asset inventory](asset-inventory.md) describe planned coverage as well as existing assets; they do not introduce game mechanics.

## First steps and handoff

1. Inspect `git status --short` and recent commits so you preserve existing work and catch changes newer than these docs.
2. Use the Node range and pinned pnpm version in `package.json`; follow [development](development.md) for installation. Launch your own `pnpm dev --instance validation-<task-id>` and keep its printed URL.
3. Choose the smallest relevant [playtest preset](playtesting.md). Use micro scope to preserve the calendar and policy; use whole-game scope for construction and progression scenarios. Macro date edits do not pay seasonal income.
4. Run focused tests during edits, then `pnpm validate`. For application changes, exercise every changed path in Playwright on your own ready instance, inspect logs, console and failed requests, and capture and inspect current screenshots for UI changes.
5. Stop your local instance. Report what changed, checks run, and any remaining blocker. Update the relevant guide when controls, rules, save contracts, or validation commands change.

Documentation changes alone do not require application screenshots. Do not present planned systems as playable or treat a test pass as a balance playtest.
