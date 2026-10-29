import { test, expect } from "./fixtures";
import { applyState, farmAt, records } from "./crisis-helpers";

for (const device of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "portrait", width: 320, height: 568 },
  { name: "landscape", width: 667, height: 375 },
]) {
  test.describe(device.name, () => {
    test.use({
      viewport: { width: device.width, height: device.height },
      hasTouch: device.name !== "desktop",
    });
    test("feedback wraps without resizing the calendar and crop HUD", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("requestfailed", (request) => errors.push(request.url()));
      await page.goto(`/?instance=validation-hud-feedback-${device.name}`);
      await expect(page.locator("#save-status")).toHaveText(
        "Saved on this browser",
      );
      await expect(page.locator("#weather-status .pixel-icon")).toHaveAttribute(
        "style",
        /water\.svg/,
      );
      await applyState(page, farmAt(6, records(["D-LIB-P"], [6]), []));
      await expect(page.locator("#weather-status .pixel-icon")).toHaveAttribute(
        "style",
        /dryWater\.svg/,
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      // Content length is the regression trigger, independent of the action that reports it.
      const measure = () =>
        page.evaluate(() => {
          const bounds = (selector: string) => {
            const box = document
              .querySelector(selector)!
              .getBoundingClientRect();
            return {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              right: box.right,
            };
          };
          return {
            season: bounds("#season"),
            counts: bounds("#farm-status"),
            overview: bounds(".farm-overview"),
            note: bounds(".field-note"),
          };
        });
      await page
        .locator("#farm-message")
        .evaluate((element) => (element.textContent = "Ready."));
      const short = await measure();
      await page
        .locator("#farm-message")
        .evaluate(
          (element) =>
            (element.textContent =
              "The farmhouse will finish next season. Growing crops need water before the current season ends, and your harvest will be ready after the farmer arrives beside the selected field."),
        );
      const long = await measure();
      expect(long.season).toEqual(short.season);
      expect(long.counts).toEqual(short.counts);
      expect(long.overview.width).toBe(short.overview.width);
      expect(long.note.width).toBeCloseTo(long.overview.width, 0);
      expect(long.note.height).toBeGreaterThan(short.note.height);
      expect(long.note.right).toBeLessThanOrEqual(device.width);
      if (process.env.HUD_SCREENSHOTS_DIR)
        await page.screenshot({
          path: `${process.env.HUD_SCREENSHOTS_DIR}/hud-${device.name}.png`,
        });
      expect(errors).toEqual([]);
    });
  });
}
