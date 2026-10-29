import { test, expect } from "./fixtures";
import { readFarm, setFarm, closeActions } from "./context-helpers";

test("every seasonal obstacle contacts its occupied tiles", async ({
  page,
}) => {
  await page.goto("/?instance=validation-debris-contacts");
  const state = await readFarm(page);
  state.plotCells = [];
  state.plotIds = [];
  state.plots = [];
  state.structures = [];
  const kinds = [
    "berries",
    "weeds",
    "stones",
    "log",
    "boulder",
    "rockpile",
    "fallenTree",
  ];
  // Separate objects so a wrong pivot cannot be hidden by another silhouette.
  state.debris = kinds.map((kind, i) => ({ kind, row: 16, col: 12 + i * 5 }));
  for (const season of ["spring", "summer", "fall", "winter"]) {
    state.season = season;
    await setFarm(page, state);
    await closeActions(page);
    const contacts = await page.locator("canvas").evaluate(async (canvas) => {
      const images = JSON.parse(canvas.dataset.sceneDebris!);
      const path = "/src/game/scene.ts";
      const { projectCell } = await import(/* @vite-ignore */ path);
      return Promise.all(
        images.map(
          async (sprite: {
            id: string;
            x: number;
            y: number;
            scale: number;
            flip: boolean;
            atlas: string;
            rect: number[];
          }) => {
            const source = new Image();
            source.src = `/art/${sprite.atlas === "border-details" ? "border-details-seasons" : sprite.atlas}.png`;
            await source.decode();
            const [sx, sy, width, height] = sprite.rect;
            const c = document.createElement("canvas");
            c.width = width;
            c.height = height;
            const ctx = c.getContext("2d")!;
            ctx.drawImage(source, sx, sy, width, height, 0, 0, width, height);
            const pixels = ctx.getImageData(0, 0, width, height).data;
            const [row, col] = sprite.id.split(",").map(Number);
            const anchor = projectCell({ row, col });
            let maxRow = -Infinity,
              maxCol = -Infinity;
            for (let y = 0; y < height; y++)
              for (let x = 0; x < width; x++) {
                if (pixels[(y * width + x) * 4 + 3] < 32) continue;
                const dx =
                  sprite.x +
                  (sprite.flip ? width - x : x) * sprite.scale -
                  anchor.x;
                const dy = sprite.y + y * sprite.scale - anchor.y;
                maxRow = Math.max(maxRow, dy / 32 - dx / 64);
                maxCol = Math.max(maxCol, dy / 32 + dx / 64);
              }
            return { id: sprite.id, maxRow, maxCol };
          },
        ),
      );
    });
    expect(contacts).toHaveLength(8);
    for (const contact of contacts) {
      const i = (Number(contact.id.split(",")[1]) - 12) / 5;
      const dimensions = [
        [1, 1],
        [1, 1],
        [1, 1],
        [2, 1],
        [2, 2],
        [3, 3],
      ];
      const [width, height] =
        dimensions[i] ?? (contact.maxRow > contact.maxCol ? [1, 3] : [3, 1]);
      expect(contact.maxRow).toBeCloseTo(height - 0.58, 4);
      expect(contact.maxCol).toBeCloseTo(width - 0.58, 4);
    }
  }
});
