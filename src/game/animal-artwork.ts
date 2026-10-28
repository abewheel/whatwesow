import Phaser from "phaser";
import { type AnimalKind, type Structure } from "../micro/world";
import { animalFrame, animalKinds, livestockFrames } from "./animal-layout";

/** Painted seasonal shelter and independently animated livestock, all within its lot. */
export function drawAnimalPen(
  scene: Phaser.Scene,
  s: Structure & { kind: AnimalKind },
  season: string,
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number,
) {
  const view = scene.add.container(x, y).setDepth(depth);
  const working = !!(
    s.pendingConstruction ||
    s.pendingUpgrade ||
    s.pendingDemolition
  );
  const shelter = scene.add
    .image(0, 0, "animal-buildings", animalFrame(s.kind, season))
    .setOrigin(0)
    .setDisplaySize(width, height)
    .setAlpha(working ? 0.55 : 1);
  view.add(shelter);
  if (!s.pendingConstruction && !s.pendingDemolition) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const column = animalKinds.indexOf(s.kind);
    const scale =
      (s.kind === "coop" ? 17 : s.kind === "dairy" ? 32 : 27) /
      livestockFrames[column][2];
    for (let i = 0; i < 2; i++) {
      const animal = scene.add
        .image(
          width * (i ? 0.62 : 0.4),
          height * (i ? 0.8 : 0.74),
          "livestock",
          column,
        )
        .setOrigin(0.5, 1)
        .setScale(scale)
        .setFlipX(i === 1);
      view.add(animal);
      if (!reduced) {
        const animation = { phase: 0 };
        const tween = scene.tweens.add({
          targets: animation,
          phase: 3.99,
          duration: 2400 + i * 430,
          repeat: -1,
          delay: i * 600,
          onUpdate: () =>
            animal.setFrame(column + Math.floor(animation.phase) * 3),
        });
        animal.once("destroy", () => tween.remove());
      }
    }
  }
  if (working) {
    const scaffold = scene.add.graphics();
    scaffold.lineStyle(2, 0x89633d);
    for (const px of [0.2, 0.52, 0.8])
      scaffold.lineBetween(
        width * px,
        height * 0.43,
        width * px,
        height * 0.88,
      );
    scaffold.lineBetween(
      width * 0.18,
      height * 0.58,
      width * 0.82,
      height * 0.58,
    );
    view.add(scaffold);
  }
  // Small coin badge stays on the shelter; detailed readiness is in the accessible label.
  if (s.product && !s.pendingConstruction && !s.pendingDemolition) {
    const badge = scene.add.graphics();
    const x = width * 0.5,
      y = height * 0.25;
    badge.fillStyle(0x624329).fillCircle(x, y, 8);
    badge.fillStyle(0xeab54e).fillCircle(x, y, 6);
    badge.lineStyle(1, 0xffedab).strokeCircle(x, y, 4);
    badge.lineStyle(2, 0x9b6b2b).lineBetween(x, y - 3, x, y + 3);
    view.add(badge);
  }
  return view;
}
