import { test, expect } from "./fixtures";
import { openCell, readFarm, setFarm, fits } from "./context-helpers";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test.describe(`purchase cues ${viewport.width}`, () => {
    test.use({ viewport, hasTouch: true });
    test("locked plans and unaffordable coins are red; tree and producer prices use sale rules", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("requestfailed", (request) => errors.push(request.url()));
      await page.goto(
        `${process.env.PURCHASE_URL ?? ""}/?instance=validation-purchase-${viewport.width}`,
      );
      await expect(page.locator("#save-status")).toHaveText(
        "Saved on this browser",
      );
      const state = await readFarm(page);
      state.coins = 1;
      state.farmPolicy = { harvestTax: 0.2, productionMultiplier: 2 };
      await setFarm(page, state);
      await openCell(page, "20,20");
      await page.locator('[data-category="animals"]').tap();
      const coop = page.locator('[data-build="coop"]');
      await expect(coop).toBeDisabled();
      await expect(
        coop.locator(".plan-requirement.action-blocker"),
      ).toContainText("Harvest 3 crops");
      await expect(coop.locator(".plan-requirement .pixel-icon")).toHaveCSS(
        "background-image",
        /locked.svg/,
      );
      await expect(coop.locator(".plan-requirement")).toHaveCSS(
        "color",
        "rgb(161, 55, 44)",
      );
      await expect(coop.locator(".plan-cost")).toHaveClass(/action-blocker/);
      await expect(coop.locator(".harvest-price")).toHaveText("48");
      await expect(coop.locator(".harvest-value-icon")).toBeVisible();
      await expect(coop.locator(".plan-requirement")).toHaveCSS(
        "display",
        "grid",
      );
      await expect(coop).not.toContainText("Click to collect");
      await fits(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await coop.locator(".plan-requirement").scrollIntoViewIfNeeded();
      if (process.env.PURCHASE_SCREENSHOTS)
        await page.screenshot({
          path: `${process.env.PURCHASE_SCREENSHOTS}/locked-${viewport.width}.png`,
        });
      await page.locator('[data-category="trees"]').tap();
      const apple = page.locator('[data-build="apple"]');
      await expect(apple.locator(".tree-maturity")).toHaveText("3y");
      await expect(
        page.locator('[data-build="oak"] .tree-maturity'),
      ).toHaveText("10y");
      await expect(apple).not.toContainText("First apples");
      await expect(apple.locator(".harvest-price")).toHaveText("39");
      await expect(
        page.locator('[data-build="oak"] .harvest-price'),
      ).toHaveText("13");
      await fits(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await apple.locator(".harvest-price").scrollIntoViewIfNeeded();
      if (process.env.PURCHASE_SCREENSHOTS)
        await page.screenshot({
          path: `${process.env.PURCHASE_SCREENSHOTS}/trees-${viewport.width}.png`,
        });
      const home = state.structures.find(
        (s: { kind: string }) => s.kind === "home",
      );
      await openCell(page, `${home.row},${home.col}`);
      await page.locator("#farm-upgrades").tap();
      await expect(page.locator("#improve .soil-price")).toHaveClass(
        /action-blocker/,
      );
      await expect(page.locator("#improve .soil-status .pixel-icon")).toHaveCSS(
        "background-image",
        /locked.svg/,
      );
      state.structures.push({
        id: state.nextStructureId++,
        kind: "coop",
        row: 20,
        col: 20,
        level: 2,
        product: false,
        pendingUpgrade: true,
      });
      await setFarm(page, state);
      await openCell(page, "20,20");
      await expect(page.locator(".building-stats .harvest-price")).toHaveText(
        "96",
      );
      await expect(page.locator("#upgrade-building .action-blocker")).toHaveCSS(
        "color",
        "rgb(161, 55, 44)",
      );
      await expect(
        page.locator("#upgrade-building .action-blocker .pixel-icon"),
      ).toHaveCSS("background-image", /duration.svg/);
      await fits(page);
      expect(errors).toEqual([]);
    });
  });
}
