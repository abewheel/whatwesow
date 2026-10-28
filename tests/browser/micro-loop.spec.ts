import { test, expect } from "./fixtures";
import { loadPreset, openCell, readFarm, setFarm } from "./context-helpers";
import { endTurn } from "./helpers";
test("crop forecasts include irrigation and policy-adjusted payouts", async ({
  page,
}) => {
  await page.goto("/?instance=validation-context-forecasts");
  await loadPreset(page, "community");
  const state = await readFarm(page);
  state.structures.push({
    id: state.nextStructureId++,
    kind: "well",
    row: 22,
    col: 22,
    level: 2,
  });
  state.farmPolicy = { productionMultiplier: 0.5 };
  await setFarm(page, state);
  await openCell(page, "16,16");
  await expect(page.locator('[data-crop="corn"]')).toContainText("1 season");
  await expect(page.locator('[data-crop="corn"]')).toContainText(
    "harvest 26 coins",
  );
  await page.locator('[data-crop="corn"]').click();
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /growing/,
  );
  await endTurn(page);
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /ready/,
  );
});
