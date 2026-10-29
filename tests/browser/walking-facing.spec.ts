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
      await expect(canvas).toHaveAttribute("data-farmer-motion", "walk");
      await expect(canvas).toHaveAttribute("data-farmer-facing", facing);
      await expect(canvas).toHaveAttribute(
        "data-farmer-frame",
        new RegExp(
          `^farmer${variant === "female" ? "-female" : ""}-gait:${facing.startsWith("back") ? "(?:[89]|1[0-5])" : "[0-7]"}$`,
        ),
      );
      await expect(canvas).toHaveAttribute("data-farmer-cell", cell);
      await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
    }
  });
}

test("painted walking rigs keep every pose inside its frame", async ({
  page,
}) => {
  await page.route("**/gait-inspection", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><body></body>",
    }),
  );
  await page.goto("/gait-inspection");
  const variants = await page.evaluate(async () => {
    const modulePath = "/src/game/farmer-gait.ts";
    const { createFarmerGait } = await import(modulePath);
    const source = new Image();
    source.src = "/art/farmer-rig.png";
    await source.decode();
    return [false, true].map((female) => {
      const context = createFarmerGait(source, female).getContext("2d")!;
      return Array.from({ length: 16 }, (_, frame) => {
        const pixels = context.getImageData(
          (frame % 8) * 128,
          Math.floor(frame / 8) * 192,
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
    });
  });
  for (const frames of variants) {
    expect(new Set(frames.map((frame) => frame.hash)).size).toBe(16);
    for (const frame of frames) {
      expect(frame.opaque).toBeGreaterThan(5000);
      expect(frame.edge).toBe(0);
    }
  }
});
