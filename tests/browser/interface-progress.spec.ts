import { test, expect } from "./fixtures";
import {
  closeActions,
  fits,
  openCell,
  readFarm,
  setFarm,
} from "./context-helpers";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test.describe(`interface ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true });
    test("inventory shows held items and teardown needs confirmation beside close", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("requestfailed", (request) => errors.push(request.url()));
      await page.goto(
        `${process.env.INTERFACE_URL ?? ""}/?instance=validation-interface-${viewport.width}`,
      );
      await expect(page.locator("#save-status")).toHaveText(
        "Saved on this browser",
      );
      await page.locator("#open-inventory").tap();
      await expect(page.locator("#inventory-empty")).toBeVisible();
      await expect(page.locator("[data-inventory-crop]")).toHaveCount(0);
      await fits(page);
      if (process.env.INTERFACE_SCREENSHOTS)
        await page.screenshot({
          path: `${process.env.INTERFACE_SCREENSHOTS}/empty-${viewport.width}.png`,
        });
      const state = await readFarm(page);
      state.seeds.carrot = 2;
      await setFarm(page, state);
      await closeActions(page);
      await page.locator("#open-inventory").tap();
      await expect(page.locator("[data-inventory-crop]")).toHaveCount(1);
      await expect(
        page.locator('[data-inventory-crop="carrot"]'),
      ).toContainText("2");
      if (process.env.INTERFACE_SCREENSHOTS)
        await page.screenshot({
          path: `${process.env.INTERFACE_SCREENSHOTS}/inventory-${viewport.width}.png`,
        });
      await openCell(page, "16,16");
      const trash = page.locator("#delete-plot");
      await expect(page.locator(".service-heading #delete-plot")).toBeVisible();
      const box = (await trash.boundingBox())!;
      expect(box.width).toBe(44);
      expect(box.height).toBe(44);
      await trash.tap();
      await fits(page, "#delete-confirm");
      await expect(page.locator("#delete-description")).toContainText(
        "any crop",
      );
      if (process.env.INTERFACE_SCREENSHOTS)
        await page.screenshot({
          path: `${process.env.INTERFACE_SCREENSHOTS}/confirm-${viewport.width}.png`,
        });
      await page.locator("#cancel-delete").tap();
      expect((await readFarm(page)).plotIds).toEqual(state.plotIds);
      await openCell(page, "16,16");
      await trash.tap();
      await page.locator("#confirm-delete").tap();
      await expect(page.locator("#delete-confirm")).not.toBeVisible();
      await expect
        .poll(async () => (await readFarm(page)).plotIds.length)
        .toBe(state.plotIds.length - 1);
      await openCell(page, "12,14");
      await expect(
        page.locator(".service-heading #teardown-building"),
      ).toBeVisible();
      const buildingBox = (await page
        .locator("#teardown-building")
        .boundingBox())!;
      expect(buildingBox.width).toBe(44);
      expect(buildingBox.height).toBe(44);
      await page.locator("#teardown-building").tap();
      await expect(page.locator("#delete-description")).toContainText(
        "next season",
      );
      await page.locator("#cancel-delete").tap();
      await page.locator("#farm-upgrades").tap();
      await expect(page.locator(".upcoming-unlocks")).toContainText(
        "Corn seeds",
      );
      await expect(page.locator(".upcoming-unlocks")).toContainText(
        "Harvest a turnip and a carrot",
      );
      await fits(page);
      await page
        .locator(".upcoming-unlocks p")
        .first()
        .scrollIntoViewIfNeeded();
      if (process.env.INTERFACE_SCREENSHOTS)
        await page.screenshot({
          path: `${process.env.INTERFACE_SCREENSHOTS}/unlocks-${viewport.width}.png`,
        });
      expect(errors).toEqual([]);
    });
  });
}

test("locked building plans show milestones, benefits and current farming progress", async ({
  page,
}) => {
  await page.goto(
    `${process.env.INTERFACE_URL ?? ""}/?instance=validation-interface-plans`,
  );
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await openCell(page, "20,20");
  await page.locator('[data-category="animals"]').click();
  const coop = page.locator('[data-build="coop"]');
  await expect(coop).toBeDisabled();
  await expect(coop).toContainText("Harvest 3 crops");
  await expect(coop).toContainText("30 coins");
  await expect(page.locator("#progression-counts")).toContainText(
    "0 crops harvested",
  );
  if (process.env.INTERFACE_SCREENSHOTS)
    await page.screenshot({
      path: `${process.env.INTERFACE_SCREENSHOTS}/plans.png`,
    });
});
