import { test, expect } from "./fixtures";
import { openFarmUpgrades } from "./helpers";
import { fits, openCell, readFarm, setFarm } from "./context-helpers";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test.describe(`plot menu at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: true });

    test("soil benefits fit their button through locked, available, pending and completed states", async ({
      page,
    }) => {
      await page.goto(`/?instance=validation-plot-benefits-${viewport.width}`);
      await expect(page.locator("#save-status")).toHaveText(
        "Saved on this browser",
      );
      const initial = await readFarm(page);
      await openCell(page, "16,16");
      await fits(page);
      await expect(page.locator("#improve")).toHaveCount(0);
      await expect(page.locator("#tile-actions")).not.toContainText("Free");
      await expect(page.locator(".plot-footer > button")).toHaveCount(1);
      await expect(
        page.locator(".plot-footer > button").first(),
      ).toHaveAttribute("id", "plot-shop");
      // The zero-stock spring menu reproduces the cramped production layout.
      // Check the card rows and footer even when the body needs scrolling.
      const errors = await page.locator("#tile-actions").evaluate((actions) => {
        const failures: string[] = [];
        const overlap = (a: DOMRect, b: DOMRect) =>
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        const separate = (elements: Element[], label: string) => {
          for (let i = 0; i < elements.length; i++)
            for (let j = i + 1; j < elements.length; j++)
              if (
                overlap(
                  elements[i].getBoundingClientRect(),
                  elements[j].getBoundingClientRect(),
                )
              )
                failures.push(`${label}: ${i} overlaps ${j}`);
        };
        const buttons = Array.from(actions.querySelectorAll("button"));
        separate(buttons, "buttons");
        for (const card of actions.querySelectorAll("[data-crop]")) {
          const bounds = card.getBoundingClientRect();
          const parts = Array.from(card.children).filter(
            (part) => getComputedStyle(part).display !== "none",
          );
          separate(parts, card.getAttribute("data-crop")!);
          for (const part of [
            ...parts,
            ...card.querySelectorAll(".resource"),
          ]) {
            const rect = part.getBoundingClientRect();
            if (
              rect.left < bounds.left - 1 ||
              rect.top < bounds.top - 1 ||
              rect.right > bounds.right + 1 ||
              rect.bottom > bounds.bottom + 1
            )
              failures.push(
                `${card.getAttribute("data-crop")}: content escapes card`,
              );
          }
          separate(Array.from(card.querySelectorAll(".resource")), "resources");
        }
        return failures;
      });
      expect(errors).toEqual([]);
      for (const card of await page.locator(".plant-card").all()) {
        await expect(
          card.locator("[data-metric] > span:nth-child(2)"),
        ).toHaveText(["Seeds", "Seasons", ""]);
        const rows = await card.locator("[data-metric]").evaluateAll((rows) =>
          rows.map((row) =>
            Array.from(row.children).map((part) => {
              const { x, width } = part.getBoundingClientRect();
              return { x, width };
            }),
          ),
        );
        for (const row of rows.slice(1)) {
          for (let column = 1; column < 3; column++) {
            expect(Math.abs(row[column].x - rows[0][column].x)).toBeLessThan(1);
            expect(
              Math.abs(row[column].width - rows[0][column].width),
            ).toBeLessThan(1);
          }
        }
      }
      if (process.env.PLOT_SCREENSHOTS_DIR) {
        await page.screenshot({
          path: `${process.env.PLOT_SCREENSHOTS_DIR}/plant-grid-${viewport.width}.png`,
        });
      }
      const shopSize = await page.locator("#plot-shop").boundingBox();
      expect(shopSize!.height).toBeGreaterThanOrEqual(44);
      await expect(page.locator(".service-heading #delete-plot")).toBeVisible();
      // Crop-grid geometry is independent of the home upgrade state. Check it
      // once above, then exercise every upgrade status without walking back
      // through the plot menu between states.
      for (const patch of [
        {},
        { harvests: { ...initial.harvests, turnip: 3 } },
        { harvests: { ...initial.harvests, turnip: 3 }, coins: 0 },
        { pendingSoilUpgrade: true },
        { soilLevel: 3 },
        { year: 40, season: "winter" },
      ]) {
        await setFarm(page, { ...initial, ...patch });
        await openFarmUpgrades(page);
        await expect(page.locator("#soil-level")).toContainText(
          `Soil level ${"soilLevel" in patch ? patch.soilLevel : initial.soilLevel}/3`,
        );
        const button = page.locator("#improve");
        await expect(button.locator("strong")).toHaveText("Improve soil");
        await expect(button).toContainText("+3 coins / harvest on all plots");
        const status = button.locator(".soil-status");
        if ("pendingSoilUpgrade" in patch)
          await expect(status).toHaveText("Underway · ready next season");
        else if ("soilLevel" in patch)
          await expect(status).toHaveText("Fully improved");
        else if ("year" in patch)
          await expect(status).toHaveText("No next season to finish");
        else if ("coins" in patch)
          await expect(status).toContainText("more coins");
        else if ("harvests" in patch) await expect(button).toBeEnabled();
        else await expect(status).toHaveText("Harvest 3 crops");
        await button.scrollIntoViewIfNeeded();
        const bounds = await button.boundingBox();
        const detail = await button.locator("small").first().boundingBox();
        expect(bounds).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(detail!.x).toBeGreaterThanOrEqual(bounds!.x);
        expect(detail!.y).toBeGreaterThanOrEqual(bounds!.y);
        expect(detail!.x + detail!.width).toBeLessThanOrEqual(
          bounds!.x + bounds!.width,
        );
        expect(detail!.y + detail!.height).toBeLessThanOrEqual(
          bounds!.y + bounds!.height,
        );
        expect(
          await button.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        await page.locator("#back-home").click();
        await expect(page.locator("#farm-upgrades")).toBeVisible();
        await expect(page.locator("#improve")).toHaveCount(0);
      }
    });

    test("empty autumn and winter plots explain the next planting window", async ({
      page,
    }) => {
      await page.goto(
        `/?instance=validation-planting-window-${viewport.width}`,
      );
      await expect(page.locator("#save-status")).toHaveText(
        "Saved on this browser",
      );
      const initial = await readFarm(page);
      for (const season of ["fall", "winter"]) {
        await setFarm(page, { ...initial, season });
        await openCell(page, "16,16");
        await expect(page.locator("#planting-season-note")).toHaveText(
          "Planting resumes in spring.",
        );
        await expect(page.locator("[data-crop]")).toHaveCount(0);
        await fits(page);
      }
      for (const season of ["fall", "winter"]) {
        await setFarm(page, { ...initial, year: 40, season });
        await openCell(page, "16,16");
        await expect(page.locator("#planting-season-note")).toHaveText(
          "No planting seasons remain.",
        );
      }
      await setFarm(page, initial);
      await openCell(page, "16,16");
      await expect(page.locator("#planting-season-note")).toHaveCount(0);
      await expect(page.locator('[data-crop="turnip"]')).toBeVisible();
    });
  });
}
