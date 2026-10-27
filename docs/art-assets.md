# Farm scenery assets

`public/art/farm-atlas.png` is a six-cell atlas: farmhouse, barn, apple tree, well, garden shed, and flowering tree. Cells are arranged left to right, then top to bottom. Phaser derives cell dimensions from the image so the source remains independent of display scale.

Created with the built-in image generation tool. Generation brief: a transparent, three-column, two-row atlas of detailed pixel-style farm sprites, all using the same fixed isometric camera and warm upper-left light. Include a cream farmhouse with terracotta tiles, green shutters, porch, and flower boxes; a red timber barn with slate roof and hay; an apple tree with clustered leaves; a stone well with blue canopy; a mossy garden shed with tools; and a pink flowering tree. Use rich material texture, warm outlines, and no text or UI. A second extraction pass removes the colored backdrop while preserving the six sprites and their positions.

`farm-atlas-fall.png` and `farm-atlas-winter.png` use the same six-cell layout. Variant prompts preserve the exact objects, cell boundaries, and positions while changing vegetation and ground details. Autumn uses amber and russet leaves with no pink blossoms. Winter uses bare snow-covered branches, snow on roofs and ground footprints, dormant flower boxes, and warm windows.

These are decorative scenery assets. They do not represent purchased buildings, harvestable trees, or game-state changes. Autumn and winter use distinct atlases so foliage and roofs change with the terrain. Summer adds a warm tint to the spring artwork.
