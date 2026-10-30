import { test, expect } from "./fixtures";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test.describe(`render cache ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });
    test("short pans reuse scenery and longer pans refresh the cache", async ({
      page,
    }) => {
      await page.goto(`/?instance=validation-perf-${viewport.width}`);
      await expect(page.locator("#save-status")).toHaveText(
        "Saved on this browser",
      );
      const canvas = page.locator("#farm canvas");
      await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
      const draws = async () =>
        Number(await canvas.getAttribute("data-farm-draws"));
      const pan = (distance: number) =>
        page.locator("#farm").evaluate(
          (farm, delta) =>
            new Promise<void>((resolve) => {
              farm.addEventListener(
                "scroll",
                () =>
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                  ),
                { once: true },
              );
              farm.scrollLeft += delta;
            }),
          distance,
        );
      // Cross the entire gutter and observe its rebuild before measuring reuse.
      const initial = await draws();
      await pan(512);
      await expect.poll(draws).toBeGreaterThan(initial);
      const before = await draws();
      for (let i = 0; i < 30; i++) await pan(4);
      expect(await draws()).toBe(before);
      await pan(256);
      await expect.poll(draws).toBe(before + 1);
    });
  });
}
