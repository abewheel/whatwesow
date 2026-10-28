import { test, expect } from "./fixtures";
import {
  openCell,
  setFarm,
  readFarm,
  closeActions,
  loadPreset,
  fits,
} from "./context-helpers";
import { endTurn, visitBuilding, choosePlotWork } from "./helpers";
test("plants seasonal crops, harvests, reinvests in soil and preserves purchases", async ({
  page,
}) => {
  await page.goto("/?instance=validation-farm-loop");
  await loadPreset(page, "community");
  await openCell(page, "16,16");
  await page.locator('[data-crop="carrot"]').click();
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /Carrot, growing/,
  );
  await endTurn(page);
  await endTurn(page);
  await closeActions(page);
  await openCell(page, "16,16");
  await choosePlotWork(page);
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /empty/,
  );
  await openCell(page, "16,16");
  await page.locator("#improve").click();
  await expect(page.locator("#improve")).toContainText("underway");
  await page.reload();
  const state = await readFarm(page);
  expect(state.pendingSoilUpgrade).toBe(true);
  await endTurn(page);
  expect((await readFarm(page)).soilLevel).toBe(1);
});
test("an empty broke farm recovers at home and unaffordable seeds stay disabled", async ({
  page,
}) => {
  await page.goto("/?instance=validation-broke-context");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = await readFarm(page);
  state.coins = 0;
  await setFarm(page, state);
  await openCell(page, "16,16");
  await expect(page.locator('[data-crop="turnip"]')).toBeDisabled();
  await visitBuilding(page, "home");
  await page.locator("#work").click();
  await expect(page.locator("#season")).toContainText("4 coins");
  await openCell(page, "16,16");
  await page.locator('[data-crop="turnip"]').click();
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /growing/,
  );
});
test("a failed purchase keeps its error in the active context menu", async ({
  page,
}) => {
  await page.goto("/?instance=validation-context-save-error");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await openCell(page, "20,20");
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      IDBObjectStore.prototype.put = put;
      this.transaction.abort();
      return put.apply(this, args);
    };
  });
  await page.locator("#expand").click();
  await expect(page.locator("#service-feedback")).toContainText(
    /abort|save|transaction/i,
  );
  await expect(page.locator("#service-panel")).toBeVisible();
  await fits(page);
  await expect(page.locator("#season")).toContainText("100 coins");
  await page.locator("#expand").click();
  await expect(page.locator("#service-title")).toHaveText("Plant this plot");
});

test("a bare farm can earn enough to prepare its first plot", async ({
  page,
}) => {
  await page.goto("/?instance=validation-bare-recovery");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = await readFarm(page);
  state.coins = 8;
  state.plots = [];
  state.plotCells = [];
  state.plotIds = [];
  await setFarm(page, state);
  await visitBuilding(page, "home");
  await page.locator("#work").click();
  await expect(page.locator("#season")).toContainText("12 coins");
  await expect(page.locator("#work")).toBeVisible();
});
