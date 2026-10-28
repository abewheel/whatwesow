/** Project a sprite's opaque pixels onto the ground from upper-left sunlight. */
export function createBuildingShadow(
  source: CanvasImageSource,
  frame: { x: number; y: number; width: number; height: number },
) {
  const resolution = 256;
  const baseline = resolution * 0.9;
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
  context.setTransform(1, 0, -0.45, -0.24, baseline * 0.45, baseline * 1.24);
  context.drawImage(silhouette, 0, 0);
  return canvas;
}
