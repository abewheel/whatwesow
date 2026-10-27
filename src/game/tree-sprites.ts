import { treeMaturity, type Structure } from "../micro/world";
import type { MacroState } from "../macro/state";

type Bounds = readonly [number, number, number, number];
// Measured bounds isolate every complete tree, including winter branches.
export const treeFrames: Record<"apple" | "oak", readonly Bounds[]> = {
  apple: [
    [124, 222, 170, 223],
    [405, 115, 305, 329],
    [752, 13, 440, 430],
    [125, 646, 169, 220],
    [400, 530, 310, 334],
    [752, 446, 442, 418],
    [125, 1011, 163, 215],
    [401, 905, 307, 319],
    [764, 867, 434, 357],
  ],
  oak: [
    [109, 238, 169, 178],
    [412, 104, 284, 316],
    [733, 18, 485, 405],
    [109, 642, 178, 182],
    [405, 507, 292, 320],
    [733, 428, 489, 402],
    [117, 1006, 156, 210],
    [399, 896, 300, 323],
    [737, 835, 476, 389],
  ],
};
export const productFrames = {
  apple: [182, 179, 553, 670],
  oak: [905, 172, 501, 684],
} as const;
export const productPositions = {
  apple: [
    [-22, -49],
    [-6, -62],
    [13, -50],
    [24, -35],
    [-13, -30],
    [5, -39],
  ],
  oak: [
    [-25, -45],
    [-10, -56],
    [12, -48],
    [27, -34],
    [-9, -31],
    [7, -37],
  ],
} as const;
export function treeStage(tree: Structure) {
  const progress = (tree.age ?? 0) / treeMaturity(tree.kind);
  return progress < 0.25 ? 0 : progress < 1 ? 1 : 2;
}
export function treeFrame(tree: Structure, season: MacroState["season"]) {
  const row = season === "winter" ? 2 : season === "fall" ? 1 : 0;
  return row * 3 + treeStage(tree);
}
