# Tree and harvest artwork

Created with the built-in image generation tool, using `docs/images/art-direction.png` and `public/art/crop-stages.png` as style references.

- `apple-stages.png`: nine apple tree sprites, with sapling, growing, and mature stages for green foliage, autumn foliage, and bare winter branches.
- `oak-stages.png`: the same stages for oaks, with lobed leaves and a broad crown.
- `tree-products.png`: separate apple and acorn sprites. Trees contain no baked-in produce, so picking a tree removes all its fruit or nuts.

Measured rectangles in `src/game/tree-sprites.ts` preserve complete branches and roots. Ages below one-quarter of maturity use the sapling sprite; older immature trees use the growing sprite. Spring and summer share the green sprites. Tree age, seasonal production, and saved harvest status remain in the farming rules.

Picking a tree shakes its crown and drops its produce. The farmer uses the harvest animation for both crops and trees. A tile reward, gold ring, and flying coins lead to a HUD count-up. The saved balance and available purchases update immediately; spending or loading a state cancels the old count-up. Reduced motion uses a brief reward label and an immediate count update.

## Tree prompt set

Species substitutions:

- Apple: APPLE trees, with rounded small orchard canopy and slender bark.
- Oak: OAK trees with lobed leaves, broad spreading canopy, sturdy textured bark.

Prompt used for each species:

Use case: stylized-concept. Production game pixel-art sprite atlas for What We Sow. Style references only: match the detailed warm organic pixel-art crops and farm in the reference images. ONE transparent sprite sheet, square 1536x1536. Exactly THREE equally spaced columns and THREE equally spaced rows, nine isolated trees. Species: the substitution above. Columns LEFT TO RIGHT: newly planted tiny sapling (thin woody stem, just a few leaves); half-grown juvenile tree (visibly smaller and slimmer than mature); full mature tree (richly shaded, organic sculpted crown). Rows TOP TO BOTTOM: spring/summer healthy green foliage; autumn golden ochre and rusty foliage; winter dormant bare branching silhouette with light snow settled on branches. All frames share EXACT ground contact at 88% cell height and horizontal center in cell, generous transparent padding; natural tree size grows strongly across columns. Fixed three-quarter top-down farm overview with readable trunk and root flare. Crisp intricate pixel clusters, warm upper-left sunlight, lime leaf highlights, dark forest-green shadows, earthy bark. Not simple geometric circles, no basic shapes or vector icons. CRITICAL: NO apples, NO acorns, NO fruit, NO blossoms in ANY tree. Product will be rendered separately in the game, so every tree must be completely free of produce and decorative fruit-like dots. NO soil tiles, grass patches, scenery, grid lines, labels, text, watermarks. Genuine transparent alpha background. Keep entire branches inside their own cells with substantial clear gutters.

## Product prompt

Use case: stylized-concept. ONE production pixel-art game item atlas, square 1024x1024 transparent background. Exactly TWO isolated items, horizontally arranged in two equal halves, centered at x=256 and x=768, both centered vertically at y=512. LEFT: one glossy red apple with short brown stem, single green leaf, warm golden highlight, dark red shaded underside. RIGHT: one large golden-brown acorn with a dark textured crosshatched cap and short woody stem, unmistakable rounded oak acorn, warm tan nut body and pointed tip. Each item fills about 300x360 pixels, generous clear transparent margins, no overlapping. Match the reference's crisp organic detailed pixel-art clusters, warm farming game colors, stepped silhouettes, three-quarter view, rich sculpted shading. No black outline thicker than a pixel cluster. NO scenery, no tile, no background, no shadow field, no text, no borders or labels. Genuine transparent alpha. Items must read cleanly when reduced to 10px apples and 9px acorns on a tree canopy.
