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
test("startup storage errors stay visible outside save controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw Error("Storage unavailable");
    };
  });
  await page.goto("/?instance=validation-storage-warning");
  await expect(page.locator("#farm-message")).toContainText(
    "Could not load local save",
  );
});
