import { test, expect } from "@playwright/test";
import { visitBuilding, endTurn, clickCamera } from "./helpers";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 900 },
  { width: 601, height: 768 },
  { width: 1024, height: 600 },
]) {
  test(`building controls and keyboard menu fit at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/?instance=validation-hud-${viewport.width}`);
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    await page.evaluate(() => document.fonts.ready);
    for (const selector of [".hud-top", ".farm-tools", ".field-note"]) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    await expect(
      page.locator("#mode-build, #mode-plant, #mode-upgrade, [data-visit]"),
    ).toHaveCount(0);
    await expect(page.locator("#zoom-in")).toBeHidden();
    await visitBuilding(page, "seeds");
    const carrot = page.locator('[data-crop="carrot"]');
    await carrot.focus();
    await expect(carrot.locator(".control-detail")).toContainText(
      "2 seasons to grow",
    );
    await carrot.click();
    await expect(page.locator("#service-panel")).toBeHidden();
    await page.locator('[data-plot="0"]').click();
    await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
      "aria-label",
      /Carrot, growing/,
    );
    await endTurn(page);
    await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
      "aria-label",
      /growing 1\/2/,
    );
    await page.locator("#close-service").click();
    await clickCamera(page, "#zoom-out");
    await expect(page.locator("#zoom-level")).toHaveText("75%");
    await page.locator("#camera-controls summary").click();
    const trigger = page.locator("#open-menu");
    await trigger.click();
    await expect(page.locator("#farm-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#farm-menu")).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await page.locator("#resume").click();
    await expect(trigger).toBeFocused();
  });
}

test("startup storage failures remain visible outside the save menu", async ({
  page,
}) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.goto("/?instance=validation-storage-warning");
  await expect(page.locator("#farm-menu")).toBeHidden();
  await expect(page.locator("#farm-message")).toContainText(
    "Could not load local save",
  );
});

test("selected seed feedback matches policy-adjusted harvest", async ({
  page,
}) => {
  await page.goto("/?instance=validation-seed-policy");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.getByLabel("Work on").selectOption("full");
  const editor = page.getByLabel("Game state JSON");
  const state = JSON.parse(await editor.inputValue());
  state.farmPolicy = { productionMultiplier: 0.5 };
  await editor.fill(JSON.stringify(state));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await visitBuilding(page, "seeds");
  await page.locator('[data-crop="carrot"]').click();
  await expect(page.locator("#farm-message")).toContainText("Harvest 9 coins");
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /Carrot, growing/,
  );
  await endTurn(page);
  await endTurn(page);
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("#farm-message")).toContainText("+9 coins");
  await expect(page.locator("#season")).toContainText("102 coins");
});
