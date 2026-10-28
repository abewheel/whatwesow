import { choosePlotWork } from "./helpers";
import { test, expect, type Page } from "@playwright/test";

async function begin(page: Page, instance: string) {
  await page.goto(`/?instance=${instance}`);
  await page.locator("#begin-farm").tap();
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
}
async function tent(page: Page) {
  if (await page.locator("#farm-mode").isVisible())
    await page.locator("#farm-mode").tap();
  if (await page.locator("#close-service").isVisible())
    await page.locator("#close-service").tap();
  await page.locator('[data-service="home"]').tap();
  await expect(page.locator("#service-panel")).toBeVisible({ timeout: 20000 });
}
async function fits(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  );
  expect(box!.y + box!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height + 1,
  );
}
for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 667, height: 375 },
]) {
  test.describe(`touch phone ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });
    test("plants, builds and ends turns through anchored farm menus", async ({
      page,
    }) => {
      test.setTimeout(90000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("requestfailed", (r) =>
        errors.push(`${r.url()}: ${r.failure()?.errorText}`),
      );
      await begin(page, `validation-mobile-${viewport.width}`);
      await fits(page, ".hud-top");
      await page.locator("#coin-count").evaluate((e) => {
        e.textContent = "100,000";
      });
      const balance = (await page.locator(".coin-balance").boundingBox())!;
      const menu = (await page.locator("#open-menu").boundingBox())!;
      expect(balance.x + balance.width).toBeLessThanOrEqual(menu.x);

      expect(
        (await page.locator(".hud-top").boundingBox())!.height,
      ).toBeLessThan(75);
      await page.locator('[data-cell="16,16"]').tap();
      await page.locator("#expand").tap();
      await expect(page.locator("#improve")).toBeDisabled();
      await fits(page, "#service-panel");
      await fits(page, "#close-service");
      await page.locator('[data-crop="turnip"]').tap();
      await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
        "aria-label",
        /growing/,
      );
      await page.locator('[data-cell="12,18"]').tap();
      await page.locator('[data-build="home"]').tap();
      await expect(page.locator("#service-title")).toHaveText("Farmhouse");
      await expect(page.locator("#next-season")).toBeDisabled();
      await tent(page);
      await page.locator("#next-season").tap();
      await expect(page.locator("#season")).toContainText("summer");
      await page.locator("#close-service").tap();
      await page.locator('[data-plot="0"]').tap();
      await choosePlotWork(page);
      await expect(page.locator("#season")).toContainText("95 coins");
      await page.locator('[data-structure="1"]').press("Enter");
      await fits(page, "#service-panel");
      await page.locator("#move-building").tap();
      await page.locator('[data-cell="13,18"]').tap();
      await expect(page.locator('[data-cell="13,18"]')).toHaveAttribute(
        "data-structure",
        "1",
      );
      await expect(
        page.locator("#seed-selection,#end-turn,#build-shop"),
      ).toHaveCount(0);
      await page.locator("#camera-controls summary").tap();
      await fits(page, "#close-camera");
      await page.locator("#close-camera").tap();
      await expect(page.locator(".camera-panel")).toBeHidden();
      expect(errors).toEqual([]);
    });
  });
}

test.describe("phone forms and gestures", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  test("camera controls pan in four directions and clamp zoom at 50%", async ({
    page,
  }) => {
    await begin(page, "validation-mobile-camera");
    await page.getByLabel("View controls", { exact: true }).tap();
    await fits(page, ".camera-panel");
    await expect(page.locator("#view-row, #view-col, #go-to-cell")).toHaveCount(
      0,
    );
    const position = () =>
      page.locator("#farm").evaluate((e) => [e.scrollLeft, e.scrollTop]);
    const before = await position();
    await page.getByRole("button", { name: "Pan right", exact: true }).tap();
    expect((await position())[0]).toBeGreaterThan(before[0]);
    await page.getByRole("button", { name: "Pan left", exact: true }).tap();
    await page.getByRole("button", { name: "Pan down", exact: true }).tap();
    expect((await position())[1]).toBeGreaterThan(before[1]);
    await page.getByRole("button", { name: "Pan up", exact: true }).tap();
    expect(await position()).toEqual(before);
    await page.locator("#zoom-out").tap();
    await page.locator("#zoom-out").tap();
    await expect(page.locator("#zoom-level")).toHaveText("50%");
    await expect(page.locator("#zoom-out")).toBeDisabled();
    await page.locator("#farm").focus();
    await page.keyboard.press("-");
    await expect(page.locator("#zoom-level")).toHaveText("50%");
    await page.locator("#zoom-reset").tap();
    await expect(page.locator("#zoom-level")).toHaveText("100%");
    await page.locator("#zoom-in").tap();
    await expect(page.locator("#zoom-level")).toHaveText("125%");
    await page.locator("#close-camera").tap();
    await expect(page.locator(".camera-panel")).toBeHidden();
  });
  test("touch panning moves the estate without planting or scrolling the page", async ({
    page,
    context,
  }) => {
    await begin(page, "validation-mobile-pan");
    const before = await page
      .locator("#farm")
      .evaluate((e) => [e.scrollLeft, e.scrollTop]);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 195, y: 450 }],
    });
    for (let step = 1; step <= 8; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 195 - step * 12, y: 450 - step * 8 }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() => page.locator("#farm").evaluate((e) => e.scrollLeft))
      .not.toBe(before[0]);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator("#season")).toContainText("240 coins");
    await expect(page.locator("[data-plot]")).toHaveCount(0);
  });
  test("a failed seasonal save stays visible inside the open sheet and can be retried", async ({
    page,
  }) => {
    await begin(page, "validation-mobile-save-error");
    await tent(page);
    await page.evaluate(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        IDBObjectStore.prototype.put = put;
        this.transaction.abort();
        return put.apply(this, args);
      };
    });
    await page.locator("#next-season").tap();
    await expect(page.locator("#service-feedback")).toBeVisible();
    await expect(page.locator("#service-feedback")).toContainText(
      /abort|save|transaction/i,
    );
    await fits(page, "#service-feedback");
    await expect(page.locator("#season")).toContainText("spring");
    await page.locator("#next-season").tap();
    await expect(page.locator("#season")).toContainText("summer");
    await expect(page.locator("#service-feedback")).toBeHidden();
  });
  test("imports through the picker, reports invalid saves and exports a usable save", async ({
    page,
  }) => {
    await begin(page, "validation-mobile-save-form");
    await page.getByRole("button", { name: "Open farm menu" }).tap();
    await fits(page, "#farm-menu");
    let picker = page.waitForEvent("filechooser");
    await page.locator("#import-trigger").tap();
    await (
      await picker
    ).setFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
    await expect(page.locator("#save-status")).toContainText("version");
    await expect(page.locator("#season")).toContainText("240 coins");
    picker = page.waitForEvent("filechooser");
    await page.locator("#import-trigger").tap();
    await (
      await picker
    ).setFiles({
      name: "farm.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ version: 1, year: 4, season: "spring", coins: 777 }),
      ),
    });
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    const download = page.waitForEvent("download");
    await page.locator("#export").tap();
    const exported = await download;
    const stream = await exported.createReadStream();
    let json = "";
    for await (const chunk of stream!) json += chunk.toString();
    expect(JSON.parse(json)).toMatchObject({
      version: 3,
      year: 4,
      season: "spring",
      coins: 777,
    });
    await page.locator("#resume").tap();
    await page.reload();
    await expect(page.locator("#season")).toContainText("777 coins");
  });
});
