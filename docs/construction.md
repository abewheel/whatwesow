# Construction and progression

The estate is a 128 × 128 grid with 16,384 cells. Plots, buildings, and trees all occupy cells; multi-cell footprints cannot overlap or cross its edge. Every building type can be repeated. There are no one-per-type caps. Money, footprint space, authored unlocks, and any macro policy determine what the player can build.

Choose **Build** in the bottom dock, choose an item, then choose land. The catalog folds away while the placement tool stays active. The footprint preview marks permitted placements. Open **Estate controls** for navigation and **End turn**. **Farm tool / cancel build** returns to planting and harvesting. Click a structure to open **Upgrade**, where you can inspect, upgrade, or move it for free. **Move a plot** moves its growing crop too. Drag the field, scroll, use arrow keys, or use the pan buttons to explore; **Center farm** returns to the starting fields. Open **Explore land**, enter row and column 0–127, then use **Go to land** to jump across the estate. The canvas stays viewport-sized and renders nearby terrain.

The dock switches between **Plant**, **Build**, and **Upgrade**. Its chevron folds or opens the tray; Escape folds it and returns keyboard focus to the current activity. Selected seeds still work while folded. Switching activities cancels pending placement or movement. End turn stays available in the mode bar.

Use **Zoom out** and **Zoom in** for 25%–200% views, or **100%** to reset. With the farm focused, `+`, `−`, and `0` do the same. Zoom preserves the view center where map edges allow it, scales click targets and placement previews together, and resets on reload without changing the save.

## Authored track

Definitions live in `src/micro/world.ts`. Costs are prototype tuning values, with repeated builds charging the same base cost. Benefits add across buildings and their levels, then macro production policy applies.

| Build | First turn | Base cost | Footprint | Effect per level |
| --- | --- | --- | --- | --- |
| Farmhouse | 1 | 120, first home provided | 3 × 2 | Home and decoration |
| Tool shed | 1 | 60 | 2 × 2 | Seeds cost 1 less, minimum 1 before policy |
| Oak tree | 1 | 15 | 1 × 1 | Acorns each fall after ten years |
| Apple tree | 5 | 60 | 1 × 1 | 24 coins per level per fall harvest after three years |
| Irrigation well | 9 | 180 | 2 × 2 | 1 extra grow step and 1 extra harvest coin |
| Harvest barn | 25 | 600 | 3 × 2 | 2 extra harvest coins |
| Grain mill | 49 | 1,800 | 3 × 3 | 15 extra coins per corn harvest |
| Greenhouse | 81 | 4,500 | 3 × 2 | 8 extra harvest coins |
| Farm market | 121 | 12,000 | 3 × 3 | 150 coins on each season transition |
| Legacy hall | 145 | 25,000 | 3 × 3 | 30 extra harvest coins |

Production buildings and apple trees have three levels. Level 2 normally unlocks eight turns after their build unlock, and level 3 sixteen turns after it. Legacy hall's final upgrade unlocks on turn 159. An upgrade costs base cost × the new level. Homes and oaks have one level. Soil improvements unlock on turns 1, 33, and 97.

Upgrades and soil improvements cost coins when started and finish at the start of the next turn. Their benefits stay at the current level until then. Each building and the soil can have one upgrade underway; different buildings can upgrade together. Pending work survives saving, reloading, and moving a building. Losing a building also loses its pending upgrade, without a refund. New construction also charges immediately and finishes next season. Its footprint stays reserved while work is underway, but its benefits remain inactive. Buildings use unfinished timber-and-stone artwork, with a work symbol and grey name while construction or an upgrade is pending. Trees start as saplings and grow over multiple years, with visible sapling, growing, and mature stages. The starting farmhouse and structures in older saves are already complete.

**End turn** advances one season, grows crops using the previous turn's irrigation, completes construction and upgrades, then pays seasonal market income at the completed levels. Mature trees produce in fall; click a ripe tree in Plant mode to harvest it. The tree stays planted and produces again the following fall. Unpicked fruit keeps without stacking, and fruit earns no automatic income. Choose Upgrade before clicking a tree to inspect or move it. Seed discounts and harvest bonuses apply to actions in the new turn. Turn 160 is year 40, winter; the calendar stops there, so new construction and upgrades cannot start in that final season. There is no end-of-life narrative in this slice.

This is an authored default progression, not a claim that the full 40-year economy is balanced. Tune unlocks, costs, and effects here as the macro experience develops; farming rules consume its turn and policy instead of storing a second clock.

## System boundaries

- `src/contracts/farm-policy.ts`: shared serializable policy contract and validation. Macro owns policy decisions.
- `src/micro/world.ts`: definitions, footprints, geometric placement, derived effects.
- `src/micro/rules.ts`: pure build, upgrade, move, plant, grow, and harvest actions.
- `src/micro/consequences.ts`: pure loss reconciliation and stable entity removal.
- `src/game/state.ts`: save migration, context projection, atomic macro/farm changes.
- `src/game/scene.ts`: drawing only. Changing art does not change placement, ownership, or economic rules.

Micro state owns placed objects, crops, soil, and money. Macro owns time and optional `farmPolicy`. Both domains import shared contracts, never each other's implementation. Use [the macro integration contract](macro-farm-contract.md) when adding narrative restrictions or losses.

Version 3 saves carry `plotCells`, `plotIds`, `nextPlotId`, `structures`, and `nextStructureId` alongside crops and money. IDs survive moves and removals; counters never go backward or reuse removed IDs. Plots retain their array indices only until a removal. Narrative events must target stable IDs. Version 1 and 2 saves migrate, retaining coins, date, crop growth, and soil level.

## Iterate

Whole-game presets cover **Building · turn 1**, **Community · turn 25**, **Industry · turn 81**, **Legacy · turn 159**, **Policy · land and building loss**, and **Large estate · far corner**. They include affordable money and existing structures. Use the whole-game scope when checking unlock dates. The micro scope intentionally preserves the live date and policy.

Run `pnpm test:micro` for construction, repeated effects, losses, relocation, and policies; `pnpm test:integration` for migration and macro consequences; `pnpm test:browser` for placement, panning, repeated builds, upgrades, and persistence. Finish with `pnpm validate`.

Trees start as saplings and grow only when the calendar advances. Apples first bear after 12 seasons (three years); oaks bear acorns after 40 seasons (ten years). Mature trees produce each fall. In Plant mode, click a tree with visible product to harvest apples for 24 coins per level or acorns for 8 coins. Trees and unpicked product persist through winter. Older completed trees without ages load as mature, preserving any saved fruit readiness. Newly planted trees start at age zero.
