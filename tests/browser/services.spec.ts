import { test, expect } from "./fixtures";
import { visitBuilding, endTurn } from "./helpers";
import { openCell, readFarm, setFarm, closeActions } from "./context-helpers";
test("seed shop exposes inventory purchases while other old services have no catalogs", async ({
  page,
}) => {
  await page.goto("/?instance=validation-no-old-services");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  for (const id of ["fields", "builder"]) {
    await closeActions(page);
    await page.locator(`[data-service="${id}"]`).press("Enter");
    await expect(page.locator("#service-panel")).toBeVisible();
    await expect(page.locator("[data-build],[data-crop]")).toHaveCount(0);
  }
  await closeActions(page);
  await page.locator("#open-inventory").click();
  await page.locator("#open-seed-shop").click();
  await expect(page.locator("[data-buy-seed]")).toHaveCount(6);
  await expect(page.locator("[data-crop]")).toHaveCount(0);
  await expect(
    page.locator(
      "#home-actions,#seed-actions,#field-actions,#builder-actions,#seed-selection,#build-shop",
    ),
  ).toHaveCount(0);
});
test("home owns the calendar and old saves keep their relocated home usable", async ({
  page,
}) => {
  await page.goto("/?instance=validation-home-context");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = await readFarm(page);
  state.structures[0].row = 20;
  state.structures[0].col = 20;
  await setFarm(page, state);
  await visitBuilding(page, "home");
  await expect(page.locator("#next-season")).toBeVisible();
  await expect(page.locator("#move-building")).toHaveCount(0);
  await expect(page.locator("#teardown-building")).toBeVisible();
  await endTurn(page);
  await expect(page.locator("#season")).toContainText("summer");
  await openCell(page, "16,16");
  await expect(page.locator("#next-season")).toHaveCount(0);
});
