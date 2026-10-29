/** Painted cutouts are joined at overlapping joints, never warped as a body. */
const WIDTH = 128;
const HEIGHT = 192;
type Point = { x: number; y: number };
type Rect = readonly [number, number, number, number];

// Native bounds in farmer-rig.png. The generated sheet has uneven row heights.
const torsos: readonly Rect[] = [
  [92, 5, 260, 407],
  [406, 5, 250, 407],
  [718, 10, 240, 397],
  [1020, 10, 231, 397],
];
const sleeve: Rect = [128, 435, 104, 159];
const forearm: Rect = [773, 427, 109, 212];
const thighs: readonly Rect[] = [
  [121, 673, 151, 206],
  [119, 916, 170, 233],
];
const shins: readonly Rect[] = [
  [774, 642, 155, 249],
  [779, 894, 138, 273],
];

/** Both feet follow the same cycle half a turn apart. The stance half travels
 * back at constant speed; the swing half clears the ground and returns ahead. */
export function farmerStep(phase: number) {
  const p = ((phase % 1) + 1) % 1;
  const swing = p >= 0.5;
  const t = swing ? (p - 0.5) * 2 : p * 2;
  return {
    reach: swing ? -16 * Math.cos(t * Math.PI) : 16 - 32 * t,
    lift: swing ? Math.sin(t * Math.PI) * 13 : 0,
  };
}

function knee(hip: Point, ankle: Point): Point {
  const dx = ankle.x - hip.x;
  const dy = ankle.y - hip.y;
  const distance = Math.hypot(dx, dy);
  // Equal bone lengths, bending toward the direction of travel.
  const bend = Math.sqrt(Math.max(0, 40 ** 2 - (distance / 2) ** 2));
  return {
    x: (hip.x + ankle.x) / 2 + (dy / distance) * bend,
    y: (hip.y + ankle.y) / 2 - (dx / distance) * bend,
  };
}

export function createFarmerGait(source: CanvasImageSource, female = false) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * 8;
  canvas.height = HEIGHT * 2;
  const context = canvas.getContext("2d")!;
  const part = (rect: Rect, x: number, y: number, w: number, h: number) =>
    context.drawImage(source, ...rect, x, y, w, h);
  const bone = (rect: Rect, start: Point, end: Point, width: number) => {
    context.save();
    context.translate(start.x, start.y);
    context.rotate(-Math.atan2(end.x - start.x, end.y - start.y));
    // Overlap the rounded ends so bending cannot expose a transparent joint.
    part(
      rect,
      -width / 2,
      -4,
      width,
      Math.hypot(end.x - start.x, end.y - start.y) + 8,
    );
    context.restore();
  };
  for (let back = 0; back < 2; back++) {
    for (let frame = 0; frame < 8; frame++) {
      context.save();
      context.translate(frame * WIDTH, back * HEIGHT);
      const phase = frame / 8;
      const bob = Math.cos(phase * Math.PI * 4) * 1.5;
      const steps = [farmerStep(phase), farmerStep(phase + 0.5)];
      const leg = (side: number) => {
        const { reach, lift } = steps[side];
        const hip = { x: side ? 69 : 56, y: 94 + bob };
        const ankle = {
          x: hip.x + reach,
          y: (side ? 172 : 166) + reach * (back ? -0.28 : 0.28) - lift,
        };
        const joint = knee(hip, ankle);
        bone(thighs[back], hip, joint, female ? 25 : 27);
        bone(shins[back], joint, ankle, female ? 23 : 25);
      };
      const arm = (side: number) => {
        const reach = -steps[side].reach;
        // The torso already includes the shoulder caps. Keep the upper arm
        // beneath them and attach the forearm at the outer sleeve opening.
        const shoulder = { x: side ? 85 : 43, y: 61 + bob };
        const elbow = { x: shoulder.x + reach * 0.12, y: 86 + bob };
        const hand = {
          x: shoulder.x + reach * 0.45,
          y: 126 + bob - Math.abs(reach) * 0.12,
        };
        bone(sleeve, shoulder, elbow, female ? 19 : 21);
        bone(forearm, elbow, hand, female ? 19 : 21);
      };
      leg(0);
      leg(1);
      // Both arms pass beneath the painted sleeve caps. The torso occludes
      // an inward swing, including on the rear view, instead of letting a
      // hand or duplicate sleeve appear across the farmer's back.
      arm(1);
      arm(0);
      part(torsos[(female ? 2 : 0) + back], 33, 5 + bob, 62, 96);
      context.restore();
    }
  }
  return canvas;
}
