# Farm asset inventory and state checklist

This is the building and plant art production checklist. It inventories the current code and the [concept art](images/art-direction.png), then proposes the missing assets needed to carry that direction into a buildable farm. Proposed entries and upgrade appearances are design decisions for art planning, not implemented buildings, unlocks, or economic rules.

Sources: [construction catalog](../src/micro/world.ts), [crop definitions](../src/micro/state.ts), [current artwork](art-assets.md), [farming rules](micro-game.md), and [design system](design-system.md). Repeated tree instances count as one asset type. Neighbors can reuse building types; they do not require a new sprite for every resident.

## State contract

Every building and plant needs all four seasons: **spring, summer, fall, winter**, and all three conditions: **maintained, decaying, dilapidated**. These axes combine, rather than replace one another. For buildings, also combine every relevant upgrade tier. For plants, combine every growth stage. Trees have maturity stages rather than building upgrades. Crop quality and soil level do not create extra crop upgrade tiers.

| Axis | Required values | Visual meaning |
| --- | --- | --- |
| Season | Spring, summer, fall, winter | Blossoms and fresh growth; full foliage; autumn leaves; dormant branches, snow, and frost |
| Building upgrade | Base, improved, advanced, as proposed below | A distinct silhouette or useful structural addition at each tier |
| Condition | Maintained | Intact structures and healthy plants |
| Condition | Decaying | Worn boards, missing shingles, rust, cracked plaster; sparse or drooping leaves and damaged produce |
| Condition | Dilapidated | Broken rails, boarded windows, sagging roofs; heavily withered plants, dead branches, or collapsed supports |
| Tree maturity | Sapling, young, mature | Three readable sizes; winter dormancy remains distinct from damage |
| Crop growth | Every integer growth value, including planted and ripe | Match the actual rule range for existing crops; proposed ranges are listed below |

An advanced building can be dilapidated; a base building can be maintained. Snow must not hide the difference between conditions. Damage must not change the grid footprint, pivot, or camera angle. A dilapidated structure keeps its recognizable identity. A dormant winter tree is maintained unless it also has visible damage.

Healthy crop stages must remain readable through the spring, summer, and fall growing year. Planting windows are crop-specific, and winter frost clears all field crops, including ripe crops. Trees survive winter. This checklist does not add repair costs or yield penalties.

## Buildings: 10 types

Eight building types are implemented in the construction catalog; the coop and silo are proposed from the concept art. Tier counts and footprints below follow current rules for implemented types. The farmhouse has no upgrade. Several later buildings still reuse placeholder artwork from another type.

| ID | Building | Status | Footprint | Tiers | Intended role |
| --- | --- | --- | --- | --- | --- |
| `home` | Farmhouse | Implemented, frame 0 | 3 × 2 | 1 | Home |
| `shed` | Seed storehouse | Implemented, frame 4 | 2 × 2 | 3 | Cheaper seeds |
| `well` | Irrigation well | Implemented, frame 3 | 2 × 2 | 3 | Growth and harvest support |
| `barn` | Harvest barn | Implemented, frame 1 | 3 × 2 | 3 | Harvest value |
| `mill` | Grain mill | Implemented, currently reuses barn frame | 3 × 3 | 3 | Corn processing; windmill artwork from the reference |
| `greenhouse` | Greenhouse | Implemented, currently reuses farmhouse frame | 3 × 2 | 3 | Harvest value |
| `market` | Farm market | Implemented, currently reuses shed frame | 3 × 3 | 3 | Seasonal trade income |
| `hall` | Legacy hall | Implemented, currently reuses farmhouse frame | 3 × 3 | 3 | Late-life harvest value |
| `chicken-coop` | Chicken coop | Proposed from reference | 2 × 2 proposed | 3 proposed | Chickens and eggs |
| `silo` | Silo | Proposed from reference | 2 × 2 proposed | 3 proposed | Grain and feed storage |

For upgradeable buildings, plan base, improved, and advanced silhouettes within the same footprint. Keep porches and equipment inside the placement footprint. Exact unlocks, prices, and benefits for implemented types live in the construction catalog; proposed entries have no rules yet.

## Trees: 5 types

Every type needs sapling, young, and mature stages, each in all seasons and conditions. Apple trees also have three implemented upgrade levels, so their maturity art needs coverage at each level; other tree types have one level. Tree maturity remains an art-planning requirement rather than an implemented growth mechanic. Only the mature artwork needs fruit-ready details. Fruit availability is a separate future gameplay state: reserve both unladen and fruit-ready mature variants for apple and citrus trees. Do not permanently paint fruit into the only mature sprite.

| ID | Tree | Status and source | Grid footprint | Seasonal and identity notes |
| --- | --- | --- | --- | --- |
| `apple` | Apple tree | Implemented, atlas frame 2, three upgrade levels | 1 × 1 | Spring blossom, summer leaves, autumn fruit/leaves, bare snowy winter branches |
| `flowering-tree` | Flowering tree | Existing atlas frame 5; currently reused for oak | 2 × 2 proposed | Pink spring blossom, green summer leaves, autumn foliage, bare winter branches. Fruit production is not established |
| `citrus-tree` | Citrus tree | Reference: yellow-orange fruit tree; exact species not established | 2 × 2 proposed | Keep citrus leaves through winter; use snow/frost treatment rather than copying a bare deciduous tree |
| `oak` | Oak tree | Implemented, currently reuses flowering-tree art | 1 × 1 | Leafy spring/summer, amber autumn, dormant winter; distinct silhouette from orchard trees |
| `evergreen-tree` | Evergreen tree | Reference: small conifer silhouettes around paths | 2 × 2 proposed | Evergreen needles, seasonal light and snow; no bare winter canopy |

## Crops: 12 types

Existing crops have exact authored growth ranges. Preserve those counts; do not add grow steps merely to fit an art sheet. Radishes, tomatoes, and pumpkins use two authored stages: seedling and ripe. Remaining proposed crops provisionally use four art stages: planted, sprout, growing, ripe. Their timing and economics are not yet defined. Grapes include a trellis inside the crop tile; the trellis also needs decaying and dilapidated appearances.

| ID | Crop | Status and source | Growth values requiring art | Footprint |
| --- | --- | --- | --- | --- |
| `turnip` | Turnip | Playable crop in code | 0 planted, 1 ripe | 1 × 1 |
| `carrot` | Carrot | Playable crop; reference | 0 planted, 1 growing, 2 ripe | 1 × 1 |
| `corn` | Corn | Playable crop in code | 0 planted, 1 growing, 2 ripe | 1 × 1 |
| `radish` | Radish | Playable; authored growth sprites and produce icon | 0 seedling, 1 ripe | 1 × 1 |
| `pumpkin` | Pumpkin | Playable; authored growth sprites and produce icon | 0 seedling, 1 ripe | 1 × 1 |
| `cabbage` | Cabbage | Reference: green cabbage bed | 0–3 proposed | 1 × 1 |
| `strawberry` | Strawberry | Reference: strawberry bed | 0–3 proposed | 1 × 1 |
| `sunflower` | Sunflower | Reference: sunflower bed | 0–3 proposed | 1 × 1 |
| `wheat` | Wheat | Reference: golden grain bed | 0–3 proposed | 1 × 1 |
| `tomato` | Tomato | Playable; authored growth sprites and produce icon | 0 seedling, 1 ripe | 1 × 1 |
| `blueberry` | Blueberry bush | Reference: blue berry bed | 0–3 proposed | 1 × 1 |
| `grape` | Grape vine | Reference: purple fruit on trellises | 0–3 proposed | 1 × 1 |

Blueberry bushes and grape vines are plant assets in crop beds, not tree assets. Regrowth, repeated harvests, and perennial persistence are not implemented. Keep the planted stage distinct from an empty tilled tile; harvest currently returns a plot to empty soil, so a separate harvested-crop sprite is unnecessary.

## Other plants: 3 types

| ID | Plant asset | Status and source | Footprint | Required stages and upgrades |
| --- | --- | --- | --- | --- |
| `flower-garden` | Mixed flower garden | Current procedural garden; reference flower beds | 2 × 3 current | One established arrangement; no upgrade tier |
| `hedge` | Hedge or low shrub | Reference: low green boundaries; proposed decoration | 1 × 1 proposed, repeatable | One established plant; no upgrade tier |
| `potted-flowers` | Potted flowers | Reference: flower pots and planters | 1 × 1 proposed | One established arrangement; no upgrade tier |

All three still require four seasons and three conditions. Flowers attached to a building belong to that building's state, rather than requiring a second independently placed object. Replace the generic garden's winter flowers with dormant stems or snow. Seasonal palettes should distinguish garden plants from harvestable crops.

## Coverage and production counts

The inventory contains **30 asset types: 10 buildings, 5 trees, 12 crops, and 3 other plants**. For the proposed tiers and stages above:

| Group | State calculation | Required visual combinations |
| --- | --- | --- |
| Buildings | (1 farmhouse tier + 7 implemented buildings × 3 tiers + 2 proposed buildings × 3 tiers) × 4 seasons × 3 conditions | 336 |
| Tree maturity | (3 apple tiers + 4 other tree types) × 3 maturity stages × 4 seasons × 3 conditions | 252 |
| Orchard fruit overlays | (3 apple tiers + 1 citrus tier) × 4 seasons × 3 conditions, mature only | 48 |
| Crops | (2 turnip + 3 carrot + 3 corn + 3 seasonal crops × 2 stages + 6 proposed crops × 4 stages) × 4 seasons × 3 conditions | 456 |
| Other plants | 3 types × 4 seasons × 3 conditions | 36 |
| Total | Base combinations plus fruit-ready overlays | 1,128 |

These are coverage requirements, not a demand for 1,128 separate PNG files. Modular seasonal, damage, and fruit overlays may cover multiple combinations when the final composite is visually correct. Every valid combination still needs a reviewable preview. For orchard fruit, the unladen mature sprite is in the tree-maturity count; a fruit-ready overlay is additional. Its snow/frost treatment must match the season. Fruit currently regrows every season, including winter; the state atlas does not yet provide a complete seasonal family.

The proposed upgrade count and new plant stages are production assumptions. If a design changes, revise the table and counts before generating art. Existing soil levels 0–3 affect harvest value but do not upgrade the crop silhouette. Soil, fences, paths, gates, and irrigation need their own supporting terrain/prop checklist; animals, characters, and product icons also remain separate from this building-and-plant inventory. The animated farmer and current HUD artwork are documented in [art assets](art-assets.md#farmer-and-hud).

## Existing coverage and gaps

- The three existing atlases contain six maintained, base/adult sprite cells each: farmhouse, barn, apple tree, well, garden shed, flowering tree. This is 18 authored cells. Spring artwork is reused with a tint for summer; there is no dedicated summer atlas.
- The orchard tree now has ripe and picked visuals, and a sapling visual while growing. The state atlas also supplies four construction silhouettes used by the current building families. These variants are not yet a complete seasonal or upgrade art family.
- All six playable crops have authored growth sprites. Radish, tomato, and pumpkin have distinct seedlings, ripe plants, and produce icons in the seasonal crop sheet. Additional seasonal and disrepair appearances remain future art work.
- The old grid preview includes a procedural flower garden; it is not yet a placeable construction item. It needs distinct seasonal and condition artwork.
- Building ownership and upgrade levels are now persisted. The atlas still lacks distinct upgrade art, tree maturity, decaying, and dilapidated families. Condition mechanics are not implemented.
- Reference-only buildings and plants, plus the implemented mill, greenhouse, market, legacy hall, and oak, need their own first distinct artwork as well as their state families.

## Asset handoff and review

Use stable keys with separate dimensions, for example:

`building/barn/improved/winter/decaying`

`plant/carrot/growth-1/summer/maintained`

`tree/apple-tree/mature/fall/dilapidated` plus an optional fruit-ready overlay. Apple keys also include their upgrade tier.

Keep a fixed 2:1 camera, lighting direction, logical pixel scale, footprint, pivot, and transparent canvas bounds across every variant of a type. Camera changes, resized foundations, or shifted pivots make upgrades and repairs appear to move a placed building. Construction previews and finished objects must use the same footprint. Seasonal overlays must not create a backdrop rectangle or cover neighboring cells.

A state family is complete only when every listed combination resolves to an asset or an explicit layer recipe, every composite has been inspected on the farm grid, and maintained/decaying/dilapidated silhouettes remain distinguishable at game scale. Check spring-to-summer differences, all upgrades under snow, and damaged plants during normal winter dormancy. Never silently substitute a maintained sprite for a missing damage state.

Produce distinct artwork for the implemented eight buildings, two construction tree types, and six playable crops first. Add the reference-only production buildings next, then the remaining crops and environment plants. Keep the farming slice playable while the art library grows. Future mechanics should consume the state dimensions through the owning domain; this document does not change the save schema or farming rules.

## Estate boundary set

The decorative outer boundary has two sets of four seasonal woodland-cluster frames, a southwest river with banks and reeds, a southeast gravel road with split rails and a footbridge, and a northeast low stone wall with flowering hedges. These sit outside the 64 × 64 buildable estate. They are environment compositions, separate from the 28 placeable/planned building and plant types counted above. Broadleaf trees change foliage and become bare in winter; the pine remains evergreen. The boundary currently has maintained seasonal art only; decaying and dilapidated treatments remain future asset work.
