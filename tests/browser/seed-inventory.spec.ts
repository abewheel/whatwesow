import { test, expect } from "./fixtures";
import { buySeeds } from "./helpers";
import { closeActions, openCell, readFarm, setFarm } from "./context-helpers";

test("seed purchases persist and planting consumes inventory without a second charge", async ({
  page,
}) => {
  await page.goto("/?instance=validation-seed-inventory");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const before = await readFarm(page);
  await openCell(page, "16,16");
  await expect(page.locator('[data-crop="turnip"]')).toBeDisabled();
  await buySeeds(page, "turnip", 2);
  const bought = await readFarm(page);
  expect(bought.seeds.turnip).toBe(2);
  expect(bought.coins).toBe(before.coins - 8);
  await page.reload();
  expect((await readFarm(page)).seeds.turnip).toBe(2);
  await openCell(page, "16,16");
  await page.locator('[data-crop="turnip"]').click();
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /Turnip, growing/,
  );
  const planted = await readFarm(page);
  expect(planted.seeds.turnip).toBe(1);
  expect(planted.coins).toBe(bought.coins);
});

test("shop can stock out-of-season seeds while plots only allow seasonal planting", async ({
  page,
}) => {
  await page.goto("/?instance=validation-seed-seasons");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await buySeeds(page, "tomato");
  expect((await readFarm(page)).seeds.tomato).toBe(1);
  await openCell(page, "16,16");
  await expect(page.locator('[data-crop="tomato"]')).toHaveCount(0);
  const state = await readFarm(page);
  state.season = "summer";
  await setFarm(page, state);
  await openCell(page, "16,16");
  await expect(page.locator('[data-crop="tomato"]')).toBeEnabled();
  await page.locator('[data-crop="tomato"]').click();
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /Tomato, growing/,
  );
  expect((await readFarm(page)).seeds.tomato).toBe(0);
});

test("shop disables unaffordable seed purchases and rejects invalid quantities visibly", async ({
  page,
}) => {
  await page.goto("/?instance=validation-seed-invalid");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = await readFarm(page);
  state.coins = 0;
  await setFarm(page, state);
  await closeActions(page);
  await page.locator("#open-inventory").click();
  await page.locator("#open-seed-shop").click();
  await expect(page.locator('[data-buy-seed="corn"] .crop-rule')).toHaveText(
    "Harvest a turnip and a carrot",
  );
  await expect(page.locator('[data-buy-seed="corn"] .crop-rule')).toBeVisible();
  await expect(page.locator('[data-buy-seed="turnip"]')).toBeDisabled();
  await page.locator("#seed-quantity").fill("0");
  await expect(page.locator('[data-buy-seed="turnip"]')).toBeDisabled();
  await expect(page.locator("#seed-quantity")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#quantity-error")).toContainText("1–999");
  expect((await readFarm(page)).seeds.turnip).toBe(0);
});

test("inventory keeps regular and premium seed purchases separate across reload", async ({
  page,
}) => {
  await page.goto("/?instance=validation-premium-inventory");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = await readFarm(page);
  state.coins = 200;
  state.farmPolicy = { premiumSeed: { seed: 1.5, yield: 1.3, failOneIn: 8 } };
  await setFarm(page, state);
  await buySeeds(page, "turnip", 2);
  await buySeeds(page, "turnip", 3, true);
  const bought = await readFarm(page);
  expect(bought.seeds.turnip).toBe(2);
  expect(bought.premiumSeeds.turnip).toBe(3);
  expect(bought.coins).toBe(174);
  await page.reload();
  const persisted = await readFarm(page);
  expect(persisted.seeds.turnip).toBe(2);
  expect(persisted.premiumSeeds.turnip).toBe(3);
  await expect(page.locator("#open-inventory")).toHaveAttribute(
    "title",
    /5 seeds/,
  );
  await closeActions(page);
  await page.locator("#open-inventory").click();
  await expect(page.locator("#service-title")).toHaveText("Inventory");
  await expect(page.locator("#tile-actions")).toContainText("Turnip");
  persisted.farmPolicy = {};
  await setFarm(page, persisted);
  await openCell(page, "16,16");
  await page.locator('[data-crop="turnip"][data-premium="true"]').click();
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /Turnip, growing/,
  );
  const planted = await readFarm(page);
  expect(planted.seeds.turnip).toBe(2);
  expect(planted.premiumSeeds.turnip).toBe(2);
  expect(planted.coins).toBe(174);
  expect(planted.plots[0].premium).toBe("good");
});

test("I toggles inventory while form inputs keep their keystrokes", async ({
  page,
}) => {
  await page.goto("/?instance=validation-inventory-hotkeys");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await expect(page.locator("#startup")).toBeHidden();
  await page.keyboard.press("i");
  await expect(page.locator("#service-title")).toHaveText("Inventory");
  await page.keyboard.press("i");
  await expect(page.locator("#service-panel")).toBeHidden();
  await page.keyboard.press("i");
  await expect(page.locator("#service-title")).toHaveText("Inventory");
  await page.locator("#open-seed-shop").click();
  const quantity = page.locator("#seed-quantity");
  await quantity.focus();
  await page.keyboard.press("e");
  await expect(page.locator("#seed-quantity")).toBeVisible();
  await page.locator("#close-service").click();
  await page.getByLabel("Game state JSON").focus();
  await page.keyboard.press("i");
  await expect(page.locator("#service-panel")).toBeHidden();
});
