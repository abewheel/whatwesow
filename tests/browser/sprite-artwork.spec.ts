import { openCanvasHarness } from "./canvas-harness";
import { test, expect } from "./fixtures";
import { visitBuilding } from "./helpers";
import { homesteadState } from "../../src/game/state";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test(`isolated artwork renders in farm controls at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("requestfailed", (r) => errors.push(r.url()));
    await page.goto(`/?instance=validation-artwork-${viewport.width}`);
    await expect
      .poll(
        async () =>
          (await page.locator("#begin-farm").isVisible()) ||
          (await page.getByLabel("Work on").isVisible()),
      )
      .toBe(true);
    if (await page.locator("#begin-farm").isVisible())
      await page.locator("#begin-farm").click();
    await page.getByLabel("Work on").selectOption("full");
    const editor = page.getByLabel("Game state JSON");
    const state = homesteadState();
    state.selfBuilt = true;
    state.season = "summer";
    await editor.fill(JSON.stringify(state));
    await page
      .getByRole("button", { name: "Apply state", exact: true })
      .click();
    await expect(page.locator("#dev-status")).toHaveText(
      "State applied and saved.",
    );
    await visitBuilding(page, "home");
    await page.evaluate(() => document.fonts.ready);
    const icons = await page
      .locator(".pixel-icon:visible")
      .evaluateAll(async (elements) => {
        return Promise.all(
          elements.map(async (element) => {
            const css = getComputedStyle(element);
            const url = css.backgroundImage.slice(5, -2);
            const image = new Image();
            image.src = url;
            await image.decode();
            return {
              url,
              width: image.naturalWidth,
              height: image.naturalHeight,
              size: css.backgroundSize,
            };
          }),
        );
      });
    expect(icons.length).toBeGreaterThan(3);
    for (const icon of icons) {
      expect(icon.url).toContain("/art/icons/");
      expect(icon.width).toBe(icon.height);
      expect(icon.size).toBe("contain");
    }
    await page.screenshot({
      path: testInfo.outputPath(`controls-${viewport.width}.png`),
    });
    await page.locator("#close-service").click();
    const destination = viewport.height < 400 ? "15,20" : "20,20";
    await page.locator(`[data-cell="${destination}"]`).click();
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-motion",
      "walk",
    );
    await page.screenshot({
      path: testInfo.outputPath(`walking-${viewport.width}.png`),
    });
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-motion",
      "idle",
    );
    expect(errors).toEqual([]);
  });
}

test("crossing silhouettes stay whole and cannot leak into the next frame", async ({
  page,
}) => {
  await openCanvasHarness(page);
  const samples = await page.evaluate(async () => {
    const modulePath = "/src/game/atlas-isolation.ts";
    const { isolateAtlas, gridFrames } = await import(
      /* @vite-ignore */ modulePath
    );
    const source = document.createElement("canvas");
    source.width = 120;
    source.height = 60;
    const context = source.getContext("2d")!;
    // Red crosses the nominal 60px cell boundary, blue stays in the next cell.
    context.fillStyle = "red";
    context.fillRect(10, 10, 54, 40);
    context.fillStyle = "blue";
    context.fillRect(80, 10, 30, 40);
    const isolated = isolateAtlas(source, gridFrames(120, 60, 2, 1));
    const pixels = isolated.getContext("2d")!.getImageData(0, 0, 120, 60).data;
    let red = 0,
      blue = 0,
      leaked = 0;
    for (let y = 0; y < 60; y++)
      for (let x = 0; x < 120; x++) {
        const offset = (y * 120 + x) * 4;
        if (!pixels[offset + 3]) continue;
        if (pixels[offset]) {
          red++;
          if (x >= 60) leaked++;
        }
        if (pixels[offset + 2]) {
          blue++;
          if (x < 60) leaked++;
        }
      }
    return { red, blue, leaked };
  });
  expect(samples).toEqual({ red: 54 * 40, blue: 30 * 40, leaked: 0 });
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test(`book stays centered when opening the farm menu at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const button = page.locator("#open-menu");
    await button.scrollIntoViewIfNeeded();
    const offset = () =>
      button.evaluate((element) => {
        const outer = element.getBoundingClientRect();
        const inner = element
          .querySelector(".pixel-icon")!
          .getBoundingClientRect();
        return { x: inner.x - outer.x, y: inner.y - outer.y };
      });
    const before = await offset();
    await button.click();
    await expect(page.locator("#farm-menu")).toBeVisible();
    expect(await offset()).toEqual(before);
  });
}
