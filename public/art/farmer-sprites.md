# Farmer sprite sheet

`farmer-sprites.png` is a transparent 1086 × 1448 atlas with six columns and eight rows. Each pose uses a measured rectangle in `farmerFrames` in `src/game/farmer.ts` because the generated rows and columns have uneven spacing. Phaser scales artwork by 58/181 and mirrors it for leftward movement. Walking anchors each pose near its boots; work uses per-frame boot contact points. Feet and the layered ground shadow share the center of one world cell. Work routes stop on a reachable adjacent cell; a tile outline and particles identify the target. Placed structures and current land policy constrain routes, and layout changes clear old destinations. Linear texture filtering matches the painted scenery at game scale.

| Row (zero based) | Frames | Motion |
| --- | --- | --- |
| 0 | 0–5 | Walk toward the camera, right |
| 1 | 6–11 | Walk away from the camera, right |
| 2 | 12–17 | Plant seeds |
| 3 | 18–23 | Water crops |
| 4 | 24–29 | Harvest into a basket |
| 5 | 30–35 | Dig with a spade |
| 6 | 36–41 | Carry a produce basket |
| 7 | 42–47 | Idle |

Walking derives eight alternating leg poses from each variant’s neutral idle drawing through `farmer-gait.ts`, with a gait driven by distance traveled. The source sheet’s two walking rows remain available as reference poses. Farming actions play once over 1.15 seconds. These animations are presentation only and do not delay or change saved farming results. The start screen offers male and female farmers, with male selected by default. The selection persists as `farmerVariant` in the save; older saves use male. `farmer-female-sprites.png` covers the same 48 poses with separate measured rectangles in `femaleFarmerFrames`. Both variants share routing, the derived eight-frame gait, work timing, effects, facing, and idle breathing. Each gait normalizes the neutral drawing to shared hip and boot anchors. Background villagers use both variants.

The female sheet was made with the built-in image generation tool using the male sheet as the edit target. Prompt: Edit target sprite atlas: create female farmer version of all 48 poses. Preserve EXACT six column eight row layout, positions, dimensions, scale, tools, gestures and boot positions of reference. Change each man to same consistent adult woman, no facial hair, brown braid tucked behind shoulders, straw hat green rolled sleeve shirt blue denim overalls brown boots. Match painted rendering and shading. Row order southeast walk, northeast walk, planting, watering, harvesting, digging, carrying basket, idle. All six frames each row. Transparent background. No text or grid. Output same aspect ratio as reference. Every pose fully contained.

Created with the built-in image generation tool, using `farm-atlas.png` as a style reference.

Prompt: Create a production transparent character sprite sheet matching the reference's detailed hand-painted isometric farm rendering, warm upper-left sunlight, sculpted shading, material texture, and crisp silhouettes. Use one consistent adult farmer in a straw hat with brown ribbon, green rolled-sleeve shirt, blue denim overalls, brown leather boots, warm skin, and brown hair. Avoid blocky pixels and square limbs. Arrange exactly six columns and eight rows, with six sequential frames each for southeast walking, northeast walking, planting, watering, harvesting, digging, carrying produce, and idle breathing. Keep camera, identity, scale, and frame spacing consistent, with transparent padding for tools, no scenery, labels, or grid lines. Show cloth folds, hat weaving, facial features, a seed pouch, metal watering can and blue droplets, turnips and a wicker basket, and a wooden-handled steel spade.
