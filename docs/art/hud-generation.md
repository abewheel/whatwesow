# HUD artwork

Generated with the built-in imagegen tool, using `public/art/farm-atlas.png` as the visual reference. These are static assets; generation is not part of the game runtime.

- `public/art/hud-frame-detailed.png`: nine-slice frame, sliced 150 pixels from each edge. CSS preserves the corners while stretching the rails and parchment.
- `public/art/hud-icons-detailed.png`: transparent source atlas. The generated spacing is uneven, so `public/art/icons/` contains individual square crops with transparent padding. `src/game/icons.ts` selects these files, and CSS fits the complete image inside each control. Do not sample equal atlas cells, which clip artwork and expose neighboring icons.

## Frame prompt

Create a production game UI texture, matching the supplied building art precisely: richly detailed hand-painted pixel illustration, fine wood grain, warm honey oak with deep brown carved edging, brass square corner pins, subtle moss in OUTER corner crevices only, bevel highlights from upper left. Single square empty front-facing UI frame filling image, perfectly straight orthographic edges, perfectly square symmetric shape. Thick frame occupying exactly outer 18 percent each side, large perfectly empty flat warm pale parchment rectangle in central 64 percent for legible HTML text. No text, symbols, crops, scenery, perspective, extra objects or background outside frame. 1024 square. Real material depth like farmhouse wood trim reference, NOT flat vector or chunky 8-bit blocks. Edges aligned to image edges. Designed for nine-slice border image; keep each edge middle region straight and uniform so can stretch. Use case stylized-concept. Asset type HUD frame texture.

## Icon prompt

Use case stylized-concept. Production game icon atlas matching the supplied richly detailed farmhouse and barn artwork exactly. A perfectly regular 4 by 4 grid, 16 equal square cells, 1024 by1024 transparent canvas. Every icon isolated, centered in its cell, 15 percent clear margin. No grid lines, labels, letters, text, numbers, scenery or shadows outside objects. Hand-painted detailed pixel illustration with fine texture, warm upper-left lighting, material highlights, deep shaded outlines; not flat vector and not simplistic chunky 8-bit. Row1 left-to-right: purple-and-cream turnip with green leaves; orange carrot with leafy green crown; golden corn ear in green husk; detailed blue galvanized watering can. Row2: isometric small square tilled soil plot with tiny wooden plus-shaped stake; shovel with wooden handle and worn steel blade; single gold coin; woven wooden harvest basket. Row3: golden summer sun; pink spring blossom on green leafy stem; autumn orange maple leaf; icy blue six-point snowflake. Row4: brown leather farm journal with brass clasp; timber farmhouse; wooden hammer; stacked seed sacks. These sixteen assets should look like closeups of objects from the reference farm, with matching level of detail and palette. Strict regular grid and full transparency.

## View controls icon

`public/art/icons/view.png` is a transparent 256px icon generated with the built-in image tool using the leather journal icon as a style reference, then resized for the HUD.

Prompt: One isolated magnifying glass with a round aged-brass rim, pale blue reflective lens, and short carved wooden handle angled down-right. Match the journal's detailed painted texture, warm upper-left highlights, and deep brown outlines. Keep a compact silhouette readable at 32px, with transparent margins and no text, scenery, external shadows, or button frame.
