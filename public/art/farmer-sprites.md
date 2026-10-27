# Farmer sprite sheet

`farmer-sprites.png` is a transparent 1086 × 1448 atlas with six columns and eight rows. Columns are 181 pixels wide; explicit row boundaries at 0, 174, 354, 532, 722, 902, 1084, 1250, and 1448 preserve complete hats. Phaser uses per-frame boot contact points, scales artwork by 58/181, and mirrors them for leftward movement. Feet and the layered ground shadow share the center of one world cell. Work routes stop on a reachable adjacent cell; a tile outline and particles identify the target. Placed structures and current land policy constrain routes, and layout changes clear old destinations. Linear texture filtering matches the painted scenery at game scale.

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

Walking uses the first two rows of the same sheet, with six frames per direction and a gait driven by distance traveled. Farming actions play once over 1.15 seconds. These animations are presentation only and do not delay or change saved farming results. Appearance customization is deferred; this sheet contains one complete character.

Created with the built-in image generation tool, using `farm-atlas.png` as a style reference.

Prompt: Create a production transparent character sprite sheet matching the reference's detailed hand-painted isometric farm rendering, warm upper-left sunlight, sculpted shading, material texture, and crisp silhouettes. Use one consistent adult farmer in a straw hat with brown ribbon, green rolled-sleeve shirt, blue denim overalls, brown leather boots, warm skin, and brown hair. Avoid blocky pixels and square limbs. Arrange exactly six columns and eight rows, with six sequential frames each for southeast walking, northeast walking, planting, watering, harvesting, digging, carrying produce, and idle breathing. Keep camera, identity, scale, and frame spacing consistent, with transparent padding for tools, no scenery, labels, or grid lines. Show cloth folds, hat weaving, facial features, a seed pouch, metal watering can and blue droplets, turnips and a wicker basket, and a wooden-handled steel spade.
