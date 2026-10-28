/** Project a sprite's opaque pixels onto the ground from upper-left sunlight. */
export function createBuildingShadow(
  source: CanvasImageSource,
  frame: { x: number; y: number; width: number; height: number },
  contact = 0.9,
) {
  const resolution = 256;
  // Trees and hives meet the bottom edge; isometric buildings use an inset foundation.
  const baseline = resolution * contact;
  const silhouette = document.createElement("canvas");
  silhouette.width = silhouette.height = resolution;
  const mask = silhouette.getContext("2d")!;
  mask.drawImage(
    source,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    0,
    0,
    resolution,
    resolution,
  );
  mask.globalCompositeOperation = "source-in";
  mask.fillStyle = "#233226";
  mask.fillRect(0, 0, resolution, resolution);

  const canvas = document.createElement("canvas");
  canvas.width = resolution * 1.5;
  canvas.height = resolution * 1.25;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = false;
  // Keep the feet fixed. Height becomes distance down and right on the ground,
  // retaining the roof, chimney and windmill outlines of this exact sprite.
  // Sweep from the real sprite to the cast silhouette. A single flattened
  // projection assumes every wall meets the same horizontal baseline, leaving
  // daylight between the shadow and the sloping isometric foundation edges.
  // The sprite itself covers the upright end of this sweep; the exposed ground
  // receives a continuous shadow all the way back to each actual contact edge.
  for (let step = 0; step <= 48; step++) {
    const amount = step / 48;
    context.setTransform(
      1,
      0,
      -0.45 * amount,
      1 - 1.24 * amount,
      baseline * 0.45 * amount,
      baseline * 1.24 * amount,
    );
    context.drawImage(silhouette, 0, 0);
  }
  return canvas;
}
