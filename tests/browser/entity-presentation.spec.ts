import { expect, test } from "./fixtures";
import { readFarm, setFarm } from "./context-helpers";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test.describe(`entity presentation ${viewport.width}`, () => {
    test.use({ viewport, hasTouch: viewport.width < 1000 });
    test("trees and hives cast shadows without permanent text; details remain selectable", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("requestfailed", (request) => errors.push(request.url()));
      await page.goto("/?instance=validation-entity-presentation");
      const state = await readFarm(page);
      state.structures.push(
        {
          id: 2,
          kind: "apple",
          row: 15,
          col: 18,
          level: 1,
          age: 12,
          product: true,
        },
        { id: 3, kind: "oak", row: 16, col: 19, level: 1, age: 2 },
        { id: 4, kind: "beehive", row: 19, col: 18, level: 1, product: true },
      );
      state.nextStructureId = 5;
      const canvas = page.locator("canvas");
      for (const season of ["spring", "summer", "fall", "winter"]) {
        state.season = season;
        await setFarm(page, state);
        await expect(canvas).toHaveAttribute("data-scene-labels", "0");
        await page.getByText("Playtest tools", { exact: true }).click();
        const tree = page.locator('[data-structure="2"]').first();
        await tree.scrollIntoViewIfNeeded();
        await expect
          .poll(async () =>
            JSON.parse((await canvas.getAttribute("data-scene-shadows"))!),
          )
          .toEqual(
            expect.arrayContaining([
              "tree-apple",
              "tree-oak",
              season === "winter" ? "beehive-winter" : "beehive",
            ]),
          );
        if (viewport.width >= 1000) {
          await tree.hover();
          await expect(page.getByRole("tooltip")).toHaveText("Apple tree");
          await page.locator('[data-cell="20,20"]').hover();
          // Leaving the world clears its shared tooltip.
          await expect(page.getByRole("tooltip")).toBeHidden();
        }
        if (viewport.width < 1000) await tree.tap();
        else await tree.click();
        await expect(page.locator("#service-panel")).toBeVisible();
        await expect(page.locator("#harvest-tree")).toBeVisible();
        await page.keyboard.press("Escape");
        await page.getByText("Playtest tools", { exact: true }).click();
      }
      expect(errors).toEqual([]);
    });
  });
}
