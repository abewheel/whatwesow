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
