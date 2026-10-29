# Rear-facing work artwork

`farmer-rear-work.png` and `farmer-female-rear-work.png` provide the upper-right, rear three-quarter versions of the farmer's work. The renderer mirrors the entire drawing for upper-left work. Front work keeps the original `farmer-sprites.png` and female atlas. Idle uses the appropriate front or rear contact pose from the walking sheets, so arrival and stopping preserve the visible heading.

Each transparent atlas is 1440 × 1050, with six columns and five rows of 240 × 210 frames. The boot anchor is (100, 198). The artwork uses the existing 58/181 world scale; source paintings were scaled uniformly to match the original 174px male and matching female bodies. No limbs or tools are stretched separately.

| Row | Frames | Action |
| --- | --- | --- |
| 0 | 0–5 | Plant seeds |
| 1 | 6–11 | Water crops |
| 2 | 12–17 | Harvest into a basket |
| 3 | 18–23 | Dig with a spade |
| 4 | 24–29 | Hold a produce basket |

The built-in image generation tool created the rear poses using `farmer-sprites.png` and `farmer-walk.png` as identity and camera references. The accepted male source is `exec-e8546f4b-7a83-4a46-aeb6-b92e2a706962.png` from generation `01a189dc-5d3c-73d2-a432-785cd4896319`. Source frames have uneven gutters, so the final atlas isolates the connected body silhouettes and their nearby tool particles before arranging regular cells. Boot contacts align each pose. Browser pixel checks and a gray-backdrop render verify alpha transparency, because a source preview can show the pre-extraction background.

Generation brief:

> Match the original compact farmer, straw hat, green rolled-sleeve shirt, denim overalls, brown boots and warm painted style. Create thirty complete rear three-quarter poses facing upper-right in six columns and five rows. Rows show six stages each of planting, watering, harvesting into a basket, digging, and holding produce. Keep the back of the hat and overall straps visible, with head, torso and toes sharing the upper-right heading. Preserve body scale, tools, and full silhouettes. Use transparent gutters without scenery, shadows, text or grid lines.

The female conversion uses the normalized male atlas and `farmer-female-walk.png` as references:

> Convert only the farmer identity to the established adult female farmer with brown braid and no beard. Preserve all thirty actions, exact source cells, body scale, tools, boot contacts, upper-right heading and transparent gutters. Keep every figure separate and fully contained.

The accepted female conversion source is `exec-8d9e6477-fe89-41a0-9b61-9c64cab3ac0e.png` from the same generation. Its complete separated silhouettes are normalized into the final cells; earlier sources with touching rows were rejected. The final wider cells leave tools and soil clear of the neighboring frame.
