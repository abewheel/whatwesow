import { test, expect } from "./fixtures";

test("farm fixtures seed timestamped application modules", async ({ page }) => {
  // Vite adds a module query after edits, including CSS changes during a run.
  await page.route("**/?instance=validation-fixture-query", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      /src="\/src\/main\.ts[^"]*"/,
      'src="/src/main.ts?fixture-query=1"',
    );
    await route.fulfill({ response, body });
  });
  await page.goto("/?instance=validation-fixture-query");
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  await expect(page.locator("[data-plot]")).toHaveCount(9);
  await expect(page.locator("#season")).toContainText("100 coins");
  await page.reload();
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  await expect(page.locator("[data-plot]")).toHaveCount(9);
});
