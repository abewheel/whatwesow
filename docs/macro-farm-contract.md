# Macro → farm contract

Start with [ownership](game-boundaries.md) and [construction](construction.md). This contract lets macro authors impose consequences without changing micro rules or the renderer.

## Policy is macro state

`MacroState.farmPolicy` is optional and serializable. Missing fields impose no additional restriction; the estate's physical grid and authored progression still apply. Policies are validated at the macro import boundary.

| Field | Meaning |
| --- | --- |
| `land` | Union of granted rectangles, each `{row,col,width,height}`. Omitted means all 64 × 64 cells; `[]` means no land. |
| `blockedBuildings` | Building kind IDs forbidden for new construction and upgrades. Existing buildings remain until removed explicitly. |
| `buildingLimits` | Optional per-kind counts. Omitted kinds have no quota. Lowering a quota prevents new builds, and does not choose which existing buildings disappear. |
| `maxPlots` | Optional new-plot limit, 0–4,096. Removing existing plots requires an explicit loss or land revocation. |
| `costMultiplier` | Applied to seeds, new plots, buildings, soil improvements, and upgrades. Costs round up. Default 1; zero supports free construction. |
| `productionMultiplier` | Applied to harvest and seasonal income totals, rounded down. Default 1; zero supports seizure of output. |
| `allowWork` | Whether emergency delivery work is allowed. Defaults to true. |

A ban blocks construction and upgrades, while a quota blocks new builds after its count. Neither silently removes existing objects or their benefits. Use losses for confiscation. Land grants apply to every cell of a building footprint.

### Council fields

Council crises compile into these fields; macro authors can also set them directly. All are optional and validated, and a missing field imposes nothing. [Crises](crises.md#what-each-policy-does-to-the-farm) says which policy sets each one.

| Field | Meaning |
| --- | --- |
| `cropPrices` | Sale multiplier per crop or fruit tree kind (`apple`, `oak`), 0–10. |
| `fixedPrices` | Sale value per crop, replacing its harvest value. Multipliers above 1 no longer apply. |
| `priceCeiling` | Cap on the combined sale multiplier, 0–10. |
| `harvestTax` | Share of each crop and fruit sale paid to the relief fund, 0–1. |
| `yieldMultiplier` | Applied to every crop harvest, 0–10. |
| `averageCap` | A crop's base value is capped at its base sale, so soil and building bonuses stop raising its price; price multipliers and yield still apply. |
| `quota` | Sales allowed this season. Sales over it earn nothing and do not count as harvests. |
| `sellDelay` | Per crop, `{crop: above}`: that crop's sales are held until the next season while more than `above` plots of it are planted. Each `above` is a whole number, 0–4,096. |
| `forwardContract` | `{mult, seasons}`: the player may lock that share of the price for that many seasons. |
| `seedMultiplier` | Seed price multiplier, 0–10; 0 makes seed free. |
| `plantingFee` | Coins per planting, 0–1,000. |
| `premiumSeed` | `{seed, yield, failOneIn}`: premium seed's price and yield multipliers, and how often a planting fails. |
| `recoveringCrops` | Crops that cannot be planted at all. |
| `agreedCropLimits` | Plot limit per crop from an accepted deal. Reaching it blocks planting. |
| `bannedCrops`, `cropLimits`, `assignedCrops`, `rotation`, `fallowShare`, `permitsRequired` | Finable planting rules: a banned crop, a plot limit per crop, the only crops allowed, no crop twice in a row on a plot (an allowed crop from `assignedCrops` is exempt), the share of plots (0–1) that must stay empty, and a permit per planting season. A crisis names one crop in `assignedCrops` and skips crops the merged crisis rules ban, block or limit. |
| `plantingFine` | Fine for breaking finable rules, as a multiple of the crop's base sale, 0–10. Without it, finable rules block planting instead. |
| `sealedBuildings` | Kinds that stay but give no growth, harvest bonus, seed discount or income. |
| `buildDelay` | Extra seasons, 0–4, for new buildings and building upgrades. |
| `frozenUpgrades` | Building upgrades are refused; construction still works. |
| `unlockedBuildings` | Kinds that can be built without their milestone. |
| `takenCells` | `{row,col}` cells that are no longer part of the farm. |
| `waterTrade` | `{buy, sell}`: coins per thirsty growing crop to buy or sell water in a drought. Bought water reaches only the crops growing when it is bought. |
| `droughtWells` | A finished, unsealed well protects thirsty crops in a drought, unless the water rights were sold that season. |

`sealedBuildings` is the one field that removes benefits without removing objects. `takenCells` works like revoked land: `cellAllowed` rejects those cells for plots, buildings and moves.

## Apply a decision atomically

```ts
import { applyMacroChange } from "../game/state";

const outcome = applyMacroChange(currentGame, {
  ...currentMacro,
  farmPolicy: {
    ...currentMacro.farmPolicy,
    land: [{ row: 14, col: 14, width: 8, height: 8 }],
    blockedBuildings: ["mill"],
    buildingLimits: { barn: 2 },
    productionMultiplier: 0.75,
  },
}, {
  removeStructureIds: [chosenBuildingId],
  removePlotIds: [chosenPlotId],
  coinDelta: -20,
});
// Persist outcome.state once, then render.
// outcome.losses lists exactly which structure IDs and plot IDs were removed.
```

The adapter validates the new macro state, removes explicitly targeted objects, removes plots and whole buildings outside the new land grants, applies the coin delta, and validates the complete result. It returns fresh state. Failures leave the original game untouched, including an unaffordable negative coin delta.

Do not delete array entries directly, reset ID counters, or modify Phaser objects to apply consequences. A removed building's benefits disappear because income, growth, prices, and harvest values derive from surviving structures. Removing a plot also removes its crop. Confiscation grants no refund.

Call `applyMacroChange` for a land policy change, even when there are no explicit object removals. Merely overwriting `farmPolicy` does not reconcile the current estate. The development macro editor uses this adapter. It takes `crises` from the new macro state, so a macro edit that leaves `crises` out clears them. Full-save imports restore their serialized objects and policy as supplied; they do not replay narrative consequences.

For a pure micro test, pass `{turn, policy, drought}` as the third argument to `actOnFarm`. App integration obtains that input with `farmContext(gameState)`, which returns `{turn, policy, drought, water}`: `farmPolicy` merged with the crisis rules for the current turn, whether this season is a drought, and this season's water. `water` lists the plot IDs watered with bought water (`bought`), whether the water rights were `sold`, whether water at cost (`atCost`) or a working well (`well`) is in place (neither protects once the rights are `sold`), any `irrigationCap`, the `thirsty` crops still growing, and how many of them End turn will dry (`drying`) or wither (`withering`); both are 0 in fall and at turn 160. App farm actions go through `actOnGame(gameState, action)`, which refuses every action with "The council is waiting for your answer." while a crisis or its deal is unanswered. Rules never import macro modules. For a standalone loss test, call `applyFarmConsequences(microState, effects, policy)`. `clearPlotIds` destroys crops and keeps their plots.

## Crisis records

`MacroState.crises` records each council crisis in [run order](crises.md#when-each-crisis-fires), at most 8. Integration writes them through `endTurn`, `answerCrisis` and `answerOffer` in `src/game/crisis.ts`; outside playtesting, never write them directly.

| Field | Meaning |
| --- | --- |
| `id` | Crisis id, matching `content.params.runOrder` at its index. |
| `turn` | Turn it fired, 1–160, strictly increasing across records. |
| `pick` | The card the player chose, plus `:accept` or `:decline` once a deal is answered. Absent while the council waits. |
| `crop` | The Blight crop or Overproduction's top crop, chosen when it fired. |
| `prices` | Sale values frozen when a fixed-price policy passed. |
| `cells` | Cells of plots the county took or bought. |
| `limits` | Building counts frozen when a building cap passed. |
| `loan` | Coins lent by a loan policy. |

Macro validates shapes and bounds: names up to 40 characters, whole numbers, and cells inside the 64 × 64 grid. Integration's `parseState` also requires the run order and farm crops, rejects a record later than the save's current turn or one that follows an unanswered crisis or deal, and replays the picks with the crisis engine to reject any pick that is not one of that crisis's cards.

Crisis consequences are derived, never written into `farmPolicy`. `crisisPolicy(state, turn)` replays the answers and compiles each record's trigger and policy effects that are active at that turn. A standing effect binds once its policy took effect, so a refused deal adds nothing, and a policy that passes again binds once; Overproduction's bind once per crop. Integration then merges it with `farmPolicy` through `mergePolicy`:

| Fields | Merge |
| --- | --- |
| `costMultiplier`, `productionMultiplier`, `seedMultiplier`, `yieldMultiplier`, `cropPrices` per crop | Multiply |
| `maxPlots`, `quota`, `priceCeiling`, and per-key `buildingLimits`, `cropLimits`, `agreedCropLimits`, `sellDelay` | Lowest |
| `plantingFine`, `fallowShare`, `buildDelay` | Highest |
| `plantingFee` | Added, up to 1,000 |
| `harvestTax` | Compounded |
| Lists and `takenCells` | Union |
| `averageCap`, `permitsRequired`, `rotation`, `frozenUpgrades`, `droughtWells` | Either |
| `allowWork` | Both |
| `fixedPrices` | Per crop, the macro policy's first, then the earliest record's |
| `land`, `waterTrade`, `premiumSeed`, `forwardContract` | The macro policy's when set |

The scene and every UI forecast use this merged policy.

## Edge cases

Zero plots and zero structures are valid. A grant may revoke everything. Stable IDs and their counters survive so later grants cannot accidentally retarget old events. If land returns and work remains allowed, an empty farm can earn enough through deliveries to purchase a plot and seeds. A policy can intentionally prevent recovery by granting no land, forbidding work, or setting a zero plot limit.

Both growth and calendar transitions remain deterministic. Seasonal income is paid by the integration transition once per season; editing playtest dates does not pay it. The final transition is 159 → 160. Choices that should look random, such as random land or failed premium seed, use the `mix` hash in `src/contracts/world.ts`.

Coins never go negative. Seasonal charges the coins cannot cover become the micro field `owed`, which income pays first; see [owed coins](crises.md#owed-coins). A negative `coinDelta` passed to `applyMacroChange` must still be affordable.

The adapter reports losses but does not author dialogue, choose targets, or decide when a policy changes. Those decisions belong to the macro loop. Crises choose their own targets in integration.
