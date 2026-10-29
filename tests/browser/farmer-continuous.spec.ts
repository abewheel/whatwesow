import { test, expect } from "./fixtures";
import { homesteadState } from "../../src/game/state";
import { walkToCell } from "./context-helpers";

for (const variant of ["male", "female"] as const) {
  test.describe(variant, () => {
    const farm = homesteadState();
    farm.farmerVariant = variant;
    farm.plotCells = [
      { row: 20, col: 20 },
      { row: 20, col: 24 },
      { row: 24, col: 24 },
      { row: 24, col: 20 },
    ];
    farm.plots = farm.plotCells.map(() => null);
    farm.plotIds = [1, 2, 3, 4];
    farm.nextPlotId = 5;
    farm.seeds.turnip = 10;
    test.use({ farmState: farm, deviceScaleFactor: 2 });
    test("arrival and work keep the nearest stance and visible direction", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("requestfailed", (r) => errors.push(r.url()));
      await page.goto(`/?instance=validation-motion-${variant}`);
      await expect(page.locator("main")).toHaveJSProperty("inert", false);
      const canvas = page.locator("canvas");
      const cases = [
        ["20,19", "20,20", "front-right"],
        ["19,24", "20,24", "front-left"],
        ["24,25", "24,24", "back-left"],
        ["25,20", "24,20", "back-right"],
      ];
      for (let i = 0; i < cases.length; i++) {
        const [stance, , facing] = cases[i];
        await walkToCell(page, stance);
        await page.keyboard.press("Escape");
        await page.locator(`[data-plot="${i}"]`).press("Enter");
        await expect(page.locator("#service-panel")).toBeVisible();
        await expect(canvas).toHaveAttribute("data-farmer-cell", stance);
        await expect(canvas).toHaveAttribute("data-farmer-facing", facing);
        await expect(canvas).toHaveAttribute(
          "data-farmer-frame",
          new RegExp(`-walk:${facing.startsWith("back") ? 5 : 1}$`),
        );
        if (process.env.MOTION_SCREENSHOTS_DIR)
          await page.screenshot({
            path: `${process.env.MOTION_SCREENSHOTS_DIR}/${variant}-${facing}-idle.png`,
          });
        await page.locator('[data-crop="turnip"]').click();
        await expect(canvas).toHaveAttribute("data-farmer-motion", "plant");
        await expect(canvas).toHaveAttribute("data-farmer-cell", stance);
        await expect(canvas).toHaveAttribute("data-farmer-facing", facing);
        if (facing.startsWith("back"))
          await expect(canvas).toHaveAttribute(
            "data-farmer-frame",
            /-rear-work:/,
          );
        if (process.env.MOTION_SCREENSHOTS_DIR) {
          await page.waitForFunction(() =>
            /:(2|3|14|15)$/.test(
              document.querySelector("canvas")!.dataset.farmerFrame ?? "",
            ),
          );
          const area = await canvas.boundingBox();
          const bounds = JSON.parse(
            (await canvas.getAttribute("data-farmer-bounds"))!,
          );
          await page.screenshot({
            path: `${process.env.MOTION_SCREENSHOTS_DIR}/${variant}-${facing}-work.png`,
            clip: {
              x: Math.max(0, area!.x + bounds.x - 90),
              y: Math.max(0, area!.y + bounds.y - 60),
              width: 250,
              height: 250,
            },
          });
        }
        await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
      }
      expect(errors).toEqual([]);
    });
    test("held movement crosses boundaries without idle and retains facing after release", async ({
      page,
    }) => {
      await page.goto(`/?instance=validation-hold-${variant}`);
      await expect(page.locator("main")).toHaveJSProperty("inert", false);
      await walkToCell(page, "30,30");
      await page.keyboard.press("Escape");
      await page.locator("#farm").focus();
      await page.keyboard.down("w");
      await page.evaluate(async () => {
        const samples: string[] = [];
        await new Promise<void>((resolve) => {
          const observe = () => {
            const d = document.querySelector("canvas")!.dataset;
            samples.push(d.farmerMotion ?? "");
            if (Number(d.farmerCell!.split(",")[0]) <= 26) resolve();
            else requestAnimationFrame(observe);
          };
          requestAnimationFrame(observe);
        });
        if (samples.some((v) => v !== "walk"))
          throw new Error("Held walk paused at a tile boundary");
      });
      await page.keyboard.up("w");
      const canvas = page.locator("canvas");
      await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
      await expect(canvas).toHaveAttribute("data-farmer-facing", "back-right");
      await expect(canvas).toHaveAttribute("data-farmer-frame", /-walk:5$/);
      const cell = (await canvas.getAttribute("data-farmer-cell"))!;
      await page.keyboard.press("e");
      await expect(page.locator("#service-panel")).toBeVisible();
      const [row, col] = cell.split(",").map(Number);
      await expect(
        page.locator(`[data-cell="${row - 1},${col}"]`),
      ).toHaveAttribute("data-context", "true");
      await page.keyboard.press("Escape");
      await page.locator("#farm").focus();
      await page.keyboard.down("w");
      await expect(canvas).toHaveAttribute("data-farmer-motion", "walk");
      await page.keyboard.press("i");
      await expect(page.locator("#service-title")).toHaveText("Inventory");
      await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
      const stopped = await canvas.getAttribute("data-farmer-cell");
      await page.keyboard.down("w"); // A repeat from the still-held physical key.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await expect(page.locator("#service-title")).toHaveText("Inventory");
      await expect(canvas).toHaveAttribute("data-farmer-cell", stopped!);
      await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
      await page.keyboard.up("w");
    });
  });
}

test("rear work atlases keep all sixty complete poses inside their frames", async ({
  page,
}) => {
  await page.goto("/?instance=validation-rear-atlas");
  const bounds = await page.evaluate(async () =>
    Promise.all(
      ["farmer", "farmer-female"].map(async (key) => {
        const image = new Image();
        image.src = `/art/${key}-rear-work.png`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return Array.from({ length: 30 }, (_, frame) => {
          const pixels = context.getImageData(
            (frame % 6) * 240,
            Math.floor(frame / 6) * 210,
            240,
            210,
          ).data;
          let left = 240,
            right = -1,
            top = 210,
            bottom = -1,
            count = 0;
          for (let y = 0; y < 210; y++)
            for (let x = 0; x < 240; x++)
              if (pixels[(y * 240 + x) * 4 + 3] > 10) {
                left = Math.min(left, x);
                right = Math.max(right, x);
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
                count++;
              }
          return { key, frame, left, right, top, bottom, count };
        });
      }),
    ),
  );
  for (const frame of bounds.flat()) {
    expect(frame.count, `${frame.key}:${frame.frame}`).toBeGreaterThan(3000);
    expect(frame.left).toBeGreaterThan(1);
    expect(frame.top).toBeGreaterThan(1);
    expect(frame.right).toBeLessThan(238);
    expect(frame.bottom).toBeLessThan(208);
  }
});
