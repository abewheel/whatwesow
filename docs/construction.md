# Construction and progression

The estate is a 64 × 64 grid with 4,096 cells. Plots, buildings, and trees all occupy cells; multi-cell footprints cannot overlap or cross its edge. Every building type can be repeated. There are no one-per-type caps. Money, footprint space, authored unlocks, and any macro policy determine what the player can build.

New farms start with a tent, no fields or buildings, and 240 coins. Tap open land for fields and house plans. Tap the tent for End turn. A house costs 120 coins and takes one season to complete. The tent stays until then, and End turn moves into the finished farmhouse. Other construction unlocks through farming.

If structures block a walking path, tap the blocking building or tree and choose Move or Transplant. Movement is free and its menu does not require a walking path.

Tap land or a structure to open its actions immediately beside it. Popups flip and clamp to the viewport, keep their close control visible, and follow camera movement. End turn is a farmhouse interaction, with the tent providing it before construction finishes. The farmer walks home before advancing the season. Building movement remains available without a walking path so blocked layouts can be repaired.

Choose land, then a plan in that tile's popup. Plans that cannot fit or cannot be afforded stay disabled. Tap a structure for upgrades or movement. Tap a ripe tree and choose Harvest to collect on arrival; care and transplant options live on that tree. Moving a plot carries its growing crop too. After choosing Move, tap the destination; **Cancel placement** or Escape cancels movement. Drag, scroll, or use arrow keys to explore. The top-right magnifying-glass **View controls** button holds zoom, four-direction pan, and **Center farm**. The canvas stays viewport-sized and renders nearby terrain.

Use **Zoom out** and **Zoom in** for 50%–200% views, or **100%** to reset. With the farm focused, `+`, `−`, and `0` do the same. Zoom preserves the view center where map edges allow it, scales click targets and placement previews together, and resets on reload without changing the save.

## Farming opportunities

Definitions live in `src/micro/world.ts`. The first facility costs its base price. Each additional facility of that kind costs base price × (1 + existing levels), including paid work underway. Trees keep their base price so orchards can grow. Upgrades keep their base price × new level and save land compared with another building. Benefits add across buildings and their levels, then macro production policy applies.

| Build           | Milestone                               | Base cost | Footprint | Effect per level                                      |
| --------------- | --------------------------------------- | --------- | --------- | ----------------------------------------------------- |
| Farmhouse       | Available at start                      | 120       | 5 × 4     | Home and calendar                                     |
| Chicken coop    | 3 harvests                              | 240       | 4 × 4     | Collect eggs for 30 coins per level each season       |
| Dairy barn      | 12 harvests                             | 750       | 5 × 5     | Collect milk for 75 coins per level each season       |
| Sheepfold       | 24 harvests                             | 1,200     | 5 × 5     | Collect wool for 120 coins per level each season      |
| Seed storehouse | 3 harvests                              | 60        | 3 × 3     | Seeds cost 1 less, minimum 1 before policy            |
| Oak tree        | Available at start                      | 15        | 1 × 1     | Acorns each fall after ten years                      |
| Apple tree      | 6 harvests                              | 60        | 1 × 1     | 24 coins per level per fall harvest after three years |
| Irrigation well | 12 harvests and 10 plots                | 180       | 3 × 3     | 1 extra grow step and 1 extra harvest coin            |
| Harvest barn    | 24 harvests                             | 600       | 5 × 4     | 2 extra harvest coins                                 |
| Grain mill      | 12 corn harvests                        | 1,800     | 5 × 5     | 15 extra coins per corn harvest                       |
| Greenhouse      | 80 harvests and soil level 1            | 2,400     | 5 × 4     | 10 extra harvest coins                                |
| Farm market     | 160 harvests, including all three crops | 3,000     | 5 × 5     | 150 coins on each season transition                   |
| Legacy hall     | 300 harvests and a farm market          | 10,000    | 5 × 5     | 50 extra harvest coins                                |

Turnips and carrots are available at the start. Harvest one of each to receive Eli's corn seed offer. New plans appear on open land as milestones are earned. Selected buildings show upgrade requirements. Offers remain available once earned, even after land or building losses. There is no research currency or separate progression screen.

Production buildings and apple trees have three levels. Each individual building earns level 2 after 12 harvests made since construction completes, and level 3 after 24 more harvests since its last upgrade completes. Mills count only corn harvests. An upgrade costs base cost × the new level. Homes and oaks have one level. Soil improvements need 3, 30, and 90 total harvests, in order, and cost 80, 160, and 240 coins.

Upgrades and soil improvements cost coins when started and finish at the start of the next turn. Their benefits stay at the current level until then. Each building and the soil can have one upgrade underway; different buildings can upgrade together. Pending work survives saving, reloading, and moving a building. Losing a building also loses its pending upgrade, without a refund. New construction also charges immediately and finishes next season. Its footprint stays reserved while work is underway, but its benefits remain inactive. Buildings use unfinished timber-and-stone artwork, with a work symbol and grey name while construction or an upgrade is pending. Trees start as saplings and grow over multiple years, with visible sapling, growing, and mature stages. The starting farmhouse and structures in older saves are already complete.

**End turn** advances one season, grows crops using the previous turn's irrigation, completes construction and upgrades, then pays seasonal market income at the completed levels. Mature trees produce in fall; click a ripe tree to harvest it. The tree stays planted and produces again the following fall. Unpicked fruit keeps without stacking, and fruit earns no automatic income. Tap a tree to inspect, care for, or move it. Seed discounts and harvest bonuses apply to actions in the new turn. Turn 160 is year 40, winter; the calendar stops there, so new construction and upgrades cannot start in that final season. There is no end-of-life narrative in this slice.

Tune milestones in `src/micro/progression.ts`. Calendar advancement never earns farming opportunities. A first market repays its price in 20 season transitions; its upgrades take 40 and 60 transitions. Market plans and inspections show payback against the remaining lifetime, including policy-adjusted prices and income. Late purchases may not repay their cost before the final winter.

## System boundaries

- `src/contracts/farm-policy.ts`: shared serializable policy contract and validation. Macro owns policy decisions.
- `src/micro/world.ts`: definitions, footprints, geometric placement, derived effects.
- `src/micro/rules.ts`: pure build, upgrade, move, plant, grow, and harvest actions.
- `src/micro/consequences.ts`: pure loss reconciliation and stable entity removal.
- `src/game/state.ts`: save migration, context projection, atomic macro/farm changes.
- `src/game/scene.ts`: drawing only. Changing art does not change placement, ownership, or economic rules.

Micro state owns placed objects, crops, soil, and money. Macro owns time and optional `farmPolicy`. Both domains import shared contracts, never each other's implementation. Use [the macro integration contract](macro-farm-contract.md) when adding narrative restrictions or losses.

Harvest counts, earned opportunities, and each building’s harvest baseline persist in version 3 saves. Older saves default to zero recorded harvests, retain corn seed access and offers for owned structures, and preserve their existing upgrades and soil. Obsolete `unlockTurns` policy fields are ignored on import.

Version 3 saves carry `plotCells`, `plotIds`, `nextPlotId`, `structures`, and `nextStructureId` alongside crops and money. IDs survive moves and removals; counters never go backward or reuse removed IDs. Plots retain their array indices only until a removal. Narrative events must target stable IDs. Version 1 and 2 saves migrate, retaining coins, date, crop growth, and soil level.

## Iterate

Whole-game presets cover **Building · turn 1**, **Community · turn 25**, **Industry · turn 81**, **Legacy · turn 159**, **Policy · land and building loss**, and **Large estate · far corner**. They include affordable money and existing structures. Presets include farming history appropriate to their farms. Use the whole-game scope to check calendar behavior. The micro scope intentionally preserves the live date and policy.

Run `pnpm test:micro` for construction, repeated effects, losses, relocation, and policies; `pnpm test:integration` for migration and macro consequences; `pnpm test:browser` for placement, panning, repeated builds, upgrades, and persistence. Finish with `pnpm validate`.

Trees start as saplings and grow only when the calendar advances. Apples first bear after 12 seasons (three years); oaks bear acorns after 40 seasons (ten years). Mature trees produce each fall. Click a tree with visible product to harvest apples for 24 coins per level or acorns for 8 coins. Trees and unpicked product persist through winter. Older completed trees without ages load as mature, preserving any saved fruit readiness. Newly planted trees start at age zero.

## Animals

Chicken coops, dairy barns, and sheepfolds include visible animated animals and seasonal pens, including snow in winter. Tap a ready building and choose Collect to send the farmer for eggs, milk, or wool and receive coins. Each completed building produces one batch per season, including its completion season. Uncollected batches keep without stacking. Collection state survives saves and moving. Animal buildings have three levels, use the normal construction and upgrade rules, and never pay automatic seasonal income. Reduced motion keeps animals still.

Building sprites keep their native proportions and use larger physical lots. Old saves enlarge buildings once, preserving crops and paid work; a building moves to nearby clear ground if its old site is too small. A fully packed historical building can retain its compact lot until moved. New construction and movement always reserve the full catalog footprint.

## Tile actions

Tap open land to prepare a crop plot or commission a structure at that tile. Plans show costs, footprints, benefits, and next-season completion; blocked footprints and unaffordable plans are disabled. Tap a plot for planting, harvesting, movement, or farm-wide soil improvements. Tap buildings for upgrades and movement, and trees for harvest and care. End turn and recovery work live on the farmhouse or tent. The seed button and old service catalogs are removed.
