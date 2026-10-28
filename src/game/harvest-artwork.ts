import type Phaser from "phaser";

/** Painted basket artwork shared with the HUD, without labels or amounts. */
export function drawHarvestCue(
  scene: Phaser.Scene,
  x: number,
  y: number,
  kind: string,
) {
  const cue = scene.add.container(x, y).setName(`harvest-ready:${kind}`);
  // A soft pool of warm light separates the woven basket from grass and roofs.
  // Layered ellipses keep the edge soft at every farm zoom without a badge frame.
  const light = scene.add.graphics();
  for (let radius = 19; radius >= 9; radius -= 2)
    light
      .fillStyle(0xffe9a7, 0.055)
      .fillEllipse(0, 2, radius * 2, radius * 1.7);
  light.fillStyle(0x35251b, 0.22).fillEllipse(0, 13, 27, 7);
  const basket = scene.add
    .image(0, -2, "harvest-basket")
    .setDisplaySize(32, 32);
  cue.add([light, basket]);
  return cue;
}
