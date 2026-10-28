import { test, expect } from "./fixtures";
import {
  loadPreset,
  openCell,
  readFarm,
  setFarm,
  closeActions,
} from "./context-helpers";
import { endTurn, choosePlotWork, visitBuilding } from "./helpers";
test("harvest milestones expose new plans on open land", async ({ page }) => {
  await page.goto("/?instance=validation-context-unlocks");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = await readFarm(page);
  state.plots[0] = { crop: "turnip", growth: 1 };
  state.harvests.turnip = 2;
  await setFarm(page, state);
  await openCell(page, "20,20");
  await expect(page.locator('[data-build="shed"]')).toHaveCount(0);
  await openCell(page, "16,16");
  await choosePlotWork(page);
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /empty/,
  );
  await openCell(page, "20,20");
  await expect(page.locator('[data-build="shed"]')).toBeVisible();
});
test("the last turn blocks purchases, upgrades and further seasons", async ({
  page,
}) => {
  await page.goto("/?instance=validation-final-context");
  await loadPreset(page, "legacy");
  await endTurn(page);
  await visitBuilding(page, "home");
  await expect(page.locator("#next-season")).toBeDisabled();
  await closeActions(page);
  await openCell(page, "25,25");
  await expect(page.locator("#expand")).toBeDisabled();
  await expect(page.locator('[data-build="shed"]')).toBeDisabled();
});
