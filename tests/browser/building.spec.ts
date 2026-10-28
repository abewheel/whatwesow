import { test, expect } from "./fixtures";
import {
  buildAt,
  loadPreset,
  openCell,
  closeActions,
  readFarm,
  setFarm,
} from "./context-helpers";
import { endTurn } from "./helpers";
test("commissions, moves and upgrades a specific building and persists paid work", async ({
  page,
}) => {
  await page.goto("/?instance=validation-build-context");
  await loadPreset(page, "community");
  await buildAt(page, "shed", "30,30");
  await expect(page.locator("#service-title")).toHaveText("Seed storehouse");
  await expect(page.locator("#upgrade-building")).toBeDisabled();
  const state = await readFarm(page),
    id = state.structures.find(
      (s: { row: number; col: number }) => s.row === 30 && s.col === 30,
    ).id;
  await page.locator("#move-building").click();
  await expect(page.locator("#placement-hint")).toContainText(
    "Choose open land as the destination",
  );
  await page.locator('[data-cell="35,35"]').press("Enter");
  await expect(page.locator(`[data-structure="${id}"]`)).toHaveAttribute(
    "data-cell",
    "35,35",
  );
  await endTurn(page);
  const earned = await readFarm(page);
  earned.harvests.turnip += 12;
  await setFarm(page, earned);
  await closeActions(page);
  await page.locator(`[data-structure="${id}"]`).press("Enter");
  await page.locator("#upgrade-building").click();
  await expect(page.locator("#upgrade-building")).toContainText("underway");
  await page.reload();
  await endTurn(page);
  await closeActions(page);
  await page.locator(`[data-structure="${id}"]`).press("Enter");
  await expect(page.locator("#tile-actions")).toContainText("Level 2/3");
});
test("quotes repeated construction costs and disables blocked footprints and policies", async ({
  page,
}) => {
  await page.goto("/?instance=validation-build-quotes");
  await loadPreset(page, "community");
  await openCell(page, "30,30");
  await expect(page.locator('[data-build="shed"]')).toContainText("120 coins");
  const state = await readFarm(page);
  state.farmPolicy = {
    blockedBuildings: ["barn"],
    buildingLimits: { shed: 1 },
  };
  await setFarm(page, state);
  await openCell(page, "30,30");
  await expect(page.locator('[data-build="barn"]')).toBeDisabled();
  await expect(page.locator('[data-build="shed"]')).toBeDisabled();
  await openCell(page, "63,63");
  await expect(page.locator('[data-build="barn"]')).toBeDisabled();
});
test("moves a plot with its crop without charging coins", async ({ page }) => {
  await page.goto("/?instance=validation-move-plot");
  await loadPreset(page, "growing");
  const before = await readFarm(page);
  await openCell(page, "16,16");
  await page
    .getByRole("button", { name: "Move this plot", exact: true })
    .click();
  await page.locator('[data-cell="20,20"]').press("Enter");
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "data-cell",
    "20,20",
  );
  const after = await readFarm(page);
  expect(after.coins).toBe(before.coins);
  expect(after.plots[0]).toEqual(before.plots[0]);
  await page.reload();
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "data-cell",
    "20,20",
  );
});

test("mill upgrade instructions count corn rather than other harvests", async ({
  page,
}) => {
  await page.goto("/?instance=validation-mill-requirement");
  await loadPreset(page, "community");
  const state = await readFarm(page);
  state.harvests.corn = 1;
  state.harvests.turnip = 100;
  await setFarm(page, state);
  const mill = state.structures.find(
    (s: { kind: string }) => s.kind === "mill",
  );
  await page.locator(`[data-structure="${mill.id}"]`).press("Enter");
  await expect(page.locator("#upgrade-building")).toContainText(
    "Harvest 11 more corn crops",
  );
  await expect(page.locator("#upgrade-building")).toBeDisabled();
});
