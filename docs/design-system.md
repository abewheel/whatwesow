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

Use nearly the whole viewport for the farm. The farm name, seasonal resources, and menu sit over its top edge. Selected seeds, placement cancellation, folded camera controls, and brief action feedback sit at the bottom. The seed button opens the basket after the farmer reaches its service. Save status and export/import live inside the farm menu. Building menus open when the farmer reaches their entrance. On phones, keep the calendar, coins, and menu in one row. Open services in a sheet sized to its content, with a fixed close button and one scrolling body. Landscape sheets leave the balance visible beside them. Keep buttons and form controls at least 44px high. Keep development tools below the game.

Keep the field at the center with buildings, trees, paths, and water around it. Empty plots must remain recognizable. Scenery is decorative until a game system gives it behavior; avoid buttons that imply unavailable actions.

## Pixel language

Render on a small logical canvas at whole pixel scales, without smoothing. Use stepped silhouettes, flat color clusters, a dark lower edge, and a lighter upper face. Keep procedural scenery deterministic. Buildings use cream walls, timber trim, terracotta roofs, and green doors. Future crops need distinct silhouettes at each growth stage; animals need readable shapes before extra detail.

The scene combines a detailed sprite atlas with deterministic terrain textures. Buildings have tiled roofs, timber joints, stonework, flower boxes, and garden tools; tree canopies use layered leaf and blossom clusters. Keep all buildings at the same isometric angle. Preserve open, readable plots between the denser cottage borders. See [art assets](art-assets.md) for the atlas layout and generation brief. Do not use the concept sheet itself as a game background.

## Interface

Use thin timber frames around parchment panels and a restrained offset shadow. Corners stay nearly square. Use the readable pixel font throughout the player controls. Keep labels at least 12px, with visible keyboard focus and native controls where practical. Use crop and building artwork with short numeric facts for prices, growth, harvests, and production benefits. Put unlock goals and character notes behind disclosures. Use an 8px spacing rhythm, with 12–18px panel padding.

Reserve motion for useful feedback: crop growth, harvest rewards, selected plots, and subtle environmental life. Honor reduced-motion preferences when adding animation. Never rely on color alone to communicate available actions or crop readiness.

The current HUD uses the detailed nine-slice frame and icon atlas described in [HUD artwork](art/hud-generation.md). CSS owns the frame slicing; `src/game/icons.ts` owns icon cell mapping.

## Grid and placeable objects

All farm surfaces use a shared 2:1 projection: 36 × 18 logical pixels per tile. Store positions as column and row, never screen offsets. The playable estate is 64 × 64 tiles, displayed at 64 × 32 pixels per tile in a scrollable world. Buildings, trees, garden beds, paths, and soil use the same projection. Buildings sit directly on the terrain; artwork is sized and positioned from its visible ground apron, with a small inset from both front tile edges. The same geometry drives artwork clicks. Seasonal and construction artwork share one calibrated envelope, so their bases stay inside the occupied cells. Utility buildings and the market use smaller artwork within their lots so the farmhouse, barn, and mill retain their scale. Keep artwork hit areas in sync with these proportions. Buildings cast muted shadows down and right from a shared upper-left light. Project the current sprite’s alpha silhouette onto the ground so roofs, chimneys, windmill sails, and construction frames keep their own outlines. Draw shadows on the ground below crops and people, then draw objects from back to front using their grid depth.

The following footprints belong to the older layout fixtures and art planning. For live placement, use the [construction catalog](construction.md#farming-opportunities), which includes a 3 × 2 farmhouse and barn, a 2 × 2 well, and 1 × 1 construction trees.

| Object | Fixture or planned footprint | Intended role |
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

Frame the northwest edge with woodland, the southwest (bottom-left) edge with a river, the southeast edge with a gravel road, and the northeast edge with a dry-stone wall and cottage hedges. Use the same isometric axes as the land. Keep boundary geometry and tree bases outside the buildable grid, and keep low foreground borders from hiding player structures. Seasonal river colors, reeds, road tracks, hedge flowers, snow caps, and woodland artwork change together. The footbridge joins the road and river at the south corner; a gap in the road fence leaves a visual entrance. These boundaries are scenery, not new movement or construction rules.

Carry the exterior landscape to the visible game-window edge. A narrow southwest river has two visible banks and meadow beyond it; dense woodland fills the northwest exterior; textured wildflower meadow continues behind the northeast hedge and southeast road. Avoid a thin decorative border surrounded by empty flat ground. Forest groves use mixed oak/pine and birch/spruce artwork, stable irregular spacing, overlapping canopies, depth sorting, and varied scale and tint. Keep tree placement deterministic across panning and zoom, and cull only complete offscreen sprites.

Painted grass, soil, woodland floor, and gravel share the same grid projection. Sample textures in world coordinates so they stay fixed during panning and zooming. Tilled beds have inset, irregular earth edges and shallow furrows. Keep grass contrast low enough to read crops and building silhouettes. Seasonal ground palettes, undergrowth, reeds, wildflowers, rocks, and fallen branches change together. See [the ground artwork notes](../public/art/ground-materials.md) for source assets and generation prompts.
