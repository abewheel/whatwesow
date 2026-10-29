import { test, expect } from "./fixtures";
import { readFarm } from "./context-helpers";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test(`corner shortcuts stay in a usable grid at ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/?instance=validation-corner-grid");
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    const boxes = await Promise.all(
      [
        "#camera-controls > summary",
        "#open-menu",
        "#open-inventory",
        "#open-shop",
      ].map((selector) => page.locator(selector).boundingBox()),
    );
    const [view, menu, inventory, shop] = boxes.map((box) => {
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      return box!;
    });
    for (const box of [view, menu, inventory, shop]) {
      expect(box.width).toBe(view.width);
      expect(box.height).toBe(view.height);
    }
    expect(view.y).toBe(menu.y);
    expect(inventory.y).toBe(shop.y);
    expect(view.x).toBe(inventory.x);
    expect(menu.x).toBe(shop.x);
    expect(inventory.y).toBeGreaterThan(view.y);
    const trial = await page.locator("#crisis-test").boundingBox();
    expect(trial!.y).toBeGreaterThanOrEqual(shop.y + shop.height + 7);
    const overview = await page
      .locator(".farm-overview")
      .evaluate((element) => {
        const boxes = ["#season", "#farm-status", ".field-note"].map(
          (selector) =>
            element.querySelector(selector)!.getBoundingClientRect(),
        );
        return boxes.slice(1).map((box, i) => box.top - boxes[i].bottom);
      });
    // Landscape places the calendar and crop counts side by side.
    for (const gap of viewport.height < 500 ? overview.slice(1) : overview)
      expect(gap).toBeCloseTo(viewport.height < 500 ? 6 : 8, 0);
    await page.locator("#camera-controls > summary").click();
    await expect(page.locator("#zoom-in")).toBeInViewport();
    await page.locator("#close-camera").click();
    await page.locator("#open-menu").click();
    await expect(page.locator("#farm-menu")).toBeVisible();
    await page.locator("#resume").click();
    const before = await readFarm(page);
    await page.locator("#open-inventory").click();
    await expect(page.locator("#service-title")).toHaveText("Inventory");
    await page.locator("#open-shop").click();
    await expect(page.locator("#seed-quantity")).toBeVisible();
    await page.locator('[data-buy-seed="turnip"]').click();
    await expect
      .poll(async () => (await readFarm(page)).seeds.turnip)
      .toBe(before.seeds.turnip + 1);
  });
}

test("landscape shop stays open when a keyboard reduces the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto("/?instance=validation-shop-keyboard");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.locator("#open-shop").click();
  await page.locator("#seed-quantity").focus();
  await page.setViewportSize({ width: 667, height: 210 });
  await expect(page.locator("#service-panel")).toBeVisible();
  await page.locator("#seed-quantity").fill("2");
  await expect(page.locator("#seed-quantity")).toHaveValue("2");
  await expect(page.locator("#close-service")).toBeInViewport();
  await page.setViewportSize({ width: 667, height: 375 });
  await page.locator('[data-buy-seed="turnip"]').click();
  await expect.poll(async () => (await readFarm(page)).seeds.turnip).toBe(2);
});
