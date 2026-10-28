import { test as startupTest } from "@playwright/test";
import { test, expect } from "./fixtures";
import { openCell, fits, closeActions } from "./context-helpers";
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 900 },
  { width: 601, height: 768 },
  { width: 1024, height: 600 },
])
  test(`compact HUD and anchored menus fit at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/?instance=validation-hud-${viewport.width}`);
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    await expect(
      page.locator(
        "#seed-selection,#end-turn,#build-shop,#crop-options,#structure-target",
      ),
    ).toHaveCount(0);
    await expect(page.locator(".farm-tools")).toBeHidden();
    await openCell(page, "16,16");
    await fits(page);
    await fits(page, "#close-service");
    await closeActions(page);
    await page.locator("#open-menu").click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#open-menu")).toBeFocused();
  });
// Storage failure must reach startup without a fixture trying to seed a save.
startupTest(
  "startup storage errors stay visible outside save controls",
  async ({ page }) => {
    await page.addInitScript(() => {
      indexedDB.open = () => {
        throw Error("Storage unavailable");
      };
    });
    await page.goto("/?instance=validation-storage-warning");
    await expect(page.locator("#farm-message")).toContainText(
      "Could not load local save",
    );
  },
);

test("short landscape keeps counts beside the calendar and leaves farm space below", async ({
  page,
}) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto("/?instance=validation-landscape-hud");
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  const calendar = (await page.locator("#season").boundingBox())!;
  const counts = (await page.locator("#farm-status").boundingBox())!;
  const feedback = (await page.locator(".field-note").boundingBox())!;
  expect(counts.x).toBeGreaterThanOrEqual(calendar.x + calendar.width);
  expect(Math.abs(counts.y - calendar.y)).toBeLessThanOrEqual(1);
  expect(feedback.y + feedback.height).toBeLessThan(125);
  const trial = (await page.locator("#crisis-test").boundingBox())!;
  expect(
    await page
      .locator("#crisis-test")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  expect(feedback.x + feedback.width).toBeLessThanOrEqual(trial.x);
  for (const selector of [
    "#open-inventory",
    "#open-menu",
    "#camera-controls summary",
  ]) {
    const bounds = (await page.locator(selector).boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  await openCell(page, "16,16");
  await fits(page);
  await fits(page, "#close-service");
});
