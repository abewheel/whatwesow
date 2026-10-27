# Macro → farm contract

Start with [ownership](game-boundaries.md) and [construction](construction.md). This contract lets macro authors impose consequences without changing micro rules or the renderer.

## Policy is macro state

`MacroState.farmPolicy` is optional and serializable. Missing fields impose no additional restriction; the estate's physical grid and authored progression still apply. Policies are validated at the macro import boundary.

| Field | Meaning |
| --- | --- |
| `land` | Union of granted rectangles, each `{row,col,width,height}`. Omitted means all 128 × 128 cells; `[]` means no land. |
| `blockedBuildings` | Building kind IDs forbidden for new construction and upgrades. Existing buildings remain until removed explicitly. |
| `buildingLimits` | Optional per-kind counts. Omitted kinds have no quota. Lowering a quota prevents new builds, and does not choose which existing buildings disappear. |
| `maxPlots` | Optional new-plot limit, 0–16,384. Removing existing plots requires an explicit loss or land revocation. |
| `costMultiplier` | Applied to seeds, new plots, buildings, soil improvements, and upgrades. Costs round up. Default 1; zero supports free construction. |
| `productionMultiplier` | Applied to harvest and seasonal income totals, rounded down. Default 1; zero supports seizure of output. |
| `unlockTurns` | Per-kind override for first build turn. Upgrade turns follow that override. Defaults remain in the authored catalog. |
| `allowWork` | Whether emergency delivery work is allowed. Defaults to true. |

A ban blocks construction and upgrades, while a quota blocks new builds after its count. Neither silently removes existing objects or their benefits. Use losses for confiscation. Land grants apply to every cell of a building footprint.

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

Call `applyMacroChange` for a land policy change, even when there are no explicit object removals. Merely overwriting `farmPolicy` does not reconcile the current estate. The development macro editor uses this adapter. Full-save imports restore their serialized objects and policy as supplied; they do not replay narrative consequences.

For a pure micro test, pass `{turn, policy}` as the third argument to `actOnFarm`. App integration obtains that input with `farmContext(gameState)`. Rules never import macro modules. For a standalone loss test, call `applyFarmConsequences(microState, effects, policy)`.

## Edge cases

Zero plots and zero structures are valid. A grant may revoke everything. Stable IDs and their counters survive so later grants cannot accidentally retarget old events. If land returns and work remains allowed, an empty farm can earn enough through deliveries to purchase a plot and seeds. A policy can intentionally prevent recovery by granting no land, forbidding work, or setting a zero plot limit.

Both growth and calendar transitions remain deterministic. Seasonal income is paid by the integration transition once per season; editing playtest dates does not pay it. The final transition is 159 → 160.

The adapter reports losses but does not author dialogue, choose targets, or decide when a policy changes. Those decisions belong to the macro loop.
