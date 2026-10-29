import { test, expect } from "./fixtures";
import { homesteadState } from "../../src/game/state";
import { openCell } from "./context-helpers";

const farm = homesteadState();
farm.nextStructureId = 100;
farm.plots[0] = { crop: "turnip", growth: 1 };
farm.structures.push({
  id: 99,
  kind: "apple",
  row: 20,
  col: 20,
  level: 1,
  product: true,
});
test.use({ farmState: farm });

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test(`direct harvest and front interaction at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => errors.push(request.url()));
    await page.goto("/?instance=validation-direct-interaction");
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    await expect(page.locator("main")).toHaveJSProperty("inert", false);
    await page.locator('[data-plot="0"]').click();
    await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
      "aria-label",
      "Plot 1: empty",
    );
    await expect(page.locator("#service-panel")).toBeHidden();
    await page.locator('[data-structure="99"]').press("Enter");
    await expect(page.locator('[data-structure="99"]')).not.toHaveAttribute(
      "aria-label",
      /ready/,
    );
    await expect(page.locator("#service-panel")).toBeHidden();
    await page.locator('[data-service="hive"]').press("Enter");
    await expect(page.locator("#farm-message")).toContainText(/honey/i);
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-motion",
      "idle",
    );
    await expect(page.locator("#service-panel")).toBeHidden();
    await openCell(page, "23,23");
    await expect(page.locator('[data-cell="23,23"]')).toHaveAttribute(
      "data-context",
      "true",
    );
    await page.keyboard.press("Escape");
    await page.locator('[data-cell="24,24"]').press("Enter");
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-cell",
      "24,24",
    );
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-motion",
      "idle",
    );
    await page.locator("#farm").focus();
    await page.keyboard.press("d");
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-cell",
      "24,25",
    );
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-motion",
      "idle",
    );
    for (const [key, cell] of [
      ["ArrowUp", "23,25"],
      ["a", "23,24"],
      ["ArrowDown", "24,24"],
      ["ArrowRight", "24,25"],
      ["w", "23,25"],
      ["s", "24,25"],
      ["ArrowLeft", "24,24"],
      ["d", "24,25"],
    ]) {
      await page.keyboard.press(key);
      await expect(page.locator("canvas")).toHaveAttribute(
        "data-farmer-cell",
        cell,
      );
      await expect(page.locator("canvas")).toHaveAttribute(
        "data-farmer-motion",
        "idle",
      );
    }
    await page.keyboard.press("Space");
    await expect(page.locator("#service-panel")).toBeVisible();
    await expect(page.locator('[data-cell="24,26"]')).toHaveAttribute(
      "data-context",
      "true",
    );
    if (process.env.INTERACTION_EVIDENCE)
      await page.screenshot({
        path: `/tmp/interaction-front-${viewport.width}.png`,
      });
    expect(errors).toEqual([]);
  });
}

test.describe("touch harvest", () => {
  test.use({ hasTouch: true });
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 667, height: 375 },
  ]) {
    test(`tap harvests without a menu at ${viewport.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/?instance=validation-touch-harvest");
      await expect(page.locator("main")).toHaveJSProperty("inert", false);
      const plot = page.locator('[data-plot="0"]');
      await plot.tap();
      await expect(plot).toHaveAttribute("aria-label", "Plot 1: empty");
      await expect(page.locator("#service-panel")).toBeHidden();
      if (process.env.INTERACTION_EVIDENCE)
        await page.screenshot({
          path: `/tmp/interaction-harvest-${viewport.width}.png`,
        });
    });
  }
});
