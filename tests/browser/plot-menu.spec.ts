import { test, expect } from "./fixtures";
import { fits, openCell, readFarm, setFarm } from "./context-helpers";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test.describe(`plot menu at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: true });

    test("soil benefits fit their button through locked, available, pending and completed states", async ({
      page,
    }) => {
      await page.goto(`/?instance=validation-plot-benefits-${viewport.width}`);
      await expect(page.locator("#save-status")).toHaveText(
        "Saved on this browser",
      );
      const initial = await readFarm(page);
      for (const patch of [
        {},
        { harvests: { ...initial.harvests, turnip: 3 } },
        { pendingSoilUpgrade: true },
        { soilLevel: 3 },
      ]) {
        await setFarm(page, { ...initial, ...patch });
        await openCell(page, "16,16");
        await fits(page);
        const button = page.locator("#improve");
        await button.scrollIntoViewIfNeeded();
        const bounds = await button.boundingBox();
        const detail = await button.locator("small").boundingBox();
        expect(bounds).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(detail!.x).toBeGreaterThanOrEqual(bounds!.x);
        expect(detail!.y).toBeGreaterThanOrEqual(bounds!.y);
        expect(detail!.x + detail!.width).toBeLessThanOrEqual(
          bounds!.x + bounds!.width,
        );
        expect(detail!.y + detail!.height).toBeLessThanOrEqual(
          bounds!.y + bounds!.height,
        );
        expect(
          await button.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
      }
    });

    test("empty autumn and winter plots explain the next planting window", async ({
      page,
    }) => {
      await page.goto(
        `/?instance=validation-planting-window-${viewport.width}`,
      );
      await expect(page.locator("#save-status")).toHaveText(
        "Saved on this browser",
      );
      const initial = await readFarm(page);
      for (const season of ["fall", "winter"]) {
        await setFarm(page, { ...initial, season });
        await openCell(page, "16,16");
        await expect(page.locator("#planting-season-note")).toHaveText(
          "Planting resumes in spring.",
        );
        await expect(page.locator("[data-crop]")).toHaveCount(0);
        await fits(page);
      }
      for (const season of ["fall", "winter"]) {
        await setFarm(page, { ...initial, year: 40, season });
        await openCell(page, "16,16");
        await expect(page.locator("#planting-season-note")).toHaveText(
          "No planting seasons remain.",
        );
      }
      await setFarm(page, initial);
      await openCell(page, "16,16");
      await expect(page.locator("#planting-season-note")).toHaveCount(0);
      await expect(page.locator('[data-crop="turnip"]')).toBeVisible();
    });
  });
}
