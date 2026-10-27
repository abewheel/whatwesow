import Phaser from "phaser";
import type { GameState } from "./state";
const palette = {
  spring: 0x89a96b,
  summer: 0x739956,
  fall: 0xb69a62,
  winter: 0xb9c9c2,
};
export class FarmScene extends Phaser.Scene {
  private ground?: Phaser.GameObjects.Graphics;
  private season: GameState["season"] = "spring";
  constructor() {
    super("farm");
  }
  create() {
    this.ground = this.add.graphics();
    this.draw();
    this.scale.on("resize", this.draw, this);
  }
  setState(state: GameState) {
    this.season = state.season;
    if (this.ground) this.draw();
  }
  private draw() {
    const g = this.ground!;
    g.clear();
    const cx = this.scale.width / 2,
      cy = this.scale.height / 2;
    const tileW = Math.min(68, (this.scale.width - 32) / 8),
      tileH = tileW / 2;
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 7; col++) {
        const x = cx + ((col - row) * tileW) / 2,
          y = cy + ((col + row - 6) * tileH) / 2;
        const points = [
          { x, y: y - tileH / 2 },
          { x: x + tileW / 2, y },
          { x, y: y + tileH / 2 },
          { x: x - tileW / 2, y },
        ];
        const vertices = points.map((p) => new Phaser.Math.Vector2(p.x, p.y));
        g.fillStyle(palette[this.season]);
        g.fillPoints(vertices, true);
        g.lineStyle(1, 0x47634a, 0.4);
        g.strokePoints(vertices, true);
      }
  }
}
