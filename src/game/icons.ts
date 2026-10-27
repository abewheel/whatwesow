/** Atlas cells share the farm buildings' painted material and lighting reference. */
const sprites = {
  turnip: [0, 0],
  carrot: [1, 0],
  corn: [2, 0],
  grow: [3, 0],
  expand: [0, 1],
  improve: [1, 1],
  coin: [2, 1],
  harvest: [3, 1],
  sun: [0, 2],
  spring: [1, 2],
  fall: [2, 2],
  winter: [3, 2],
  menu: [0, 3],
  home: [1, 3],
  build: [2, 3],
  seeds: [3, 3],
} as const;
export type Icon = keyof typeof sprites;
export function icon(name: Icon, className = "") {
  const [col, row] = sprites[name];
  return `<span class="pixel-icon ${className}" aria-hidden="true" style="background-position:${(col * 100) / 3}% ${(row * 100) / 3}%"></span>`;
}
