# Walking artwork

The walking sprites use the existing `farmer-sprites.png` and `farmer-female-sprites.png` as character references, especially the bottom idle row. They preserve the compact build, rounded hands and boots, green rolled-sleeve shirt, denim overalls, straw hat, male facial hair, and female braid. These are complete paintings, without separately resized body parts.

`farmer-walk.png` and `farmer-female-walk.png` are transparent 512 × 384 atlases. Each has four 128 × 192 cells per row: front view first, rear view second. The four phases alternate contact and passing for each leg. The game mirrors the sheets for leftward travel. It advances one frame per 0.4 grid units, preserving the previous full-cycle travel distance.

Each source strip was scaled uniformly, with a consistent scale across all four poses in a view. The head alignment and lowest boot position establish stable placement; source-cell bleed was excluded using the main connected silhouette. Male drawings are 174 pixels tall and female drawings 182 pixels tall, matching their existing idle/work scale. Feet use the shared (64, 186) anchor. No limb or torso was stretched independently.

## Generation

Created with the built-in image generation tool. The original character artwork and a four-pose motion guide were supplied as references. Rejected drafts that repeated the same lead leg were not shipped.

The accepted front-strip prompt, followed by the targeted correction, was:

> Create four full-body painted game sprites in one horizontal row on transparent background. The original idle image supplies the exact identity, anatomy, clothing, face, hat, chunky proportions and painted art style. The motion guide supplies only four different leg arrangements. Preserve the short broad torso, stout arms and legs, large hands and boots. Use a fixed front three-quarter camera facing right and consistent ground baseline. Pose 1: near leg forward, far leg back, near arm back. Pose 2: near leg supports, far leg passes. Pose 3: far leg forward, near leg back, near arm forward. Pose 4: far leg supports, near leg passes. No text, props, shadows or scenery.

> Preserve the character and four cells. Reduce the marching stride to a relaxed walking step. In pose 2, the far boot passes close to the supporting ankle rather than lifting to hip height. In pose 4, the far leg supports while the near boot passes forward. Preserve opposite contact legs in poses 1 and 3.

The accepted rear-strip prompt and corrections were:

> Render the four-panel motion guide as the rear of the same farmer, with the original idle artwork supplying identity and style. Face upper right, showing the back of the hat, shirt and overalls. Preserve four distinct leg arrangements, compact proportions and equal scale. Arms counter-swing beside the torso. Transparent background, no labels, ground or shadows.

> Change only panel 3's lower body: the right boot trails at lower right with its sole visible; the left boot is farther away, showing its toe/side. Keep the legs separate. Preserve the other panels and the head, torso and arms.

> Change only panel 1's arms: the left arm swings forward around the body's side while the right arm swings back, visible outside the right hip. Preserve all leg poses and other panels.

The female conversion prompt, applied separately to front and rear strips, was:

> Preserve the four distinct poses, scale, layout and transparent background. Change only identity to the existing female farmer: the same young adult woman, face and eyes, brown braid, no facial hair, straw hat, green shirt, denim overalls and chunky boots. Match the original female idle and rear artwork. Do not change steps, arm placement or camera angle.

The final arm-continuity edit, applied to both variants and views, was:

> Preserve all character identity, body proportions, leg and boot poses, scale and layout. Change only arms in passing panels 2 and 4 to hang relaxed nearly vertically beside the hips, hands alongside upper thighs. These are neutral intermediate poses between opposite arm swings. Soften the front panel 3 forward swing so the hand stays near the hip rather than crossing the bib. Keep contact panels and all leg phases unchanged.

## Rear cycle alignment

The rear row was rebuilt with a four-pose motion guide so the feet stride along the same heading as the head, torso, and hips. The contact poses alternate the near and far leading leg, with a passing pose between them. Both boot toes follow the travel direction instead of spreading sideways. All front-row pixels were preserved.

The rear generation used the approved front artwork for identity and a separate skeletal guide for poses:

> Render four distinct rear three-quarter walking poses. The near leg leads in frame 1, supports in frame 2, trails in frame 3, and passes in frame 4. The far leg does the opposite. Keep the head, shoulders, pelvis, knees, and toes facing the same rightward heading. Legs swing forward and backward along that heading, not sideways. Preserve the original stocky proportions, clothing, hat, and painted style. Four evenly spaced full bodies, consistent scale, transparent background.

A targeted follow-up corrected the fourth pose's leg overlap and softened the intermediate arm positions:

> In panel 4, the near leg swings forward across and in front of the far supporting leg, opposite panel 2. Preserve the other leg poses and heading. Use relaxed intermediate arm positions in panels 2 and 4.

The female conversion preserved those four rear poses and changed only identity to the original female artwork, including her face and braid. Each complete source row was uniformly scaled and packed into the existing 128 × 192 cells with the existing foot anchor; no separately scaled body parts or rendering changes were introduced.
