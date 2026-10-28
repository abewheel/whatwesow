import { test, expect } from "./fixtures";
import { visitBuilding, endTurn } from "./helpers";
import { openCell, readFarm, setFarm, closeActions } from "./context-helpers";
test("old service buildings no longer expose catalogs or construction menus", async ({
  page,
}) => {
  await page.goto("/?instance=validation-no-old-services");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  for (const id of ["seeds", "fields", "builder"]) {
    await closeActions(page);
    await page.locator(`[data-service="${id}"]`).press("Enter");
    await expect(page.locator("#service-panel")).toBeVisible();
    await expect(page.locator("#tile-actions button")).toHaveCount(0);
  }
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
  await expect(page.locator("#move-building")).toBeVisible();
  await endTurn(page);
  await expect(page.locator("#season")).toContainText("summer");
  await openCell(page, "16,16");
  await expect(page.locator("#next-season")).toHaveCount(0);
});
