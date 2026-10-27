# Visual design system

The [concept art](images/art-direction.png) sets the visual direction: a warm, colorful farm with readable crops, cozy buildings, and seasonal changes. Keep the fixed isometric management view. The farm is the main surface, with compact controls around it.

## Palette

| Role | Color | Use |
| --- | --- | --- |
| Parchment | `#fff0ca` | HUD panels and menus |
| Timber | `#805331` | Borders, structures, button edges |
| Ink | `#493621` | Primary text |
| Muted ink | `#766647` | Supporting text |
| Meadow | `#83ad65` | Spring terrain |
| Leaf | `#4e8547` | Foliage and accents |
| Soil | `#96623f` | Tilled plots |
| Terracotta | `#c6653c` | Roofs and warm accents |
| Water | `#68aeb9` | Stream and windows |

Summer deepens greens; fall turns foliage amber and rust; winter adds pale snow and blue-green shadows. Preserve dark outlines and text contrast in every season.

## Composition and scale

Use nearly the whole viewport for the farm. A compact identity strip sits above it; the farm name and seasonal resources sit at its top corners. Save controls remain below. On small screens, hide secondary copy and wrap the seasonal HUD. Keep development tools below the game.

Keep the field at the center with buildings, trees, paths, and water around it. Empty plots must remain recognizable. Scenery is decorative until a game system gives it behavior; avoid buttons that imply unavailable actions.

## Pixel language

Render on a small logical canvas at whole pixel scales, without smoothing. Use stepped silhouettes, flat color clusters, a dark lower edge, and a lighter upper face. Keep procedural scenery deterministic. Buildings use cream walls, timber trim, terracotta roofs, and green doors. Future crops need distinct silhouettes at each growth stage; animals need readable shapes before extra detail.

The scene combines a detailed sprite atlas with deterministic terrain textures. Buildings have tiled roofs, timber joints, stonework, flower boxes, and garden tools; tree canopies use layered leaf and blossom clusters. Keep all buildings at the same isometric angle. Preserve open, readable plots between the denser cottage borders. See [art assets](art-assets.md) for the atlas layout and generation brief. Do not use the concept sheet itself as a game background.

## Interface

Use parchment panels with two-pixel timber borders, a small inset highlight, and a restrained offset shadow. Corners stay nearly square. Use Georgia for names and short story headings, system sans-serif for resources, controls, and longer text. Keep labels at least 12px, with visible keyboard focus and native controls where practical. Use an 8px spacing rhythm, with 12–18px panel padding.

Reserve motion for useful feedback: crop growth, harvest rewards, selected plots, and subtle environmental life. Future animation should honor reduced-motion preferences. Never rely on color alone to communicate available actions or crop readiness.

## Grid and placeable objects

All farm surfaces use a shared 2:1 projection: 36 × 18 logical pixels per tile. Store positions as column and row, never screen offsets. The playable estate is 128 × 128 tiles, displayed at 64 × 32 pixels per tile in a scrollable world. Buildings, trees, garden beds, paths, and soil use the same projection. Stone foundations mark building footprints; artwork sits above the footprint, anchored at its front corner. Draw objects from back to front using their grid depth.

| Object | Footprint | Intended role |
| --- | --- | --- |
| Farmhouse | 3 × 3 | Home and lifetime progression |
| Barn | 3 × 3 | Livestock and production |
| Garden shed | 2 × 2 | Tools and farming upgrades |
| Well | 1 × 1 | Water and crop support |
| Orchard or flowering tree | 2 × 2 | Future harvests or decoration |
| Flower garden | 2 × 3 | Decoration |

These roles describe the design direction, not implemented unlocks. The projection is in `src/game/layout.ts`; current construction definitions, footprints, prices, and unlocks are in `src/micro/world.ts`. The renderer consumes player-owned placements. The older example objects in the layout module are fixtures, not the live estate. Keep the render footprint explicit and leave open land for expansion. Decorative canopies may overhang their cells, but building bases must remain inside their footprints.

The [asset inventory](asset-inventory.md) defines the required state families for every building and plant, including maintained, decaying, and dilapidated conditions across all seasons and relevant upgrade or growth stages.

## Estate boundary

Frame the northwest edge with woodland, the northeast edge with a river, the southeast edge with a gravel road, and the southwest edge with a dry-stone wall and cottage hedges. Use the same isometric axes as the land. Keep boundary geometry and tree bases outside the buildable grid, and keep low foreground borders from hiding player structures. Seasonal river colors, reeds, road tracks, hedge flowers, snow caps, and woodland artwork change together. The footbridge joins the road and river at the east corner; a gap in the road fence leaves a visual entrance. These boundaries are scenery, not new movement or construction rules.
