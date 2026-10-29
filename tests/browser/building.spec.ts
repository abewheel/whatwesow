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
test("commissions and upgrades a specific building and persists paid work", async ({
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
  await endTurn(page);
  const earned = await readFarm(page);
  earned.harvests.turnip += 12;
  await setFarm(page, earned);
  await closeActions(page);
  await page.locator(`[data-structure="${id}"]`).press("Enter");
  await page.locator("#upgrade-building").click();
  await expect(page.locator("#upgrade-building")).toHaveAttribute(
    "aria-label",
    /underway/,
  );
  await page.reload();
  await endTurn(page);
  await closeActions(page);
  await page.locator(`[data-structure="${id}"]`).press("Enter");
  await expect(page.locator(".building-stats")).toHaveAttribute(
    "aria-label",
    /Level 2\/3/,
  );
});
test("quotes repeated construction costs and disables blocked footprints and policies", async ({
  page,
}) => {
  await page.goto("/?instance=validation-build-quotes");
  await loadPreset(page, "community");
  await openCell(page, "30,30");
  await expect(page.locator('[data-build="shed"]')).toHaveAttribute(
    "aria-label",
    /120 coins/,
  );
  await expect(page.locator('[data-build="shed"] .plan-benefit')).toBeVisible();
  await expect(page.locator('[data-build="shed"] .plan-benefit')).toHaveText(
    "Bulk seed storage: seeds cost 1 less per level",
  );
  const state = await readFarm(page);
  state.farmPolicy = {
    blockedBuildings: ["barn"],
    buildingLimits: { shed: 1 },
  };
  await setFarm(page, state);
  await openCell(page, "30,30");
  await expect(page.locator('[data-build="barn"]')).toBeDisabled();
  await expect(page.locator('[data-build="barn"] .plan-rule')).toBeVisible();
  await expect(page.locator('[data-build="barn"] .plan-rule')).toHaveText(
    "Not allowed by the council",
  );
  await page.locator('[data-category="farm"]').click();
  await expect(page.locator('[data-build="shed"]')).toBeDisabled();
  await expect(page.locator('[data-build="shed"] .plan-rule')).toBeVisible();
  await expect(page.locator('[data-build="shed"] .plan-rule')).toHaveText(
    "No more allowed by the council",
  );
  // Keep the footprint check local to this fixture. Walking from 30,30 to
  // 63,63 takes more than thirteen seconds even before rendering overhead.
  // Clear the policy first so a disabled plan proves the occupied footprint.
  state.farmPolicy = {};
  await setFarm(page, state);
  await openCell(page, "30,30");
  await expect(page.locator('[data-build="barn"]')).toBeEnabled();
  state.plotCells[0] = { row: 31, col: 31 };
  await setFarm(page, state);
  await openCell(page, "30,30");
  await expect(page.locator('[data-build="barn"]')).toBeDisabled();
  await expect(page.locator('[data-build="barn"] .plan-rule')).toHaveCount(0);
});
test("deletes a planted plot immediately without a refund", async ({
  page,
}) => {
  await page.goto("/?instance=validation-delete-plot");
  await loadPreset(page, "growing");
  const before = await readFarm(page);
  await openCell(page, "16,16");
  await page.locator("#delete-plot").click();
  const after = await readFarm(page);
  expect(after.coins).toBe(before.coins);
  expect(after.plots).toHaveLength(before.plots.length - 1);
  await page.reload();
  expect((await readFarm(page)).plots).toHaveLength(before.plots.length - 1);
});

test("tears down a building next season without a refund", async ({ page }) => {
  await page.goto("/?instance=validation-teardown-building");
  await loadPreset(page, "community");
  const before = await readFarm(page);
  const shed = before.structures.find(
    (s: { kind: string }) => s.kind === "shed",
  );
  await closeActions(page);
  await page.locator(`[data-structure="${shed.id}"]`).first().press("Enter");
  await page.locator("#teardown-building").click();
  expect((await readFarm(page)).coins).toBe(before.coins);
  await expect(
    page.locator(`[data-structure="${shed.id}"]`).first(),
  ).toHaveAttribute("aria-label", /tear.?down|demoli|remov/i);
  await endTurn(page);
  await expect(page.locator(`[data-structure="${shed.id}"]`)).toHaveCount(0);
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
  await expect(page.locator("#upgrade-building")).toHaveAttribute(
    "aria-label",
    /Harvest 11 more corn crops/,
  );
  await expect(page.locator("#upgrade-building")).toBeDisabled();
});
