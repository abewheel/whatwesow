# Start a session

Read this after the repository's `AGENTS.md` and `README.md`. It describes the implemented slice; the project overview in `AGENTS.md` also includes the longer-term design.

## Current playable scope

- Start with a tent, a permanent wild beehive at the topmost corner, 240 coins, and scattered debris. Collect honey from the hive for 12 coins once every season, including winter. Clear weeds for free, gather berry bushes for 5 coins, or pay 4 coins for loose stones, 12 for fallen logs and 24 for boulders, 36 for five-tile L-shaped fallen trees, and 54 for nine-tile rocky outcrops. Debris reserves its tiles until cleared; open starter lots leave room to build. Tap land for fields and house plans. The house takes one season to build and replaces the tent; End turn lives on the tent until then, then on the farmhouse. Existing developed saves retain their village artwork.
- Plant turnips, carrots, corn, radishes, tomatoes, and pumpkins in their allowed seasons; end a turn to grow crops across seasons; harvest crops and ripe fruit for coins; buy plots and soil improvements. All field crops die when winter begins; trees survive.
- Place, repeat, upgrade, and tear down structures on a 64 × 64 estate. Buildings scale proportionally and reserve larger lots, up to 5 × 5 tiles. Older farms migrate once without losing crops or progress. Pan in four directions and zoom from 50% to 200%.
- Advance through four seasons across 40 years, ending at turn 160. Construction and upgrades charge immediately, complete next season unless a council rule delays them, and then apply their benefits. Apple trees mature after three years and oaks after ten; mature trees produce harvestable apples or acorns each fall. Markets pay seasonal income. Authored construction unlocks work, with a tested earning path through the complete construction track over 160 turns.
- Build wooden beehives for 120 coins, with 15 coins of honey each season and a 2 × 2 lot. Build chicken coops, dairy barns, and sheepfolds with animated animals and seasonal pens. Tap a pen and choose Collect for eggs, milk, or wool once each season; coins arrive after the farmer reaches the building.
- Face eight council crises, one every four years from year 2 to year 30: drought, blight, eminent domain, overproduction and a price crash, with drought, eminent domain and overproduction coming twice. End turn calls a council meeting; the argument the player picks decides which policy passes, and its rules change water, seed, prices, sales, land and buildings from then on. The farm and the next season wait for an answer. See [crises](crises.md).
- Apply macro farm policies and explicit losses through integration. Other narrative dialogue and community decisions, relationships, and the legacy ending are still future work.
- See seasonal scenery, exterior woodland and river, and an animated farmer who walks to adjacent work positions. Tap ground for its actions, with automatic walking. Menus open immediately. Planting and harvesting commit after reaching the plot or tree, and End turn commits after reaching home. A new destination or Escape cancels unfinished travel actions.
- Autosave locally, export/import saves, and edit development-only playtest states. Current saves are version 3; versions 1 and 2 migrate.

Tap open land for a crop plot, building, or tree at that tile. Tap plots to plant owned seasonal seeds, harvest, and improve soil. Tap structures for upgrades or teardown and trees for harvest and care. Menus open immediately beside the selected target, flip at screen edges, and follow panning and viewport changes. End turn is only on the farmhouse, or the tent before the house finishes. The farmer must reach home before the season advances. Delivery work at home helps a broke farm recover. Seed purchases live in the shop; field and building plans live on land. The top-right HUD shows the season, year out of 40, coins, and empty-plot, growing-crop, and harvest-ready counts, with farm feedback below. It holds a top-right 2 × 2 shortcut grid: View and Menu above Inventory (E or I) and Shop. Shop opens seed purchases directly, and movement cancellation stays in the farming tools; the farm menu holds saves and restart with confirmation. View controls provide zoom, four-direction pan, and centering. After a crisis, the farmhouse popup lists **Council rules**, the HUD shows **Council meeting** while the council waits and how much is owed while coins are owed, and a council office appears while planting permits are required. See [construction](construction.md) and [farming](micro-game.md).

## Find the owning code

| Task                                                            | Start here                                                                  | Supporting guide                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| Crops, prices, soil, farming actions                            | `src/micro/state.ts`, `src/micro/rules.ts`                                  | [Farming loop](micro-game.md)                         |
| Owed coins, seed and sale quotes, delivery work                 | `src/micro/money.ts`                                                        | [Farming loop](micro-game.md#council-rules-and-crops) |
| Buildings, footprints, placement, unlocks                       | `src/micro/world.ts`, `src/micro/progression.ts`                            | [Construction](construction.md)                       |
| Calendar, policy state, crisis records                          | `src/macro/state.ts`                                                        | [Macro contract](macro-farm-contract.md)              |
| Save migration and cross-domain transitions                     | `src/game/state.ts`                                                         | [Ownership](game-boundaries.md)                       |
| When crises fire, answers, and the farm rules they impose       | `src/game/crisis.ts`, `src/game/crisis-rules.ts`                            | [Crises](crises.md)                                   |
| Council meeting, Council rules, crisis engine loading           | `src/crisis/`                                                               | [Crises](crises.md#where-the-code-lives)              |
| Crisis wording, policies, council window math                   | `crisis-layer/content.json`, `crisis-layer/engine.js`                       | [Crisis layer](../crisis-layer/INTEGRATION.md)        |
| Shared grid and policy types                                    | `src/contracts/world.ts`, `src/contracts/farm-policy.ts`                    | [Ownership](game-boundaries.md)                       |
| Farm rendering, projection, exterior scenery                    | `src/game/scene.ts`, `src/game/layout.ts`, `src/game/boundary.ts`           | [Design system](design-system.md)                     |
| Farmer routing and animation                                    | `src/game/farmer-route.ts`, `src/game/farmer-task.ts`, `src/game/farmer.ts` | [Art assets](art-assets.md)                           |
| HTML controls, icons, styling                                   | `src/main.ts`, `src/game/icons.ts`, `src/style.css`                         | [HUD artwork](art/hud-generation.md)                  |
| Persistence, playtest tools, crisis presets and the Crisis test | `src/storage/save.ts`, `src/dev/`                                           | [Playtesting](playtesting.md)                         |

Read [ownership and contracts](game-boundaries.md) before changing rules. Domain modules stay pure and do not import the other domain, integration, storage, or rendering. Use integration for whole-state transitions, including calendar income, policy losses and crises. Art requirements in [the asset inventory](asset-inventory.md) describe planned coverage as well as existing assets; they do not introduce game mechanics.

## First steps and handoff

1. Inspect `git status --short` and recent commits so you preserve existing work and catch changes newer than these docs.
2. Use the Node range and pinned pnpm version in `package.json`; follow [development](development.md) for installation. Launch your own `pnpm dev --instance validation-<task-id>` and keep its printed URL.
3. Choose the smallest relevant [playtest preset](playtesting.md). Use micro scope to preserve the calendar and policy; use whole-game scope for construction and progression scenarios. Macro date edits do not pay seasonal income.
4. Run focused tests during edits, then `pnpm validate`. For application changes, exercise every changed path in Playwright on your own ready instance, inspect logs, console and failed requests, and capture and inspect current screenshots for UI changes.
5. Stop your local instance. Report what changed, checks run, and any remaining blocker. Update the relevant guide when controls, rules, save contracts, or validation commands change.

Documentation changes alone do not require application screenshots. Do not present planned systems as playable or treat a test pass as a balance playtest.

Seed purchases happen in the shop, opened from Inventory or Seeds at home. The shop displays current seed prices, sale proceeds, premium risk and planting charges. Planting consumes one owned seed, then applies current plot restrictions, fees and fines without charging the seed price again. Premium stock preserves purchase terms through policy expiry. Trashcans delete fields immediately or tear down structures next season, without refunds.
