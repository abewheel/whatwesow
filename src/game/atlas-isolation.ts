type Rect = { x: number; y: number; width: number; height: number };

/** Generated sheets have uneven gutters. Keep each silhouette in its own frame. */
export function isolateAtlas(
  source: HTMLImageElement | HTMLCanvasElement,
  frames: Rect[],
) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d")!;
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height, data } = pixels;
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const groups = frames.map(() => [] as number[]);
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * 4 + 3] < 32) continue;
    let count = 1;
    queue[0] = start;
    seen[start] = 1;
    const overlaps = frames.map(() => 0);
    for (let head = 0; head < count; head++) {
      const pixel = queue[head];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      frames.forEach((frame, i) => {
        if (
          x >= frame.x &&
          x < frame.x + frame.width &&
          y >= frame.y &&
          y < frame.y + frame.height
        )
          overlaps[i]++;
      });
      for (const next of [
        x ? pixel - 1 : -1,
        x + 1 < width ? pixel + 1 : -1,
        pixel - width,
        pixel + width,
      ]) {
        if (
          next < 0 ||
          next >= seen.length ||
          seen[next] ||
          data[next * 4 + 3] < 32
        )
          continue;
        seen[next] = 1;
        queue[count++] = next;
      }
    }
    // Tiny detached flecks belong to the cell containing them. Larger connected
    // silhouettes may cross a gutter, so assign the whole object by overlap.
    const overlap = Math.max(...overlaps);
    if (!overlap) continue;
    const owner = overlaps.indexOf(overlap);
    for (let i = 0; i < count; i++) groups[owner].push(queue[i]);
  }
  context.clearRect(0, 0, width, height);
  const isolated = document.createElement("canvas");
  isolated.width = width;
  isolated.height = height;
  const mask = isolated.getContext("2d")!;
  context.imageSmoothingEnabled = false;
  groups.forEach((group, index) => {
    if (!group.length) return;
    const image = mask.createImageData(width, height);
    let left = width,
      top = height,
      right = 0,
      bottom = 0;
    for (const pixel of group) {
      const x = pixel % width,
        y = Math.floor(pixel / width);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
      image.data.set(data.subarray(pixel * 4, pixel * 4 + 4), pixel * 4);
    }
    mask.putImageData(image, 0, 0);
    const frame = frames[index];
    const scale = Math.min(
      1,
      (frame.width - 4) / (right - left),
      (frame.height - 4) / (bottom - top),
    );
    const w = (right - left) * scale,
      h = (bottom - top) * scale;
    const x = Math.max(
      frame.x + 2,
      Math.min(left, frame.x + frame.width - w - 2),
    );
    const y = Math.max(
      frame.y + 2,
      Math.min(top, frame.y + frame.height - h - 2),
    );
    context.drawImage(
      isolated,
      left,
      top,
      right - left,
      bottom - top,
      x,
      y,
      w,
      h,
    );
  });
  return canvas;
}

export function gridFrames(
  width: number,
  height: number,
  columns: number,
  rows: number,
): Rect[] {
  return Array.from({ length: columns * rows }, (_, i) => {
    const x = Math.round(((i % columns) * width) / columns);
    const y = Math.round((Math.floor(i / columns) * height) / rows);
    return {
      x,
      y,
      width: Math.round((((i % columns) + 1) * width) / columns) - x,
      height: Math.round(((Math.floor(i / columns) + 1) * height) / rows) - y,
    };
  });
}
