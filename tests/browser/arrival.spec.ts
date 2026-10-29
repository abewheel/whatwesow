import { buySeeds, choosePlotWork, visitBuilding } from "./helpers";
import { test, expect } from "./fixtures";
import { homesteadState } from "../../src/game/state";
import {
  openCell,
  setFarm,
  closeActions,
  fits,
  expectAdjacentToCell,
} from "./context-helpers";
async function farPlot(page: import("@playwright/test").Page, ripe = false) {
  await page.goto("/?instance=validation-arrival");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = homesteadState();
  state.plotCells[8] = { row: 22, col: 20 };
  state.plots[8] = ripe ? { crop: "turnip", growth: 1 } : null;
  await setFarm(page, state);
  if (!ripe) await buySeeds(page, "turnip");
}
test("menus wait for arrival at their selected tile", async ({ page }) => {
  await page.goto("/?instance=validation-arrival-menu");
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await page.locator('[data-cell="22,20"]').press("Enter");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "walk");
  await expect(page.locator("#service-panel")).toBeHidden();
  await expect(page.locator("#service-panel")).toBeVisible();
  await expectAdjacentToCell(page, "22,20");
  await expect(page.locator('[data-cell="22,20"]')).toHaveAttribute(
    "data-context",
    "true",
  );
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await expect(page.locator("#walk-here")).toHaveCount(0);
});
for (const ripe of [false, true])
  test(`${ripe ? "harvest commits on arrival" : "plant waits for arrival and seed choice"}`, async ({
    page,
  }) => {
    await farPlot(page, ripe);
    await page.locator('[data-cell="22,20"]').press("Enter");
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-motion",
      "walk",
    );
    await expect(page.locator("#service-panel")).toBeHidden();
    await expect(page.locator('[data-plot="8"]')).toHaveAttribute(
      "aria-label",
      ripe ? /ready/ : /empty/,
    );
    await expect(page.locator("#season")).toContainText(
      ripe ? "100 coins" : "96 coins",
    );
    if (!ripe) {
      await expect(page.locator("#service-panel")).toBeVisible();
      await choosePlotWork(page);
    }
    await expect(page.locator('[data-plot="8"]')).toHaveAttribute(
      "aria-label",
      ripe ? /empty/ : /growing/,
    );
    await expect(page.locator("#season")).toContainText(
      ripe ? "109 coins" : "96 coins",
    );
    await page.reload();
    await expect(page.locator("#season")).toContainText(
      ripe ? "109 coins" : "96 coins",
    );
  });
test("opening another target cancels the unfinished menu visit without planting", async ({
  page,
}) => {
  await farPlot(page);
  await page.locator('[data-cell="22,20"]').press("Enter");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await expect(page.locator("#service-panel")).toBeHidden();
  await openCell(page, "17,18");

  await expect(page.locator("#service-title")).toHaveText("Open land");
  await expect(page.locator('[data-plot="8"]')).toHaveAttribute(
    "aria-label",
    /empty/,
  );
  await expect(page.locator("#season")).toContainText("96 coins");
});
test("blocked home cannot open its menu and accessible blockers expose teardown", async ({
  page,
}) => {
  await page.goto("/?instance=validation-blocked-home");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = homesteadState();
  const cells = [
    ...[14, 15, 16].map((col) => ({ row: 10, col })),
    ...[14, 15, 16].map((col) => ({ row: 13, col })),
    ...[11, 12].flatMap((row) => [13, 17].map((col) => ({ row, col }))),
  ];
  state.structures.push(
    ...cells.map((cell, i) => ({
      ...cell,
      id: i + 2,
      kind: "oak" as const,
      level: 1,
      age: 40,
    })),
  );
  state.nextStructureId = 12;
  await setFarm(page, state);
  await page
    .getByRole("button", { name: /^Farmhouse \d+, level/ })
    .first()
    .press("Enter");
  await expect(page.locator("#farm-message")).toContainText("No walking path");
  await expect(page.locator("#service-panel")).toBeHidden();
  await expect(page.locator("#season")).toContainText("spring");
  await closeActions(page);
  await page.locator('[data-structure="6"]').press("Enter");
  await expect(page.locator("#teardown-building")).toBeVisible();
  await fits(page);
  await expect(page.locator("#move-building")).toHaveCount(0);
});
for (const action of ["escape", "camera"] as const)
  test(`${action} cancels a pending home menu visit and leaves the season unchanged`, async ({
    page,
  }) => {
    await page.goto(`/?instance=validation-cancel-home-${action}`);
    await expect(page.locator("main")).toHaveJSProperty("inert", false);
    await openCell(page, "22,20");
    await closeActions(page);
    await page
      .getByRole("button", { name: /^Farmhouse \d+, level/ })
      .first()
      .press("Enter");
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-motion",
      "walk",
    );
    await expect(page.locator("#service-panel")).toBeHidden();
    if (action === "escape") await page.keyboard.press("Escape");
    else await page.getByLabel("View controls", { exact: true }).click();
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-motion",
      "idle",
      { timeout: 30000 },
    );
    await expect(page.locator("#service-panel")).toBeHidden();
    await expect(page.locator("#season")).toContainText("spring");
    await expect(page.locator(".season-transition")).toHaveCount(0);
    await visitBuilding(page, "home");
    await page.locator("#next-season").click();
    await expect(page.locator("#season")).toContainText("summer");
  });
