import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test(`video page plays muted and keeps Play visible at ${viewport.width}×${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport.width < 800,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => {
      if (request.failure()?.errorText !== "net::ERR_ABORTED")
        errors.push(request.url());
    });
    await page.goto("/video");
    const video = page.locator("video");
    await expect(video).toBeVisible();
    await expect
      .poll(() =>
        video.evaluate(
          (element: HTMLVideoElement) =>
            !element.paused && element.muted && element.currentTime > 0,
        ),
      )
      .toBe(true);
    const play = page.getByRole("link", { name: "Play", exact: true });
    await expect(play).toBeInViewport({ ratio: 1 });
    await expect(play).toHaveAttribute("href", "/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await video.evaluate((element: HTMLVideoElement) => element.pause());
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
      .toBe(true);
    const [game] = await Promise.all([
      context.waitForEvent("page"),
      play.click(),
    ]);
    await expect(game).toHaveURL(/\/$/);
    await expect(game.locator("#startup")).toBeVisible();
    await expect(page).toHaveURL(/\/video$/);
    expect(await game.evaluate(() => window.opener)).toBeNull();
    expect(errors).toEqual([]);
    await context.close();
  });
}
