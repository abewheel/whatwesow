import { test, expect } from "./fixtures";
import { homesteadState } from "../../src/game/state";
import { openCell, setFarm, closeActions, fits } from "./context-helpers";
import { choosePlotWork, visitBuilding } from "./helpers";
async function farPlot(page: import("@playwright/test").Page, ripe = false) {
  await page.goto("/?instance=validation-arrival");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = homesteadState();
  state.plotCells[8] = { row: 22, col: 20 };
  state.plots[8] = ripe ? { crop: "turnip", growth: 1 } : null;
  await setFarm(page, state);
}
test("menus open at once without ordering a walk", async ({ page }) => {
  await page.goto("/?instance=validation-instant-menu");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-motion",
    "idle",
  );
  const before = await page.locator("canvas").getAttribute("data-farmer-cell");
  await visitBuilding(page, "home");
  await expect(page.locator("#next-season")).toBeVisible();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-cell",
    before!,
  );
});
for (const ripe of [false, true])
  test(`${ripe ? "harvest" : "plant"} commits only after arrival`, async ({
    page,
  }) => {
    await farPlot(page, ripe);
    await openCell(page, "22,20");
    await choosePlotWork(page);
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-motion",
      "walk",
    );
    await expect(page.locator("#season")).toContainText("100 coins");
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
test("opening another target cancels unfinished work", async ({ page }) => {
  await farPlot(page);
  await openCell(page, "22,20");
  await choosePlotWork(page);
  await openCell(page, "17,18");
  await page.getByRole("button", { name: "Walk here", exact: true }).click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-cell",
    "17,18",
  );
  await expect(page.locator('[data-plot="8"]')).toHaveAttribute(
    "aria-label",
    /empty/,
  );
  await expect(page.locator("#season")).toContainText("100 coins");
});
test("blocked buildings can be moved directly, while End Turn requires home access", async ({
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
  await visitBuilding(page, "home");
  await page.locator("#next-season").click();
  await expect(page.locator("#service-feedback")).toContainText(
    "No walking path home",
  );
  await fits(page);
  await expect(page.locator("#season")).toContainText("spring");
  await closeActions(page);
  await page.locator('[data-structure="6"]').press("Enter");
  await page.locator("#move-building").click();
  await page.locator('[data-cell="20,20"]').press("Enter");
  await expect(page.locator("#farm-message")).toContainText("moved");
});

for (const action of ["move", "camera"] as const)
  test(`closing home to ${action} cancels a pending End Turn`, async ({
    page,
  }) => {
    await page.goto(`/?instance=validation-cancel-turn-${action}`);
    await expect(page.locator("main")).toHaveJSProperty("inert", false);
    await openCell(page, "22,20");
    await page.getByRole("button", { name: "Walk here", exact: true }).click();
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-cell",
      "22,20",
      { timeout: 30000 },
    );
    await visitBuilding(page, "home");
    await page.locator("#next-season").click();
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-motion",
      "walk",
    );
    if (action === "move") await page.locator("#move-building").click();
    else await page.getByLabel("View controls", { exact: true }).click();
    await expect(page.locator("#service-panel")).toBeHidden();
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-motion",
      "idle",
      { timeout: 30000 },
    );
    await expect(page.locator("#season")).toContainText("spring");
    await expect(page.locator(".season-transition")).toHaveCount(0);
  });
