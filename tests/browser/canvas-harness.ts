import { expect, type Page } from "@playwright/test";

/** Browser canvas APIs without the game, renderer, saves, or artwork preload. */
export async function openCanvasHarness(page: Page) {
  await page.route("**/canvas-inspection", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><body></body>",
    }),
  );
  await page.goto("/canvas-inspection");
  await expect(page.locator("#farm")).toHaveCount(0);
}
