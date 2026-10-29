import { buySeeds } from "./helpers";
import { test, expect } from "@playwright/test";
import { test as farmTest } from "./fixtures";
import { endTurn, visitBuilding } from "./helpers";
import { closeActions, fits, openCell } from "./context-helpers";
for (const viewport of [{ width: 1280, height: 800 }]) {
  test(`anchored actions cover a first season at ${viewport.width}px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport, hasTouch: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("requestfailed", (r) => errors.push(r.url()));
    await page.goto(`/?instance=validation-context-${viewport.width}`);
    await page.locator("#begin-farm").click();
    await buySeeds(page, "turnip");
    await openCell(page, "16,16");
    await fits(page);
    await page.locator("#expand").click();
    await expect(page.locator("#service-title")).toHaveText("Plant this plot");
    await page.locator('[data-crop="turnip"]').click();
    await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
      "aria-label",
      /growing/,
    );
    await endTurn(page);
    await closeActions(page);
    await openCell(page, "16,16");
    await fits(page);
    await page
      .getByRole("button", { name: "Harvest crop", exact: true })
      .click();
    await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
      "aria-label",
      /empty/,
    );
    await openCell(page, "12,18");
    await page.locator('[data-build="home"]').click();
    await expect(page.locator("#service-title")).toHaveText("Farmhouse");
    await expect(page.locator("#next-season")).toBeDisabled();
    await endTurn(page);
    await visitBuilding(page, "home");
    await fits(page);
    await expect(page.locator("#move-building")).toHaveCount(0);
    await expect(page.locator("#teardown-building")).toBeVisible();
    await expect(page.locator("#next-season")).toBeVisible();
    await expect(
      page.locator(
        "#seed-selection,#end-turn,#build-shop,#structure-target,#crop-options,#home-actions",
      ),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}
test("popup follows its tile and flips away from viewport edges", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?instance=validation-anchor");
  await page.locator("#begin-farm").click();
  await openCell(page, "16,16");
  const cell = page.locator('[data-cell="16,16"]'),
    panel = page.locator("#service-panel");
  const before = (await panel.boundingBox())!,
    target = (await cell.boundingBox())!;
  expect(Math.abs(before.x - (target.x + target.width / 2))).toBeLessThan(330);
  await page.locator("#farm").evaluate((e) => (e.scrollLeft += 90));
  await expect
    .poll(async () => Math.round((await panel.boundingBox())!.x))
    .toBe(Math.round(before.x - 90));
  await page.evaluate(() => window.scrollTo(0, 40));
  await expect
    .poll(async () => (await panel.boundingBox())!.y)
    .toBeGreaterThanOrEqual(0);
  await page.setViewportSize({ width: 320, height: 568 });
  await fits(page);
  await fits(page, "#close-service");
  await page.setViewportSize({ width: 667, height: 375 });
  await fits(page);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  farmTest.describe(`seeded anchored actions at ${viewport.width}px`, () => {
    farmTest.use({ viewport, hasTouch: true });
    farmTest(
      "plot and home actions fit and remain reachable",
      async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("requestfailed", (request) => errors.push(request.url()));
        await page.goto(
          `/?instance=validation-context-layout-${viewport.width}`,
        );
        await openCell(page, "16,16");
        await fits(page);
        await fits(page, "#close-service");
        await expect(page.locator("#service-title")).toHaveText(
          "Plant this plot",
        );
        await expect(page.locator('[data-crop="turnip"]')).toBeVisible();
        await visitBuilding(page, "home");
        await fits(page);
        await expect(page.locator("#teardown-building")).toBeVisible();
        await expect(page.locator("#next-season")).toBeVisible();
        await expect(
          page.locator(
            "#move-building,#seed-selection,#end-turn,#build-shop,#structure-target,#crop-options,#home-actions",
          ),
        ).toHaveCount(0);
        await page.locator("#close-service").tap();
        await expect(page.locator("#service-panel")).toBeHidden();
        expect(errors).toEqual([]);
      },
    );
  });
}
