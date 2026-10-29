# Walking artwork

The walking sprites use the existing `farmer-sprites.png` and `farmer-female-sprites.png` as character references, especially the bottom idle row. They preserve the compact build, rounded hands and boots, green rolled-sleeve shirt, denim overalls, straw hat, male facial hair, and female braid. These are complete paintings, without separately resized body parts.

`farmer-walk.png` and `farmer-female-walk.png` are transparent 512 × 384 atlases. Each has four 128 × 192 cells per row: front view first, rear view second. The four phases alternate contact and passing for each leg. The game mirrors the sheets for leftward travel. It advances one frame per 0.4 grid units, preserving the previous full-cycle travel distance.

Each source strip was scaled uniformly, with a consistent scale across all four poses in a view. The head alignment and lowest boot position establish stable placement; source-cell bleed was excluded using the main connected silhouette. Male drawings are 174 pixels tall and female drawings 182 pixels tall, matching their existing idle/work scale. Feet use the shared (64, 186) anchor. No limb or torso was stretched independently.

## Generation

Created with the built-in image generation tool. The original character artwork and a four-pose motion guide were supplied as references. Rejected drafts that repeated the same lead leg were not shipped.

The accepted front-strip prompt, followed by the targeted correction, was:

> Create four full-body painted game sprites in one horizontal row on transparent background. The original idle image supplies the exact identity, anatomy, clothing, face, hat, chunky proportions and painted art style. The motion guide supplies only four different leg arrangements. Preserve the short broad torso, stout arms and legs, large hands and boots. Use a fixed front three-quarter camera facing right and consistent ground baseline. Pose 1: near leg forward, far leg back, near arm back. Pose 2: near leg supports, far leg passes. Pose 3: far leg forward, near leg back, near arm forward. Pose 4: far leg supports, near leg passes. No text, props, shadows or scenery.

> Preserve the character and four cells. Reduce the marching stride to a relaxed walking step. In pose 2, the far boot passes close to the supporting ankle rather than lifting to hip height. In pose 4, the far leg supports while the near boot passes forward. Preserve opposite contact legs in poses 1 and 3.

## Rear walk geometry

The rear row uses one fixed upper-right heading. The head, shoulders, pelvis, knees, and both boot toes share that heading throughout the cycle. Both legs swing along parallel upper-right/lower-left paths, with opposite arm swings. The contact poses alternate which leg leads; the passing poses bring the feet together with a low bent knee. A trailing foot stays on its own path instead of kicking sideways toward the opposite screen corner.

The built-in image tool used the original front artwork for identity and style, plus a four-pose skeletal guide for the rear walk. The generation brief was:

> Render the four skeletal poses as the same compact farmer, viewed from behind while moving upper-right. Preserve the straw hat, green shirt, denim overalls, chunky boots, and warm painted pixel style. Keep head, torso, hips, knees, and both toes facing upper-right in every pose. The legs alternate on parallel diagonal paths, and arms swing opposite their corresponding legs. Use low passing steps, a stable head and torso, equal scale, and transparent gutters. No labels, ground, or shadows.

The targeted third-pose correction was:

> Move the near leg forward toward screen right, showing the boot's side and toe pointing upper-right. Move the far leg back toward screen left, partly behind the near leg. The near thigh overlaps in front of the far thigh. Swing the near arm back beside the hip and the far arm forward behind the torso. Preserve the head, torso, and the other poses. Both boots must retain the same upper-right heading.

The female conversion preserved these poses and changed only identity to the existing female farmer, including her brown braid. Each rear strip uses a uniform scale and aligned hat silhouettes. Extraction keeps complete connected silhouettes even where a boot crosses a source-cell boundary. The original front rows are copied without resampling.

## Four screen directions

The renderer chooses the front or rear row from vertical screen movement and mirrors the entire sprite for leftward movement. It never flips body parts separately.

| Screen travel | Row | Whole-sprite horizontal mirror |
| --- | --- | --- |
| Down-right | Front, frames 0–3 | No |
| Down-left | Front, frames 0–3 | Yes |
| Up-right | Rear, frames 4–7 | No |
| Up-left | Rear, frames 4–7 | Yes |

The browser direction checks observe actual sprite frames, horizontal mirroring, and projected movement for both farmers. Every direction must visit all four poses. Visual review covers the complete cycle and its mirrored version because frame metadata alone cannot verify painted anatomy.

## Front arm occlusion

In the third front-facing pose (frame 2), the far arm is hidden behind the torso. Its old protruding hand and upper sleeve read as an extra arm coming out of the farmer's back. A local cutout correction removes the entire exposed far arm, including its sleeve, for both farmers while preserving the foreground sleeve, arm, and hand. The female farmer's braid keeps its original contour. Every other frame, including the rear rows, retains its pixels from the direction-alignment revision.

The built-in image tool received each existing third pose with this edit prompt:

> Remove the entire stray far arm, including the small green upper-arm and sleeve lump protruding to the left behind the large foreground sleeve. That arm is fully occluded behind the torso at this gait phase. Replace it with transparency so the back contour follows the torso without a second sleeve. Preserve the female farmer's braid. Preserve the foreground sleeve and arm, pose, head, clothing, legs, boots, character identity, and painted style. Do not add another hand.

Only the corrected cutout around the stray arm is composited into the original frame. The mirrored front-left cycle uses the same corrected pose.
