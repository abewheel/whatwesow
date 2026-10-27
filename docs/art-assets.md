# Farm scenery assets

`public/art/farm-atlas.png` is a six-cell atlas: farmhouse, barn, apple tree, well, garden shed, and flowering tree. Cells are arranged left to right, then top to bottom. Phaser derives cell dimensions from the image so the source remains independent of display scale.

Created with the built-in image generation tool. Generation brief: a transparent, three-column, two-row atlas of detailed pixel-style farm sprites, all using the same fixed isometric camera and warm upper-left light. Include a cream farmhouse with terracotta tiles, green shutters, porch, and flower boxes; a red timber barn with slate roof and hay; an apple tree with clustered leaves; a stone well with blue canopy; a mossy garden shed with tools; and a pink flowering tree. Use rich material texture, warm outlines, and no text or UI. A second extraction pass removes the colored backdrop while preserving the six sprites and their positions.

`farm-atlas-fall.png` and `farm-atlas-winter.png` use the same six-cell layout. Variant prompts preserve the exact objects, cell boundaries, and positions while changing vegetation and ground details. Autumn uses amber and russet leaves with no pink blossoms. Winter uses bare snow-covered branches, snow on roofs and ground footprints, dormant flower boxes, and warm windows.

The construction renderer uses these sprites for player-owned structures. Some later building types currently reuse another type’s frame and need distinct artwork. Upgrade levels affect gameplay but still share the base artwork. Autumn and winter use distinct atlases so foliage and roofs change with the terrain. Summer adds a warm tint to the spring artwork.

See the [complete building and plant inventory](asset-inventory.md) for required seasonal, upgrade, growth, and disrepair states, current coverage, and proposed additions.

## Woodland boundary

`public/art/woodland-seasons.png` is a four-cell, two-column atlas: spring and summer on the top row, autumn and winter below. Created with the built-in image generation tool. Prompt: a transparent isometric pixel-art cluster of three non-fruiting woodland trees, including a pine, repeated at the same camera and scale in all four seasons. Use fresh spring growth, deep summer foliage, amber and russet autumn leaves, and bare snowy winter broadleaf branches beside a snowy evergreen. Preserve clustered leaves, textured bark, warm outlines, transparent gutters, and root footprints; omit labels and UI.

The river, road, bridge, wall, and hedges are deterministic seasonal geometry in `src/game/boundary.ts`. Every border remains outside buildable cells and uses the farm’s shared projection. The woodland uses its own four-season artwork rather than reusing orchard fruit trees.

`public/art/hedgerow-seasons.png` uses the same four-season, two-column layout. Built-in image generation prompt: a transparent isometric pixel-art atlas of one short dry-stone wall with three low rounded cottage hedges. Keep the wall on the 2:1 grid axis, with a low silhouette in the bottom half of each cell. Show pink and cream spring flowers, dense green summer foliage with gold and lavender blooms, russet autumn leaves and berries, and sparse snowy winter twigs with no flowers. Preserve irregular shaded stones, leaf clusters, transparent margins, and a consistent pivot.

The hedgerow source has an uneven row gutter. Its four frames use explicit rectangles in the scene loader, cropped to each complete sprite’s vertical bounds and anchored at the bottom. Keep this metadata with the source asset when replacing the sheet; equal-height slicing clips the spring and summer wall ends.

## Riverside and woodland variation

`public/art/woodland-variation-seasons.png` adds a second four-season, two-column woodland atlas. Created with the built-in image generation tool. Prompt: a transparent pixel-art grouping of a tall silver birch, short blue-green spruce, and mossy fallen log, repeated at the same isometric camera and pivot in spring, summer, autumn, and winter. Show airy fresh spring leaves, full summer foliage, golden autumn birch leaves, and bare snowy winter birch beside a snowy evergreen. Keep generous transparent cell margins, root footprints, crisp leaf clusters, pale peeling bark, upper-left lighting, and no fruit or labels.

The southwest river now continues to the visible window edge instead of ending in a narrow strip. The northeast hedge borders a wildflower meadow. Woodland fills the northwest exterior with deterministic, irregular groves selected from both seasonal sets. Deeper stands and edge trees vary in spacing, size, and shade; all tree feet remain outside the buildable grid. Seasonal water ripples, reeds, bank stones, and meadow details remain procedural. The road crosses the river at the south corner and continues beyond the view.

## Farmer and HUD

`public/art/farmer-sprites.png` supplies farmer animation frames; [the sprite specification](../public/art/farmer-sprites.md) records its layout. `src/game/farmer.ts` handles animation, contact points, grounded shadows, and presentation tasks. `farmer-route.ts` finds permitted adjacent work positions around actual plot and structure footprints, and `farmer-task.ts` maps successful actions to visual targets. Layout changes invalidate old destinations. Farmer position and tasks are not saved and do not delay economic results.

The detailed HUD frame and 4 × 4 icon atlas are documented in [HUD artwork](art/hud-generation.md). They are static shipped assets, with no runtime generation.
