# Crop growth sprites

`crop-stages.png` is a transparent atlas with four columns and three rows. Each frame contains one plant. Explicit frame bounds in `src/game/crop-sprites.ts` preserve tall leaves without neighboring row bleed; the ground contact is at 95% of each cropped frame’s height. The renderer places three plants per plot and sorts them with the farmer and structures by ground depth.

| Crop | Frames used, zero based | Game growth steps |
| --- | --- | --- |
| Turnip | 0, 3 | 0, 1 |
| Carrot | 4, 6, 7 | 0, 1, 2 |
| Corn | 8, 10, 11 | 0, 1, 2 |

Created with the built-in image generation tool. Style references: `docs/images/art-direction.png` and `public/art/farm-atlas.png`.

Prompt: Create a production-ready transparent pixel-art crop sprite sheet for What We Sow. Match the warm, richly shaded plants in the concept art and the detailed farm buildings. Arrange exactly four equally spaced columns and three equally spaced rows, with one isolated plant per cell and generous transparent gutters. Align roots at 85% of each cell's height. Row one contains turnips: a tiny seedling with rounded leaves, a juvenile plant, a developed purple-white root shoulder, and a ripe ivory turnip with purple shoulders and broad green leaves. Row two contains carrots: a tiny narrow-leaf seedling, a young feathery plant, developed orange root shoulders, and a ripe carrot with lush feathery greens. Row three contains corn: a tiny pointed-leaf seedling, a young leafy stalk, a tall stalk with immature green husks, and ripe corn with golden ears and tassels. Use a fixed three-quarter farm overview, crisp pixel clusters, stepped edges, organic leaf shapes, dark green outlines, lime highlights, and increasing size across each growth sequence. Corn is taller than root crops. No soil tiles, dirt patches, backgrounds, grid lines, labels, text, decorative flowers, flat icons, or basic geometric shapes. Preserve genuine transparent alpha.

Radish, tomato, and pumpkin use the separate [seasonal crop sheet](seasonal-crops.md), with their own seedling and ripe frames.
