export const WORLD_SIZE = 64;
export const WORLD_CELLS = WORLD_SIZE * WORLD_SIZE;
/** Deterministic hash for choices that must look random but replay exactly. */
export const mix = (a: number, b: number) => {
  let x = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77)) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d) >>> 0;
  x ^= x >>> 12;
  return x >>> 0;
};
