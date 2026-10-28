# Farm scenery assets

`public/art/farm-atlas.png` is a six-cell atlas: farmhouse, barn, apple tree, well, garden shed, and flowering tree. Cells are arranged left to right, then top to bottom. Phaser derives cell dimensions from the image so the source remains independent of display scale.

Created with the built-in image generation tool. Generation brief: a transparent, three-column, two-row atlas of detailed pixel-style farm sprites, all using the same fixed isometric camera and warm upper-left light. Include a cream farmhouse with terracotta tiles, green shutters, porch, and flower boxes; a red timber barn with slate roof and hay; an apple tree with clustered leaves; a stone well with blue canopy; a mossy garden shed with tools; and a pink flowering tree. Use rich material texture, warm outlines, and no text or UI. A second extraction pass removes the colored backdrop while preserving the six sprites and their positions.

`farm-atlas-fall.png` and `farm-atlas-winter.png` use the same six-cell layout. Variant prompts preserve the exact objects, cell boundaries, and positions while changing vegetation and ground details. Autumn uses amber and russet leaves with no pink blossoms. Winter uses bare snow-covered branches, snow on roofs and ground footprints, dormant flower boxes, and warm windows.

The construction renderer uses these sprites for player-owned structures. The mill, greenhouse, market, and hall use `distinct-buildings.png`, as do the village nursery, builder, and field shed, so each building type has a distinct silhouette. Upgrade levels affect gameplay but still share the base artwork. Autumn and winter use distinct atlases so foliage and roofs change with the terrain. Summer adds a warm tint to the spring artwork.

See the [complete building and plant inventory](asset-inventory.md) for required seasonal, upgrade, growth, and disrepair states, current coverage, and proposed additions.

## Woodland boundary

`public/art/woodland-seasons.png` is a four-cell, two-column atlas: spring and summer on the top row, autumn and winter below. Created with the built-in image generation tool. Prompt: a transparent isometric pixel-art cluster of three non-fruiting woodland trees, including a pine, repeated at the same camera and scale in all four seasons. Use fresh spring growth, deep summer foliage, amber and russet autumn leaves, and bare snowy winter broadleaf branches beside a snowy evergreen. Preserve clustered leaves, textured bark, warm outlines, transparent gutters, and root footprints; omit labels and UI.

The river, road, bridge, wall, and hedges are deterministic seasonal geometry in `src/game/boundary.ts`. Every border remains outside buildable cells and uses the farm’s shared projection. The woodland uses its own four-season artwork rather than reusing orchard fruit trees.

`public/art/hedgerow-seasons.png` uses the same four-season, two-column layout. Built-in image generation prompt: a transparent isometric pixel-art atlas of one short dry-stone wall with three low rounded cottage hedges. Keep the wall on the 2:1 grid axis, with a low silhouette in the bottom half of each cell. Show pink and cream spring flowers, dense green summer foliage with gold and lavender blooms, russet autumn leaves and berries, and sparse snowy winter twigs with no flowers. Preserve irregular shaded stones, leaf clusters, transparent margins, and a consistent pivot.

The hedgerow source has an uneven row gutter. Its four frames use explicit rectangles in the scene loader, cropped to each complete sprite’s vertical bounds and anchored at the bottom. Keep this metadata with the source asset when replacing the sheet; equal-height slicing clips the spring and summer wall ends.

## Riverside and woodland variation

`public/art/woodland-variation-seasons.png` adds a second four-season, two-column woodland atlas. Created with the built-in image generation tool. Prompt: a transparent pixel-art grouping of a tall silver birch, short blue-green spruce, and mossy fallen log, repeated at the same isometric camera and pivot in spring, summer, autumn, and winter. Show airy fresh spring leaves, full summer foliage, golden autumn birch leaves, and bare snowy winter birch beside a snowy evergreen. Keep generous transparent cell margins, root footprints, crisp leaf clusters, pale peeling bark, upper-left lighting, and no fruit or labels.

The southwest river is a narrow winding channel with a visible far bank and meadow beyond it. The northeast hedge borders a second seasonal forest that continues through the upper scroll corners. Woodland fills the northwest exterior with deterministic, irregular groves selected from both seasonal sets. Deeper stands and edge trees vary in spacing, size, and shade; all tree feet remain outside the buildable grid. Water depth bands and ripples remain procedural; seasonal reeds, bank stones, flowers, and undergrowth use the border detail atlas. The road crosses the river at the south corner and continues beyond the view.

## Farmer and HUD

`public/art/farmer-sprites.png` supplies farmer animation frames; [the sprite specification](../public/art/farmer-sprites.md) records its layout. `src/game/farmer.ts` handles animation, contact points, grounded shadows, and presentation tasks. `farmer-route.ts` finds permitted adjacent work positions around actual plot and structure footprints, and `farmer-task.ts` maps successful actions to visual targets. Layout changes invalidate old destinations. Farmer position and tasks are not saved and do not delay economic results.

The detailed HUD frame and 4 × 4 icon atlas are documented in [HUD artwork](art/hud-generation.md). They are static shipped assets, with no runtime generation.

## Distinct buildings and farmer frames

`distinct-buildings.png` is a transparent 1280 × 1280 atlas. Its nine cells show a windmill, greenhouse, market, hall, nursery, carpenter workshop, field shed, barn, and farmhouse. The last two remain reference cells; the existing seasonal barn and farmhouse artwork stays in use. Explicit frame bounds in `scene.ts` preserve complete roofs and steps. Building names remain in accessible hit targets and inspection menus, with a parchment tooltip in the game font on hover and no permanent building labels or native tooltips. Hovering any occupied cell highlights the complete footprint. New building sprites use timber scaffolding and faded artwork during construction and upgrades; both clear when work finishes.

The farmer uses `farmer-sprites.png` for walking, idle, and work so the character keeps the same appearance and scale. Measured rectangles for every pose preserve complete hats and exclude adjacent rows and columns. The source walking rows repeat a raised-boot pose, so `farmer-gait.ts` derives eight alternating leg poses from the neutral drawing. Detached ground marks are removed from those frames, and their boots share a stable ground contact. Work contact points account for the rectangle offset. Distance traveled drives the gait, and movement carries unused distance across cell boundaries. Idle uses one stable pose with continuous, foot-anchored breathing; reduced motion keeps it still. Farmer depth compares his feet with both front edges of each building footprint, keeping him visible along front paths and occluded behind buildings. Buildings sit directly on the seasonal terrain, without a filled or outlined foundation tile; their ground artwork stays inside the occupied footprint. Cast shadows sweep from each opaque sprite to its ground projection so sloped front edges remain attached.

The building asset used the built-in image generation tool. Building prompt: a warm painted pixel-style isometric farm atlas with a four-sail grain windmill, glass greenhouse, striped produce market, bell-tower hall, green-roof nursery with sapling racks, open carpenter workshop with lumber, and slate-roof tool shed. Each building has a distinct silhouette, with no text. A second pass removed the backdrop, then a layout pass added clear row gutters.

## Ground materials and border details

`public/art/ground-materials.png` contains grass, cultivated soil, woodland floor, and gravel. `src/game/terrain.ts` samples adjacent material regions, applies seasonal colors, and bakes them into a cached 2:1 tile atlas. Grass has restrained contrast and broad tonal variation; tilled beds have inset edges, earth clods, and shallow furrows. The visible ground is flattened into one viewport-sized render texture when the view or farm changes, so idle frames do not redraw hundreds of tile sprites.

`public/art/border-details-seasons.png` adds seasonal wildflowers, fern and berry shrubs, mossy boulders with fallen branches, and cattails. Explicit rectangles in `border-artwork.ts` preserve uneven gutters. Woodland canopies overlap densely; meadow trees, flowers, and undergrowth vary along the hedge and gravel lane. The short footbridge spans only the river, and the lane continues across the far bank. All scattering uses stable world coordinates and stays outside the estate.

Both assets were made with the built-in image generation tool. [Source layouts and full prompts](../public/art/ground-materials.md) record their generation and rendering contract.

The seasonal crop expansion uses `seasonal-crops.png` for distinct radish, tomato, and pumpkin seedlings and ripe plants. Their produce icons are separate transparent PNGs, cropped from the same generated sheet to match the detailed HUD. Explicit frame bounds preserve the uneven gutters; source-independent display widths keep seedlings smaller than ripe plants and align the new plants with the original crops. [Layout and generation prompt](../public/art/seasonal-crops.md).

## Exterior village and orchard

Beyond the southwest river, seasonal cottages, barns, garden sheds, wells, flowering trees, and garden borders form a decorative village. Gravel lanes connect its blocks. The southeast lane borders an orchard with fruit trees, flowering trees, garden sheds, and wells. Both areas continue through the visible scroll bounds at every zoom, using the existing seasonal farm atlases. They remain outside buildable land and do not add services or income.

Decorative villagers walk along the paths using the existing farmer frames. Their positions and gait follow scene time, so camera redraws do not restart their walks. Reduced motion keeps them in a stationary idle pose. All exterior placement uses stable world coordinates.

## Lane, fence, and entrance

`public/art/lane-seasons.png` contains four seasonal rows of timber fence spans, an open stone-pillared entrance, and bronze lantern posts. `src/game/lane-artwork.ts` records the measured gutters and aligns the fence and gate contacts to the 2:1 grid with a canvas shear. The fence leaves complete spans clear of the entrance; small verge stones edge the textured gravel lane. Lamps flank the entrance and repeat beside the orchard. Winter adds snow to rails, caps, and lanterns; autumn uses russet vines.

Created with the built-in image generation tool. Prompt: a transparent three-column, four-row atlas of detailed painted pixel-art timber fence spans with capped posts and cross braces, an open entrance with cream stone pillars and terracotta caps, and ornate bronze amber lantern posts. Use warm upper-left light, wood grain, bolts, ivy, stone and flower barrels; repeat the geometry in spring, summer, autumn, and snowy winter, with generous transparent gutters and no labels.

## Animal pens

`public/art/animal-buildings-seasons.png` is a three-column, four-row atlas: chicken coop, dairy barn, and sheepfold in spring, summer, fall, and winter. `public/art/livestock-sprites.png` contains four idle/feeding poses for each animal. Both were generated with the built-in image tool using the existing building atlas as a style reference. The full briefs are in [animal artwork](art/animal-generation.md).

`src/game/animal-layout.ts` records source rectangles and a shared seasonal envelope. Rendering and pixel-alpha hit tests use the same placement, scale, and front-edge limits. Animal pens register with farmer depth sorting; overlapping artwork receives clicks in visual depth order. Animals animate within the fenced yard, with stable foot pivots. Reduced motion uses a still frame. Pending work uses faded artwork and scaffolding; construction hides livestock until complete. A small coin badge marks products ready to collect.

The beginning tent uses `starter-tent.png`, a detailed canvas shelter with timber poles, ropes, stakes, a crate, and bedrolls. It shares the buildings' warm isometric lighting and has no permanent name label. Its alpha silhouette drives artwork clicks and it participates in farmer depth sorting. [Sprite layout and generation prompt](../public/art/starter-tent.md).
