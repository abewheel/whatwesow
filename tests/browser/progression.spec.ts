import { visitBuilding, endTurn } from "./helpers";
import { test, expect, type Page } from "./fixtures";
import { homesteadMicroState as initialMicroState } from "../../src/micro/state";
async function applyFarm(page: Page, farm: unknown) {
  await page.getByLabel("Work on").selectOption("micro");
  await page.getByLabel("Game state JSON").fill(JSON.stringify(farm));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
}
test("seasonal harvests introduce lasting corn and construction offers", async ({
  page,
}) => {
  await page.goto("/?instance=validation-opportunities");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await expect(page.locator('[data-crop="corn"]')).toBeDisabled();
  await expect(page.locator("#crop-opportunity")).toContainText(
    "Harvest a turnip and a carrot",
  );
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /Turnip, growing/,
  );
  await visitBuilding(page, "seeds");
  await page.locator('[data-crop="carrot"]').click();
  await page.locator('[data-plot="1"]').click();
  await expect(page.locator("canvas")).not.toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await endTurn(page);
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /ready/,
  );
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("canvas")).not.toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await endTurn(page);
  await expect(page.locator('[data-plot="1"]')).toHaveAttribute(
    "aria-label",
    /ready/,
  );
  await page.locator('[data-plot="1"]').click();
  await expect(page.locator("#farm-message")).toContainText("Eli, baker");
  // The offer is earned in fall; planting still respects corn's spring season.
  await expect(page.locator('[data-crop="corn"]')).toBeDisabled();
  await expect(page.locator("#crop-opportunity")).toBeEmpty();
  await visitBuilding(page, "seeds");
  await page.locator('[data-crop="turnip"]').click();
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("canvas")).not.toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await endTurn(page);
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /ready/,
  );
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("#farm-message")).toContainText("Mara, carpenter");
  await visitBuilding(page, "builder");
  await expect(page.locator('[data-build="shed"]')).toBeEnabled();
  await expect(page.locator('[data-build="barn"]')).toBeDisabled();
  await page.locator("#farm-news summary").click();
  await page.setViewportSize({ width: 390, height: 844 });
  const header = await page.locator("#season").boundingBox();
  const note = await page.locator(".field-note").boundingBox();
  expect(note!.y).toBeGreaterThan(header!.y + header!.height);
  await expect(page.locator("#opportunity-notes")).toContainText(
    "keep your seeds dry",
  );
  await page.reload();
  await expect(page.locator("canvas")).not.toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await endTurn(page);
  await expect(page.locator("#season")).toContainText("spring");
  await visitBuilding(page, "seeds");
  await expect(page.locator('[data-crop="corn"]')).toBeEnabled();
  await visitBuilding(page, "seeds");
  await page.locator('[data-crop="corn"]').click();
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /Corn, growing/,
  );
});
test("completed buildings earn upgrades through harvests and preserve paid work", async ({
  page,
}) => {
  await page.goto("/?instance=validation-earned-expansion");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await applyFarm(page, {
    ...initialMicroState(),
    coins: 1000,
    harvests: { turnip: 3, carrot: 0, corn: 0 },
  });
  await visitBuilding(page, "builder");
  await page.locator('[data-build="shed"]').click();
  await page.getByRole("button", { name: "Land 14,18", exact: true }).click();
  await expect(page.locator("#farm-message")).toContainText(
    "construction started",
  );
  await expect(page.locator("canvas")).not.toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await endTurn(page);
  await visitBuilding(page, "builder");
  await page.locator('[data-structure="2"]').click();
  await expect(page.locator("#upgrade-building")).toBeDisabled();
  await expect(page.locator("#upgrade-building")).toContainText(
    "12 more crops",
  );
  await page.getByRole("button", { name: "Read current state" }).click();
  const farm = JSON.parse(
    await page.getByLabel("Game state JSON").inputValue(),
  );
  farm.harvests.turnip += 11;
  await applyFarm(page, farm);
  await visitBuilding(page, "seeds");
  await visitBuilding(page, "seeds");
  await page.locator('[data-crop="carrot"]').click();
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("canvas")).not.toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await endTurn(page);
  await expect(page.locator("canvas")).not.toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await endTurn(page);
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /ready/,
  );
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    "Plot 1: empty",
  );
  await page.locator('[data-structure="2"]').click();
  await expect(page.locator("#selected-building")).toContainText(
    "Ready to upgrade",
  );
  await page.locator("#upgrade-building").click();
  await expect(page.locator("#upgrade-building")).toContainText("underway");
  await visitBuilding(page, "fields");
  await page.locator("#improve").click();
  await expect(page.locator("#improve")).toHaveAttribute(
    "aria-label",
    /underway/,
  );
  await page.reload();
  await expect(page.locator("canvas")).not.toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await endTurn(page);
  await page.locator('[data-structure="2"]').click();
  await expect(page.locator("#selected-building")).toContainText("Level 2/3");
  await expect(page.locator("#upgrade-building")).toContainText(
    "24 more crops",
  );
  await expect(page.locator("#farm-summary")).toContainText("Soil level 1/3");
  await expect(page.locator("#improve")).toHaveAttribute(
    "aria-label",
    /Harvest 30/,
  );
});
