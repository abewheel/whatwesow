import { test, expect } from "./fixtures";
import { closeActions, openCell, readFarm } from "./context-helpers";
import { farmAt, records } from "./crisis-helpers";
import { endTurn } from "./helpers";

const farm = farmAt(6, records(["D-LIB-P"], [6]), []);
farm.seeds.tomato = 1;
for (const device of [
  {
    name: "desktop",
    width: 1280,
    height: 800,
  },
  { name: "portrait", width: 320, height: 568 },
  {
    name: "landscape",
    width: 667,
    height: 375,
  },
]) {
  test.describe(device.name, () => {
    test.use({
      farmState: farm,
      viewport: { width: device.width, height: device.height },
      hasTouch: device.name !== "desktop",
    });
    test("tomato drought forecast matches the harvested coins", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("requestfailed", (request) => errors.push(request.url()));
      await page.goto(`/?instance=validation-harvest-prices-${device.name}`);
      await expect(page.locator("#save-status")).toHaveText(
        "Saved on this browser",
      );
      await page.locator("#open-inventory").click();
      await page.locator("#open-seed-shop").click();
      await expect(page.locator("#sale-forecast-note")).toContainText(
        "Drought halves thirsty crops",
      );
      await expect(page.locator('[data-buy-seed="tomato"]')).toHaveAttribute(
        "aria-label",
        /harvest 21 coins/,
      );
      await openCell(page, "16,16");
      const tomato = page.locator('[data-crop="tomato"]');
      await expect(tomato.locator('[data-metric="harvest"]')).toHaveText(
        "Dry harvest10",
      );
      await expect(tomato).toContainText("Drought: half yield without water.");
      if (process.env.PRICE_SCREENSHOTS_DIR)
        await page.screenshot({
          path: `${process.env.PRICE_SCREENSHOTS_DIR}/tomato-${device.name}.png`,
        });
      await tomato.click();
      await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
        "aria-label",
        /Tomato, growing/,
      );
      await endTurn(page);
      const before = await readFarm(page);
      expect(before.plots[0].dry).toBe(true);
      await closeActions(page);
      await page.locator('[data-plot="0"]').press("Enter");
      await expect(page.locator("#farm-message")).toContainText(
        "Tomato harvested! +10 coins",
      );
      await expect(page.locator("#farm-message")).toContainText(
        "Drought reduced this crop to half yield.",
      );
      expect((await readFarm(page)).coins - before.coins).toBe(10);
      await expect(page.locator("#service-panel")).toBeHidden();
      expect(errors).toEqual([]);
    });
  });
}
