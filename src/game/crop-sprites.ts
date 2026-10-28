import type { CropId } from "../micro/state";
// Explicit bounds preserve tall leaves and keep neighboring atlas rows out.
export const cropFrames = [
  { x: 128, y: 170, width: 145, height: 112 },
  { x: 460, y: 100, width: 220, height: 190 },
  { x: 805, y: 36, width: 280, height: 256 },
  { x: 1160, y: 8, width: 340, height: 282 },
  { x: 130, y: 475, width: 145, height: 130 },
  { x: 465, y: 378, width: 210, height: 225 },
  { x: 800, y: 313, width: 290, height: 293 },
  { x: 1155, y: 299, width: 350, height: 307 },
  { x: 112, y: 800, width: 165, height: 162 },
  { x: 449, y: 690, width: 245, height: 278 },
  { x: 810, y: 615, width: 280, height: 368 },
  { x: 1180, y: 603, width: 320, height: 382 },
] as const;
export const cropStages: Record<CropId, readonly number[]> = {
  turnip: [0, 3],
  carrot: [4, 6, 7],
  corn: [8, 10, 11],
  radish: [0, 3],
  tomato: [1, 4],
  pumpkin: [2, 5],
};

// The generated sheet has uneven gutters. Keep complete leaves and roots in each frame.
export const seasonalCropFrames = [
  { x: 83, y: 136, width: 250, height: 222 },
  { x: 457, y: 95, width: 304, height: 261 },
  { x: 872, y: 118, width: 329, height: 235 },
  { x: 18, y: 415, width: 393, height: 392 },
  { x: 442, y: 403, width: 361, height: 389 },
  { x: 809, y: 420, width: 436, height: 371 },
] as const;
const seasonalCrops = new Set<CropId>(["radish", "tomato", "pumpkin"]);
/**
 * Drought marks on the crop images: dry crops turn yellow-brown; withered ones dark brown
 * and shrink. A two-tone tint maps the art's light parts to `tint` and its dark parts to
 * `shade`, so green leaves can turn straw-coloured, which a multiply tint cannot do.
 */
export function cropCondition(plot: { dry?: true; withered?: true }): {
  tint?: number;
  shade?: number;
  scale: number;
} {
  if (plot.withered) return { tint: 0x7a4c28, shade: 0x24140a, scale: 0.7 };
  return plot.dry
    ? { tint: 0xffc060, shade: 0x4a3010, scale: 1 }
    : { scale: 1 };
}
export function cropArtwork(crop: CropId, growth: number) {
  const frame = cropStages[crop][growth];
  if (!seasonalCrops.has(crop))
    return { texture: "crop-stages", frame, scale: 0.1 };
  // Match the original plants' size on a plot, independently of source resolution.
  const width = growth === 0 ? 15 : crop === "pumpkin" ? 34 : 31;
  return {
    texture: "seasonal-crops",
    frame,
    scale: width / seasonalCropFrames[frame].width,
  };
}
