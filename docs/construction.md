# Construction and progression

The estate is a 64 × 64 grid with 4,096 cells. Plots, buildings, and trees all occupy cells; multi-cell footprints cannot overlap or cross its edge. Every building type can be repeated, with no one-per-type caps of its own. Money, footprint space, authored unlocks, any macro policy, and the [council's rules](#council-rules-for-buildings) determine what the player can build.

New farms start with a tent, no fields or buildings, and 240 coins. Click the tent for house plans, fields, seeds, and End turn. A house costs 120 coins and takes one season to complete. The tent stays until then, and its services move into the finished farmhouse. Other construction unlocks through farming.

If structures block a walking path, open the farm menu and choose **Clear blocked access**. Select any building or tree and move it for free, then return to normal visits.

Click a building and the farmer walks to its entrance before its menu opens. The farmhouse ends the season, shows income and lists the council's rules; the seed shop and nursery supplies crop seeds and trees; the field shed handles plots, soil, plot movement and tree care; the builder handles structures, upgrades and movement. A farmhouse office appears if a saved farm has no home, and a [council office](#council-office) while planting permits are required. Dense imported farms use roadside service entrances without moving saved objects.

Choose a plan, then choose land. The menu closes while the placement tool stays active, and the footprint preview marks permitted placements. **Cancel placement** or Escape returns to farming. Click a structure to walk over and inspect it. Click a ripe tree to harvest on arrival; use the field shed's tree selector for care or movement. **Move a plot** moves its growing crop too. Drag, scroll or use arrow keys to explore; folded **View controls** holds zoom, pan, **Center farm**, and coordinate navigation (0–63). The canvas stays viewport-sized and renders nearby terrain.

Use **Zoom out** and **Zoom in** for 25%–200% views, or **100%** to reset. With the farm focused, `+`, `−`, and `0` do the same. Zoom preserves the view center where map edges allow it, scales click targets and placement previews together, and resets on reload without changing the save.

## Farming opportunities

Definitions live in `src/micro/world.ts`. The first facility costs its base price. Each additional facility of that kind costs base price × (1 + existing levels), including paid work underway. Trees keep their base price so orchards can grow. Upgrades keep their base price × new level and save land compared with another building. Benefits add across buildings and their levels, then macro production policy applies.

| Build | Milestone | Base cost | Footprint | Effect per level |
| --- | --- | --- | --- | --- |
| Farmhouse | Available at start | 120 | 3 × 2 | Home, calendar, and farm services |
| Seed storehouse | 3 harvests | 60 | 2 × 2 | Seeds cost 1 less, minimum 1 before policy |
| Oak tree | Available at start | 15 | 1 × 1 | Acorns each fall after ten years |
| Apple tree | 6 harvests | 60 | 1 × 1 | 24 coins per level per fall harvest after three years |
| Irrigation well | 12 harvests and 10 plots | 180 | 2 × 2 | 1 extra grow step and 1 extra harvest coin |
| Harvest barn | 24 harvests | 600 | 3 × 2 | 2 extra harvest coins |
| Grain mill | 12 corn harvests | 1,800 | 3 × 3 | 15 extra coins per corn harvest |
| Greenhouse | 80 harvests and soil level 1 | 2,400 | 3 × 2 | 10 extra harvest coins |
| Farm market | 160 harvests, including all three crops | 3,000 | 3 × 3 | 150 coins on each season transition |
| Legacy hall | 300 harvests and a farm market | 10,000 | 3 × 3 | 50 extra harvest coins |

Turnips and carrots are available at the start. Harvest one of each to receive Eli's corn seed offer. Opportunities arrive as short character notes in the farming status and **Build → Farm news**. Locked items explain their milestones in the existing controls. Offers remain available once earned, even after land or building losses. There is no research currency or separate progression screen.

Production buildings and apple trees have three levels. Each individual building earns level 2 after 12 harvests made since construction completes, and level 3 after 24 more harvests since its last upgrade completes. Mills count only corn harvests. An upgrade costs base cost × the new level. Homes and oaks have one level. Soil improvements need 3, 30, and 90 total harvests, in order, and cost 80, 160, and 240 coins.

Upgrades and soil improvements cost coins when started and finish at the start of the next turn. Their benefits stay at the current level until then. Each building and the soil can have one upgrade underway; different buildings can upgrade together. Pending work survives saving, reloading, and moving a building. Losing a building also loses its pending upgrade, without a refund. New construction also charges immediately and finishes next season. Its footprint stays reserved while work is underway, but its benefits remain inactive. Buildings use unfinished timber-and-stone artwork, with a work symbol and grey name while construction or an upgrade is pending. Trees start as saplings and grow over multiple years, with visible sapling, growing, and mature stages. The starting farmhouse and structures in older saves are already complete.

**End turn** advances one season, grows crops using the previous turn's irrigation, completes construction and upgrades, then pays seasonal market income at the completed levels. Under council rules it also waters thirsty crops and charges the council's bills; see [crises](crises.md#end-turn-step-by-step). Mature trees produce in fall; click a ripe tree  to harvest it. The tree stays planted and produces again the following fall. Unpicked fruit keeps without stacking, and fruit earns no automatic income. Use the field shed to inspect or move a tree. Seed discounts and harvest bonuses apply to actions in the new turn. Turn 160 is year 40, winter; the calendar stops there, so new construction and upgrades cannot start in that final season. There is no end-of-life narrative in this slice.

Tune milestones in `src/micro/progression.ts`. Calendar advancement never earns farming opportunities. A first market repays its price in 20 season transitions; its upgrades take 40 and 60 transitions. Market plans and inspections show payback against the remaining lifetime, including policy-adjusted prices and income. Late purchases may not repay their cost before the final winter.

## Council rules for buildings

[Council crises](crises.md) can change what you may build. Each rule comes from a policy that passed and applies from then on. While the council waits for an answer, building, moving plots or buildings, upgrades and soil improvements are refused along with every other farm action.

| Rule | Policy | Effect |
| --- | --- | --- |
| Build delay | Eminent domain −40 | New buildings and building upgrades take one extra season and show "ready in 2 seasons". The structure saves the remaining delay as `wait`. Saplings and soil improvements are not delayed. |
| Building cap | Eminent domain −80 | Each building kind is capped at its count when the policy passed, including work underway. Kinds the farm lacks cannot be built. Trees are not capped, and upgrades still work. |
| Frozen upgrades | Overproduction −80 | Building upgrades are refused: "Upgrades are frozen by the council." New construction and soil improvements still work. |
| Unlocked wells | Drought +40 | An irrigation well can be built without its 12 harvests and 10 plots. A finished well also protects thirsty crops in a drought, unless the water rights were sold that season. A later sealed-wells policy takes this back. |
| Sealed wells | Drought 0, −40, −80 | Wells stay but give no extra growth or harvest coin. New wells and well upgrades are blocked. |
| Taken land | Eminent domain 0, −40, −80, or a +40 deal | The cells of taken plots leave the farm: nothing can be built, planted or moved there. |

Any kind listed in `sealedBuildings` stays standing and still counts as built, but gives no growth, harvest bonus, seed discount or income. Sealed buildings are drawn faded and grey under crossed planks, and their labels and menus say "sealed by the council". In the default council, every rule above can pass; sealed wells come from the second drought, in year 18. See [reachable policies](crises.md#reachable-policies).

### Council office

The council office is a village service, shown only while planting permits are required (Blight −40, or Eminent domain −40 or −80). It takes a 2 × 2 lot west of the seed shop, at row 7, column 9, or the first free lot if that one is used. While it stands, its lot cannot be built on and the farmer walks around it. Its menu shows this season's and next season's permit status and **File next season's permit · free**. Planting without a permit for the season breaks the council's rules and costs a fine. The office is drawn as a procedural placeholder with a slate roof, a flag, a notice board and a name label. It is defined as `councilOffice` in `src/micro/world.ts`; `serviceLocations(layout, { council: true })` places it.

The Eminent domain policies that bring the office also have the county name the one crop you may plant each season and give out its seed free; planting another crop costs a fine. See [crises](crises.md#eminent-domain).

## System boundaries

- `src/contracts/farm-policy.ts`: shared serializable policy contract and validation. Macro owns policy decisions.
- `src/micro/world.ts`: definitions, footprints, geometric placement, derived effects.
- `src/micro/rules.ts`: pure build, upgrade, move, plant, grow, and harvest actions.
- `src/micro/consequences.ts`: pure loss reconciliation and stable entity removal.
- `src/game/state.ts`: save migration, context projection, atomic macro/farm changes, and farm actions refused while the council waits (`actOnGame`).
- `src/game/crisis.ts`, `src/game/crisis-rules.ts`: when crises fire, and the farm rules their answers impose.
- `src/game/scene.ts`: drawing only. Changing art does not change placement, ownership, or economic rules.

Micro state owns placed objects, crops, soil, and money. Macro owns time, optional `farmPolicy`, and crisis records. Both domains import shared contracts, never each other's implementation. Use [the macro integration contract](macro-farm-contract.md) when adding narrative restrictions or losses.

Harvest counts, earned opportunities, and each building’s harvest baseline persist in version 3 saves. Older saves default to zero recorded harvests, retain corn seed access and offers for owned structures, and preserve their existing upgrades and soil. Obsolete `unlockTurns` policy fields are ignored on import.

Version 3 saves carry `plotCells`, `plotIds`, `nextPlotId`, `structures`, and `nextStructureId` alongside crops and money. IDs survive moves and removals; counters never go backward or reuse removed IDs. Plots retain their array indices only until a removal. Narrative events must target stable IDs. Version 1 and 2 saves migrate, retaining coins, date, crop growth, and soil level.

## Iterate

Whole-game presets cover **Building · turn 1**, **Community · turn 25**, **Industry · turn 81**, **Legacy · turn 159**, **Policy · land and building loss**, **Large estate · far corner**, and [one per council crisis](crises.md#test-crises). They include affordable money and existing structures. Presets include farming history appropriate to their farms. Use the whole-game scope to check calendar behavior. The micro scope intentionally preserves the live date and policy.

Run `pnpm test:micro` for construction, repeated effects, losses, relocation, and policies; `pnpm test:integration` for migration and macro consequences; `pnpm test:browser` for placement, panning, repeated builds, upgrades, and persistence. Finish with `pnpm validate`.

Trees start as saplings and grow only when the calendar advances. Apples first bear after 12 seasons (three years); oaks bear acorns after 40 seasons (ten years). Mature trees produce each fall. Click a tree with visible product to harvest apples for 24 coins per level or acorns for 8 coins. Trees and unpicked product persist through winter. Older completed trees without ages load as mature, preserving any saved fruit readiness. Newly planted trees start at age zero.
