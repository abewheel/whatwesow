import { test, expect } from "./fixtures";
import { readFarm, setFarm, openCell, closeActions } from "./context-helpers";
import { endTurn } from "./helpers";
test("tile choices respect seasons and winter frost leaves trees intact", async ({
  page,
}) => {
  await page.goto("/?instance=validation-seasonal-context");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await openCell(page, "16,16");
  await expect(page.locator('[data-crop="tomato"]')).toHaveCount(0);
  await expect(page.locator('[data-crop="radish"]')).toBeVisible();
  const state = await readFarm(page);
  state.season = "fall";
  state.plots[0] = { crop: "pumpkin", growth: 1 };
  state.structures.push({
    id: 2,
    kind: "apple",
    row: 14,
    col: 18,
    level: 1,
    age: 12,
    product: true,
  });
  state.nextStructureId = 3;
  await setFarm(page, state);
  await endTurn(page);
  await closeActions(page);
  await openCell(page, "16,16");
  await expect(page.locator("#tile-actions")).toContainText(
    "No planting this season",
  );
  await expect(page.locator("[data-crop]")).toHaveCount(0);
  expect(
    (await readFarm(page)).structures.find((s: { id: number }) => s.id === 2),
  ).toBeTruthy();
});
