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

test("rear gait trades the supporting boot instead of holding one raised pose", async ({
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
    const result = [];
    for (const female of [false, true]) {
      const source = new Image();
      source.src = `/art/${female ? "farmer-female-sprites" : "farmer-sprites"}.png`;
      await source.decode();
      const context = createFarmerGait(source, female).getContext("2d")!;
      const contacts = [];
      for (const frame of [0, 2, 6]) {
        const pixels = context.getImageData(frame * 128, 192, 128, 192).data;
        const boots: number[][] = [[], []];
        for (let y = 140; y < 190; y++)
          for (let x = 0; x < 128; x++) {
            const i = (y * 128 + x) * 4;
            if (
              pixels[i + 3] > 160 &&
              pixels[i] > pixels[i + 1] * 1.15 &&
              pixels[i] > pixels[i + 2] * 1.3
            )
              boots[x < 66 ? 0 : 1].push(y);
          }
        // Ignore sparse painted ground flecks, while retaining each boot's
        // own perspective-dependent contact height.
        contacts.push(
          boots.map(
            (values) =>
              values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)],
          ),
        );
      }
      result.push({ female, contacts });
    }
    return result;
  });
  for (const {
    contacts: [neutral, rightSwing, leftSwing],
  } of variants) {
    expect(neutral.every(Number.isFinite)).toBe(true);
    expect(rightSwing[1]).toBeLessThanOrEqual(neutral[1] - 3);
    expect(rightSwing[0]).toBeGreaterThanOrEqual(neutral[0] - 1);
    expect(leftSwing[0]).toBeLessThanOrEqual(neutral[0] - 3);
    expect(leftSwing[1]).toBeGreaterThanOrEqual(neutral[1] - 1);
  }
});
