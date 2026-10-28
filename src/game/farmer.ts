import Phaser from "phaser";
import {
  farmerBlocked,
  farmerSpawn,
  farmerWorkRoute,
  farmerWalkRoute,
  type FarmerWorld,
} from "./farmer-route";
import { cellKey, type Cell, type Layout } from "../micro/world";
import type { FarmPolicy } from "../contracts/farm-policy";
import type { FarmerTask } from "./farmer-task";

// Measured rectangles preserve each complete pose without adjacent frame bleed.
export const farmerFrames = [
  [
    [74, 6, 175, 170],
    [244, 9, 349, 174],
    [429, 5, 517, 174],
    [590, 5, 687, 173],
    [758, 5, 860, 173],
    [928, 5, 1030, 175],
  ],
  [
    [71, 182, 170, 353],
    [248, 183, 353, 354],
    [423, 181, 519, 355],
    [590, 180, 690, 354],
    [765, 182, 866, 354],
    [941, 183, 1035, 355],
  ],
  [
    [65, 361, 151, 534],
    [238, 395, 353, 529],
    [420, 394, 532, 528],
    [590, 362, 730, 529],
    [776, 363, 874, 535],
    [951, 362, 1031, 534],
  ],
  [
    [59, 537, 158, 722],
    [237, 537, 370, 717],
    [414, 546, 550, 726],
    [595, 540, 742, 726],
    [771, 552, 893, 721],
    [940, 538, 1033, 718],
  ],
  [
    [54, 759, 166, 894],
    [238, 764, 369, 894],
    [415, 730, 547, 900],
    [590, 729, 712, 909],
    [768, 739, 883, 896],
    [949, 728, 1048, 905],
  ],
  [
    [47, 908, 178, 1083],
    [221, 917, 365, 1087],
    [413, 922, 556, 1088],
    [587, 917, 723, 1066],
    [759, 916, 900, 1084],
    [954, 910, 1038, 1088],
  ],
  [
    [59, 1089, 154, 1256],
    [239, 1090, 343, 1256],
    [419, 1091, 516, 1257],
    [587, 1091, 688, 1257],
    [767, 1092, 865, 1257],
    [946, 1092, 1042, 1258],
  ],
  [
    [60, 1260, 144, 1438],
    [244, 1264, 323, 1439],
    [421, 1261, 497, 1437],
    [591, 1262, 673, 1437],
    [772, 1262, 851, 1438],
    [951, 1265, 1030, 1438],
  ],
];

// Contact points in the original 181px grid, separate from tools and loose soil.
// Keeping feet anchored prevents the generated poses from sliding between cells.
const contacts = [
  [
    [110, 151],
    [110, 153],
    [104, 152],
    [104, 151],
    [103, 152],
    [103, 151],
  ],
  [
    [109, 165],
    [109, 165],
    [105, 165],
    [105, 165],
    [104, 165],
    [105, 165],
  ],
  [
    [105, 165],
    [83, 160],
    [83, 160],
    [84, 164],
    [104, 165],
    [103, 165],
  ],
  [
    [103, 170],
    [92, 169],
    [91, 169],
    [91, 169],
    [91, 167],
    [102, 170],
  ],
  [
    [91, 163],
    [84, 164],
    [91, 165],
    [91, 165],
    [91, 165],
    [102, 165],
  ],
  [
    [91, 165],
    [91, 165],
    [91, 165],
    [91, 165],
    [91, 165],
    [102, 165],
  ],
  [
    [100, 158],
    [100, 158],
    [100, 158],
    [100, 158],
    [100, 158],
    [100, 158],
  ],
  [
    [103, 166],
    [103, 166],
    [103, 166],
    [103, 166],
    [103, 166],
    [103, 166],
  ],
];

/** Transient movement and effects. Arrival hands interactions back to the app. */
export class Farmer {
  readonly view: Phaser.GameObjects.Container;
  private art: Phaser.GameObjects.Sprite;
  private effect: Phaser.GameObjects.Graphics;
  private world: FarmerWorld = { layout: { plotCells: [], structures: [] } };
  private layoutKey = "";
  private cell: Cell = { col: 14, row: 14 };
  private position = { ...this.cell };
  private tasks: FarmerTask[] = [];
  private route: Cell[] = [];
  private active?: FarmerTask;
  private arrival?: () => void;
  private elapsed = 0;
  private clock = 0;
  private stride = 0;
  private facing = 1;
  private back = false;
  constructor(scene: Phaser.Scene) {
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x233226, 0.08).fillEllipse(2, 2, 29, 13);
    shadow.fillStyle(0x233226, 0.13).fillEllipse(1, 1, 23, 10);
    shadow.fillStyle(0x18251c, 0.16).fillEllipse(0, 1, 14, 6);
    this.effect = scene.add.graphics();
    this.art = scene.add.sprite(0, 0, "farmer", 42).setDisplaySize(58, 58);
    this.art.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.view = scene.add.container(0, 0, [shadow, this.effect, this.art]);
    this.view.setName("farmer");
  }
  setWorld(layout: Layout, policy?: FarmPolicy) {
    this.world = { layout, policy };
    const signature = JSON.stringify([
      layout.plotCells.map((c) => [c.row, c.col]),
      layout.structures.map((s) => [s.id, s.kind, s.row, s.col]),
      policy?.land?.map((r) => [r.row, r.col, r.width, r.height]),
    ]);
    if (signature !== this.layoutKey) {
      this.layoutKey = signature;
      // Relocation invalidates queued destinations; never work an old plot position.
      this.tasks = [];
      this.route = [];
      this.active = undefined;
      this.arrival = undefined;
      this.position = { ...this.cell };
    }
    if (farmerBlocked(this.cell, this.world) || !this.view.visible)
      this.reset();
  }
  enqueue(task: FarmerTask) {
    if (this.tasks.length >= 12) this.tasks.shift();
    this.tasks.push(task);
  }
  travel(
    target: Cell,
    width = 1,
    height = 1,
    adjacent = false,
    preference: "rear" | "front" = "front",
    onArrival?: () => void,
  ): boolean {
    this.arrival = undefined;
    const plan = adjacent
      ? farmerWorkRoute(
          this.cell,
          target,
          this.world,
          width,
          height,
          preference,
        )
      : farmerWalkRoute(this.cell, target, this.world);
    if (!plan || !this.view.visible) return false;
    this.tasks = [];
    this.arrival = onArrival;
    this.active = {
      target: plan.target,
      action: adjacent ? "visit" : "walk",
      width,
      height,
    };
    // Finish returning along the current edge before following a replacement route.
    this.route =
      Math.hypot(
        this.position.col - this.cell.col,
        this.position.row - this.cell.row,
      ) > 0.001
        ? [{ ...this.cell }, ...plan.route]
        : plan.route;
    this.elapsed = 0;
    return true;
  }
  reset() {
    this.tasks = [];
    this.route = [];
    this.active = undefined;
    this.elapsed = 0;
    this.arrival = undefined;
    const spawn = farmerSpawn(this.world);
    this.view.setVisible(Boolean(spawn));
    if (spawn) this.cell = spawn;
    this.position = { ...this.cell };
  }
  update(delta: number, project: (cell: Cell) => { x: number; y: number }) {
    if (!this.view.visible) return;
    const dt = Math.min(delta, 100) / 1000;
    this.clock += dt;
    let arrived: (() => void) | undefined;
    if (!this.active && this.tasks.length) {
      const task = this.tasks.shift()!;
      const plan = farmerWorkRoute(
        this.cell,
        task.target,
        this.world,
        task.width,
        task.height,
      );
      if (plan) {
        this.active = { ...task, target: plan.target };
        this.route = plan.route;
        this.elapsed = 0;
      }
    }
    const walking = this.route.length > 0;
    let remaining = (this.tasks.length > 3 ? 9 : 5) * dt;
    while (this.route.length && remaining > 0) {
      const next = this.route[0];
      const dc = next.col - this.position.col,
        dr = next.row - this.position.row;
      const distance = Math.hypot(dc, dr);
      const speed = Math.min(distance, remaining);
      remaining -= speed;
      this.stride += speed * 5;
      this.facing = dc - dr >= 0 ? 1 : -1;
      this.back = dc + dr < 0;
      if (distance <= speed) {
        this.position = { ...next };
        this.cell = next;
        this.route.shift();
      } else {
        this.position.col += (dc / distance) * speed;
        this.position.row += (dr / distance) * speed;
      }
    }
    if (
      !walking &&
      this.active &&
      (this.active.action === "walk" || this.active.action === "visit")
    ) {
      this.active = undefined;
      arrived = this.arrival;
      this.arrival = undefined;
    } else if (!walking && this.active) {
      const target = this.active.target;
      const point = project(target),
        feet = project(this.cell);
      this.facing = point.x >= feet.x ? 1 : -1;
      this.elapsed += dt;
      if (this.elapsed >= 1.15) this.active = undefined;
    }
    const point = project(this.position);
    this.view.setPosition(point.x, point.y).setDepth(point.y);
    this.paint(walking, project);
    // Readable development evidence without exposing a global game reference.
    if (import.meta.env.DEV) {
      const canvas = this.view.scene.game.canvas;
      canvas.dataset.farmerScaleY = String(this.art.scaleY);
      canvas.dataset.farmerFrame = `${this.art.texture.key}:${this.art.frame.name}`;
      canvas.dataset.farmerCell = cellKey(this.cell);
      canvas.dataset.farmerTarget = this.active
        ? cellKey(this.active.target)
        : "";
      canvas.dataset.farmerMotion = walking
        ? "walk"
        : (this.active?.action ?? "idle");
    }
    arrived?.();
  }
  private paint(
    walking: boolean,
    project: (cell: Cell) => { x: number; y: number },
  ) {
    const action = !walking ? this.active?.action : undefined;
    const row = walking
      ? this.back
        ? 1
        : 0
      : action === "plant"
        ? 2
        : action === "grow"
          ? 3
          : action === "harvest" || action === "harvestTree"
            ? 4
            : action === "work"
              ? 6
              : action
                ? 5
                : 7;
    const frame = action
      ? Math.min(5, Math.floor((this.elapsed / 1.15) * 6))
      : 0;
    const walkFrame = Math.floor(this.stride) % 6;
    const pose = walking ? walkFrame : frame;
    const [cx, originalCy] = contacts[row][pose];
    const [left, top, right, bottom] = farmerFrames[row][pose];
    const width = right - left;
    const height = bottom - top;
    const contactX = walking || !action ? (left + right) / 2 : cx + pose * 181;
    const cy = walking ? height - 8 : originalCy + row * 181 - top;
    this.art
      .setTexture("farmer", row * 6 + pose)
      // One stable idle drawing breathes continuously, with its boots fixed at the origin.
      .setScale(
        58 / 181,
        (58 / 181) *
          (!walking &&
          !action &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 1 + Math.sin((this.clock * Math.PI * 2) / 3.6) * 0.008
            : 1),
      )
      .setOrigin(
        this.facing < 0
          ? 1 - (contactX - left) / width
          : (contactX - left) / width,
        cy / height,
      )
      .setFlipX(this.facing < 0);
    this.effect.clear();
    const navigating =
      this.active?.action === "walk" || this.active?.action === "visit";
    if ((!action && !navigating) || !this.active) return;
    const target = project(this.active.target);
    const x = target.x - this.view.x,
      y = target.y - this.view.y;
    const g = this.effect;
    // The outline identifies the exact adjacent square receiving the work.
    g.lineStyle(1, 0xf3d78d, 0.65);
    g.strokePoints(
      [
        { x, y: y - 14 },
        { x: x + 28, y },
        { x, y: y + 14 },
        { x: x - 28, y },
      ].map((p) => new Phaser.Math.Vector2(p.x, p.y)),
      true,
    );
    if (navigating) return;
    const progress = this.elapsed / 1.15;
    if (progress < 0.2 || progress > 0.9) return;
    for (let i = 0; i < 7; i++) {
      const t = (progress * 2 + i / 7) % 1;
      if (action === "grow") {
        g.fillStyle(i % 2 ? 0xb5e6e7 : 0x73b5cf, 0.85);
        g.fillEllipse(
          x * (0.45 + t * 0.55) + ((i % 3) - 1) * 3,
          -15 * (1 - t) + y * t,
          2,
          4,
        );
      } else {
        g.fillStyle(
          action === "plant"
            ? 0xf0d48d
            : action === "harvest" || action === "harvestTree"
              ? 0x83a657
              : 0x9a7048,
          0.85,
        );
        g.fillRect(
          x + ((i % 3) - 1) * 5,
          y - 3 - Math.sin(t * Math.PI) * 6,
          2,
          2,
        );
      }
    }
  }
}
