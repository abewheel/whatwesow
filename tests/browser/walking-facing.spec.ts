import { openCanvasHarness } from "./canvas-harness";
import { test, expect } from "./fixtures";

for (const variant of ["male", "female"] as const) {
  test(`${variant} walks with coherent front and rear poses in all four directions`, async ({
    page,
  }) => {
    await page.goto(`/?instance=validation-facing-${variant}`);
    await expect(page.locator("main")).toHaveJSProperty("inert", false);
    if (variant === "female") {
      await page.getByLabel("Work on").selectOption("full");
      const editor = page.getByLabel("Game state JSON");
      const state = JSON.parse(await editor.inputValue());
      state.farmerVariant = variant;
      await editor.fill(JSON.stringify(state));
      await page
        .getByRole("button", { name: "Apply state", exact: true })
        .click();
      await expect(page.locator("#dev-status")).toHaveText(
        "State applied and saved.",
      );
    }
    const canvas = page.locator("canvas");
    await page.locator('[data-cell="20,20"]').press("Enter");
    await expect(canvas).toHaveAttribute("data-farmer-cell", "20,20");
    await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
    for (const [cell, facing] of [
      ["20,24", "front-right"],
      ["24,24", "front-left"],
      ["24,20", "back-left"],
      ["20,20", "back-right"],
    ]) {
      await page.keyboard.press("Escape");
      await page.locator(`[data-cell="${cell}"]`).press("Enter");
      // Observe the transient pose atomically before arrival can replace it.
      await page.waitForFunction(
        ({ facing, prefix }) => {
          const data = document.querySelector("canvas")!.dataset;
          const frame = Number(data.farmerFrame?.split(":")[1]);
          return (
            data.farmerMotion === "walk" &&
            data.farmerFacing === facing &&
            data.farmerFrame?.startsWith(prefix) &&
            (facing.startsWith("back")
              ? frame >= 4 && frame <= 7
              : frame >= 0 && frame <= 3)
          );
        },
        {
          facing,
          prefix: `farmer${variant === "female" ? "-female" : ""}-walk:`,
        },
      );
      await expect(canvas).toHaveAttribute("data-farmer-cell", cell);
      await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
    }
  });
}

test("painted walking sheets keep every pose inside its frame", async ({
  page,
}) => {
  await openCanvasHarness(page);
  const variants = await page.evaluate(async () => {
    return Promise.all(
      ["farmer", "farmer-female"].map(async (key) => {
        const source = new Image();
        source.src = `/art/${key}-walk.png`;
        await source.decode();
        const canvas = document.createElement("canvas");
        canvas.width = source.width;
        canvas.height = source.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(source, 0, 0);
        return Array.from({ length: 8 }, (_, frame) => {
          const pixels = context.getImageData(
            (frame % 4) * 128,
            Math.floor(frame / 4) * 192,
            128,
            192,
          ).data;
          let opaque = 0;
          let edge = 0;
          let hash = 0;
          for (let y = 0; y < 192; y++)
            for (let x = 0; x < 128; x++) {
              const i = (y * 128 + x) * 4;
              if (pixels[i + 3] > 100) {
                opaque++;
                if (x === 0 || x === 127 || y === 0 || y === 191) edge++;
                hash = (Math.imul(hash, 31) + i + pixels[i]) | 0;
              }
            }
          return { opaque, edge, hash };
        });
      }),
    );
  });
  for (const frames of variants) {
    expect(new Set(frames.map((frame) => frame.hash)).size).toBe(8);
    for (const frame of frames) {
      expect(frame.opaque).toBeGreaterThan(5000);
      expect(frame.edge).toBe(0);
    }
  }
});

test("walking ignores stale frame averages and queued-work speed boosts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?instance=validation-walk-timing");
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  await page.locator('[data-cell="20,20"]').press("Enter");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-cell",
    "20,20",
  );
  await page.keyboard.press("Escape");
  await page.locator('[data-cell="20,40"]').press("Enter");
  const samples = await page.evaluate(async () => {
    const modulePath = "/src/game/farmer.ts";
    const { Farmer } = await import(modulePath);
    const original = Farmer.prototype.update;
    return new Promise<{ distance: number; seconds: number }[]>((resolve) => {
      const samples: { distance: number; seconds: number }[] = [];
      Farmer.prototype.update = function (
        this: import("../../src/game/farmer").Farmer,
        ...args: Parameters<import("../../src/game/farmer").Farmer["update"]>
      ) {
        const before = { ...this["position"] };
        const loop = this.view.scene.game.loop;
        // Model recovery from expensive rendering, while work remains queued.
        loop.deltaHistory.fill(80);
        const tasks = this["tasks"];
        this["tasks"] = Array.from({ length: 4 }, () => ({
          target: { col: 20, row: 40 },
          action: "walk" as const,
        }));
        original.apply(this, args);
        this["tasks"] = tasks;
        samples.push({
          distance: Math.hypot(
            this["position"].col - before.col,
            this["position"].row - before.row,
          ),
          seconds: Math.min(loop.rawDelta, 100) / 1000,
        });
        if (samples.length === 20) {
          Farmer.prototype.update = original;
          loop.deltaHistory.fill(loop.rawDelta);
          resolve(samples);
        }
      };
    });
  });
  for (const sample of samples)
    expect(sample.distance).toBeCloseTo(5 * sample.seconds, 5);
});
