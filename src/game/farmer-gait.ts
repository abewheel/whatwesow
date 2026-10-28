/** Build an alternating gait from the neutral pose, rather than cycling the
 * source sheet's six near-identical raised-boot drawings. */
export function createFarmerGait(source: CanvasImageSource, female = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 128 * 8;
  canvas.height = 192;
  const context = canvas.getContext("2d")!;
  const pose = document.createElement("canvas");
  pose.width = 128;
  pose.height = 192;
  if (female) {
    // Normalize her neutral pose to the shared hip and boot anchors before animating.
    pose
      .getContext("2d")!
      .drawImage(source, 43, 1259, 123, 189, 10, 0, 110, 178);
  } else {
    pose.getContext("2d")!.drawImage(source, 60, 1260, 84, 178, 22, 0, 84, 178);
  }
  const leg = (right: boolean, angle: number, lift: number) => {
    context.save();
    const hip = right ? 75 : 55;
    context.translate(hip, 107 - lift);
    context.rotate(angle);
    context.translate(-hip, -107);
    context.beginPath();
    const points = right
      ? [
          [64, 105],
          [110, 105],
          [110, 164],
          [65, 164],
          [59, 148],
          [65, 129],
        ]
      : [
          [18, 105],
          [64, 105],
          [65, 129],
          [59, 148],
          [65, 164],
          [110, 164],
          [110, 184],
          [10, 184],
        ];
    points.forEach(([x, y], i) =>
      i ? context.lineTo(x, y) : context.moveTo(x, y),
    );
    context.closePath();
    context.clip();
    context.drawImage(pose, 0, 0);
    context.restore();
  };
  for (let frame = 0; frame < 8; frame++) {
    context.save();
    context.translate(frame * 128, 0);
    const phase = (frame / 8) * Math.PI * 2;
    const swing = Math.sin(phase);
    // Boots trade contact with the ground; the passing foot lifts slightly.
    leg(swing > 0, -Math.abs(swing) * 0.18, Math.abs(swing) * 3);
    leg(swing <= 0, Math.abs(swing) * 0.18, 0);
    // Keep the torso intact over the hip joins and give the stride a small bob.
    context.drawImage(pose, 0, 0, 128, 116, 0, -Math.abs(swing), 128, 116);
    context.restore();
  }
  // The source includes tiny detached ground marks. They must stay on the
  // ground rather than rotate with a boot, so retain the connected character.
  for (let frame = 0; frame < 8; frame++) {
    const pixels = context.getImageData(frame * 128, 0, 128, 192);
    const seen = new Uint8Array(128 * 192);
    let largest: number[] = [];
    for (let start = 0; start < seen.length; start++) {
      if (seen[start] || pixels.data[start * 4 + 3] < 24) continue;
      const component = [start];
      seen[start] = 1;
      for (let i = 0; i < component.length; i++) {
        const pixel = component[i];
        const x = pixel % 128;
        const y = Math.floor(pixel / 128);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (x + dx < 0 || x + dx >= 128 || y + dy < 0 || y + dy >= 192)
              continue;
            const next = pixel + dy * 128 + dx;
            if (seen[next] || pixels.data[next * 4 + 3] < 24) continue;
            seen[next] = 1;
            component.push(next);
          }
      }
      if (component.length > largest.length) largest = component;
    }
    seen.fill(0);
    for (const pixel of largest) seen[pixel] = 1;
    for (let pixel = 0; pixel < seen.length; pixel++)
      if (!seen[pixel]) pixels.data[pixel * 4 + 3] = 0;
    context.putImageData(pixels, frame * 128, 0);
  }
  return canvas;
}
