import { test, expect } from "./fixtures";

test("restart requires confirmation and persists a fresh farm", async ({
  page,
}) => {
  await page.goto("/?instance=validation-restart");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.locator("#open-menu").click();
  await page.locator("#restart").click();
  await expect(
    page.getByRole("dialog", { name: "Restart your farm?" }),
  ).toBeVisible();
  await page.locator("#cancel-restart").click();
  await expect(page.locator("[data-plot]")).toHaveCount(9);
  await page.locator("#restart").click();
  await page.locator("#confirm-restart").click();
  await expect(page.locator("#farm-menu")).not.toBeVisible();
  await expect(page.locator("[data-plot]")).toHaveCount(0);
  await expect(page.locator("[data-structure]")).toHaveCount(0);
  await expect(page.locator("#season")).toContainText("240 coins");
  await expect(page.locator("[data-service=home]")).toBeAttached();
  await page.reload();
  await expect(page.locator("#season")).toContainText("Year 1");
  await expect(page.locator("[data-plot]")).toHaveCount(0);
});

test("land actions open visual categories and field deletion gives no refund", async ({
  page,
}) => {
  await page.goto("/?instance=validation-land-menu");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  // Nearby open land exercises arrival without a cross-farm timing dependency.
  await page.locator('[data-cell="14,12"]').click();
  await expect(page.locator("#service-panel")).toBeHidden();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await page.keyboard.press("e");
  await expect(page.locator("#service-panel")).toBeVisible();
  await expect(page.locator("#service-title")).toHaveText("Open land");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-motion",
    "idle",
  );
  await expect(page.locator(".plan-categories button .pixel-icon")).toHaveCount(
    4,
  );
  await expect(
    page.locator("#move-plot, #move-building, #layout-help"),
  ).toHaveCount(0);
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("#service-title")).toHaveText("Plant this plot");
  await page.locator("#delete-plot").click();
  await expect(page.locator("[data-plot]")).toHaveCount(8);
  await expect(page.locator("#season")).toContainText("100 coins");
  await page.reload();
  await expect(page.locator("[data-plot]")).toHaveCount(8);
});
