const WIDTH = 128;
const HEIGHT = 192;
const ramp = (value: number, start: number, end: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

/** Deform complete painted poses with one continuous field. Keeping pixels
 * connected avoids the cut shoulders and duplicated boots of separate masks. */
export function createFarmerGait(source: CanvasImageSource, female = false) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * 8;
  canvas.height = HEIGHT * 2;
  const context = canvas.getContext("2d")!;
  const pose = document.createElement("canvas");
  pose.width = WIDTH;
  pose.height = HEIGHT;
  const p = pose.getContext("2d")!;
  const neutral = document.createElement("canvas");
  neutral.width = WIDTH;
  neutral.height = HEIGHT;
  const n = neutral.getContext("2d")!;
  n.drawImage(
    source,
    ...((female
      ? [43, 1259, 123, 189, 10, 0, 110, 178]
      : [60, 1260, 84, 178, 22, 0, 84, 178]) as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ]),
  );
  const neutralPixels = n.getImageData(0, 0, WIDTH, HEIGHT);
  // The neutral pose's hands overlap the outer trouser edge. Restore that
  // hidden denim along a smooth hip contour before blending the rear torso.
  for (let y = 101; y < (female ? 132 : 140); y++) {
    const left = 47 - (y - 101) * 0.2;
    const right = (female ? 85 : 90) - (y - 101) * 0.03;
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4;
      if (x < left || x > right) {
        neutralPixels.data[i + 3] = 0;
        continue;
      }
      const warm =
        neutralPixels.data[i] > neutralPixels.data[i + 1] * 1.15 &&
        neutralPixels.data[i] > neutralPixels.data[i + 2] * 1.3;
      if (
        (warm ||
          neutralPixels.data[i + 3] < 150 ||
          x < left + 2 ||
          x > right - 2) &&
        (x < left + 5 || x > right - 4)
      ) {
        const donorX = x < 66 ? Math.ceil(left + 10) : Math.floor(right - 10);
        const donor = (y * WIDTH + donorX) * 4;
        neutralPixels.data.set(neutralPixels.data.slice(donor, donor + 4), i);
        if (x < left + 1 || x > right - 1)
          for (let channel = 0; channel < 3; channel++)
            neutralPixels.data[i + channel] *= 0.7;
      }
    }
  }
  for (let y = 0; y < 101; y++)
    for (let x = 0; x < WIDTH; x++)
      neutralPixels.data[(y * WIDTH + x) * 4 + 3] = 0;
  n.putImageData(neutralPixels, 0, 0);
  for (let back = 0; back < 2; back++) {
    p.clearRect(0, 0, WIDTH, HEIGHT);
    // Rear art is a genuine rear view, including the hat, hair and overalls.
    const rectangle = back
      ? female
        ? [60, 177, 121, 180, 10, 0, 110, 178]
        : [71, 182, 99, 171, 15, 0, 99, 178]
      : female
        ? [43, 1259, 123, 189, 10, 0, 110, 178]
        : [60, 1260, 84, 178, 22, 0, 84, 178];
    p.drawImage(
      source,
      ...(rectangle as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ]),
    );
    if (back) {
      const rear = p.getImageData(0, 0, WIDTH, HEIGHT);
      // Preserve complete hands and their outlines while softly blending the
      // matching denim around the waist, rather than cutting at a fixed row.
      const hands = new Uint8Array(WIDTH * HEIGHT);
      for (let y = 85; y < 129; y++)
        for (let x = 0; x < WIDTH; x++) {
          const i = (y * WIDTH + x) * 4;
          if (
            (x < 39 || (x > 98 && y < 116)) &&
            rear.data[i + 3] > 80 &&
            rear.data[i] > rear.data[i + 1] * 1.2 &&
            rear.data[i] > rear.data[i + 2] * 1.4
          ) {
            for (let dy = -2; dy <= 2; dy++)
              for (let dx = -2; dx <= 2; dx++)
                if (x + dx >= 0 && x + dx < WIDTH)
                  hands[(y + dy) * WIDTH + x + dx] = 1;
          }
        }
      for (let y = 98; y < HEIGHT; y++)
        for (let x = 0; x < WIDTH; x++) {
          if (!hands[y * WIDTH + x]) {
            const i = (y * WIDTH + x) * 4;
            const outline = neutralPixels.data[i + 3] / 255;
            rear.data[i + 3] *=
              (1 - ramp(y, 99, 119)) * (1 - ramp(y, 100, 111) * (1 - outline));
          }
        }
      p.clearRect(0, 0, WIDTH, HEIGHT);
      p.drawImage(neutral, 0, 0);
      const upper = document.createElement("canvas");
      upper.width = WIDTH;
      upper.height = HEIGHT;
      upper.getContext("2d")!.putImageData(rear, 0, 0);
      p.drawImage(upper, 0, 0);
    }
    const pixels = p.getImageData(0, 0, WIDTH, HEIGHT).data;
    for (let frame = 0; frame < 8; frame++) {
      const phase = (frame / 8) * Math.PI * 2;
      const swing = Math.sin(phase);
      const bob = -Math.abs(Math.cos(phase)) * 3;
      const sway = Math.cos(phase) * 2.3;
      const displacement = (x: number, y: number) => {
        // The legs move from the hip, while the hands counter-swing from the
        // shoulders. Smooth ramps preserve every join and the shirt silhouette.
        const legs = ramp(y, 110, 176);
        const side = Math.tanh((x - 66) / 18);
        const arms = ramp(y, 70, 105) * (1 - ramp(y, 126, 144));
        const leftArm = 1 - ramp(x, 34, 54);
        const rightArm = ramp(x, 84, 104);
        const arm = rightArm - leftArm;
        return {
          x:
            sway +
            (110 - y) * swing * 0.025 +
            swing * side * legs * 8 -
            swing * arm * arms * 5 +
            swing * (1 - legs) * ramp(y, 35, 100) * 1.2,
          y:
            bob -
            (back
              ? Math.max(0, swing * side) * 13 - side * 2
              : Math.max(0, swing * side) * 7) *
              legs +
            swing * arm * arms * 2,
        };
      };
      const output = context.createImageData(WIDTH, HEIGHT);
      for (let y = 0; y < HEIGHT; y++)
        for (let x = 0; x < WIDTH; x++) {
          // Inverse sampling keeps the warped silhouette solid, without holes
          // from rounding forward-mapped pixels or seams from clipped triangles.
          let sx = x,
            sy = y;
          for (let iteration = 0; iteration < 10; iteration++) {
            const offset = displacement(sx, sy);
            sx = x - offset.x;
            sy = y - offset.y;
          }
          const ix = Math.floor(sx),
            iy = Math.floor(sy);
          const fx = sx - ix,
            fy = sy - iy;
          const target = (y * WIDTH + x) * 4;
          let alpha = 0;
          const color = [0, 0, 0];
          for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++) {
              const px = ix + dx,
                py = iy + dy;
              if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) continue;
              const sourceIndex = (py * WIDTH + px) * 4;
              const weight =
                (dx ? fx : 1 - fx) *
                (dy ? fy : 1 - fy) *
                pixels[sourceIndex + 3];
              alpha += weight;
              for (let channel = 0; channel < 3; channel++)
                color[channel] += pixels[sourceIndex + channel] * weight;
            }
          if (!alpha) continue;
          for (let channel = 0; channel < 3; channel++)
            output.data[target + channel] = color[channel] / alpha;
          output.data[target + 3] = alpha;
        }
      context.putImageData(output, frame * WIDTH, back * HEIGHT);
    }
  }
  return canvas;
}
