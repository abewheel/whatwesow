import { test, expect } from "@playwright/test";
import { setCameraCell } from "./helpers";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test.describe(`mobile rendering ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });
    test("zoom keeps targets aligned without rewriting estate geometry", async ({
      page,
    }) => {
      await page.goto(`/?instance=validation-zoom-cost-${viewport.width}`);
      await page.locator("#begin-farm").tap();
      const result = await page.locator("#farm").evaluate(async (farm) => {
        let writes = 0;
        const observer = new MutationObserver((entries) => {
          writes += entries.filter((entry) =>
            (entry.target as Element).matches(".plot-hit"),
          ).length;
        });
        observer.observe(farm, {
          subtree: true,
          attributes: true,
          attributeFilter: ["style"],
        });
        const sizes: number[] = [];
        for (const key of ["-", "-", "+", "+", "+", "+", "+", "0"]) {
          farm.dispatchEvent(
            new KeyboardEvent("keydown", { key, bubbles: true }),
          );
          await new Promise(requestAnimationFrame);
          const tile = farm.querySelector<HTMLElement>('[data-cell="16,16"]')!;
          const bounds = tile.getBoundingClientRect();
          const zoom =
            Number(
              document
                .querySelector("#zoom-level")!
                .textContent!.replace("%", ""),
            ) / 100;
          sizes.push(
            Math.abs(bounds.width - 64 * zoom),
            Math.abs(bounds.height - 32 * zoom),
          );
          const world = farm.querySelector<HTMLElement>("#farm-world")!;
          sizes.push(
            Math.abs(
              farm.scrollWidth - Math.max(farm.clientWidth, world.offsetWidth),
            ),
          );
        }
        observer.disconnect();
        return { writes, sizes };
      });
      expect(result.writes).toBe(0);
      expect(Math.max(...result.sizes)).toBeLessThanOrEqual(1);
      // Hit testing still reaches the tile after zooming down and back up.
      await page.locator('[data-service="home"]').tap();
      await expect(page.locator("#service-title")).toHaveText("Your tent");
    });

    test("panning replaces off-screen debris and brings it back", async ({
      page,
    }) => {
      await page.goto(`/?instance=validation-debris-culling-${viewport.width}`);
      await page.locator("#begin-farm").tap();
      const debris = () =>
        page
          .locator("canvas")
          .evaluate(
            (canvas) =>
              JSON.parse(canvas.dataset.sceneDebris!) as { id: string }[],
          );
      const initial = await debris();
      expect(initial.length).toBeGreaterThan(0);
      expect(initial.length).toBeLessThan(120);
      await setCameraCell(page, "row", "48");
      await setCameraCell(page, "column", "48");
      await expect
        .poll(async () => (await debris()).some((d) => d.id === initial[0].id))
        .toBe(false);
      await page.locator("#home-view").tap();
      await expect
        .poll(async () => (await debris()).some((d) => d.id === initial[0].id))
        .toBe(true);
    });
  });
}
