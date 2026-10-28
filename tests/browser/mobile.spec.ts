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
    test("uses every farm service, plants, builds and advances with readable menus", async ({
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
      expect(
        (await page.locator(".hud-top").boundingBox())!.height,
      ).toBeLessThan(75);
      await tent(page);
      await fits(page, "#service-panel");
      await fits(page, "#close-service");
      await expect(page.locator("#next-season")).toBeInViewport();
      await page
        .getByRole("button", { name: "Prepare fields", exact: true })
        .tap();
      await expect(page.locator("#improve")).toBeDisabled();
      await expect(page.locator("#improve")).toContainText("+3 / harvest");
      await expect(page.locator("#soil-status")).toHaveText("Harvest 3 crops");
      await page.locator("#expand").tap();
      await page.locator('[data-cell="16,16"]').tap();
      await expect(page.locator("[data-plot]")).toHaveCount(1);
      await page.locator("#farm-mode").tap();
      await page.getByRole("button", { name: "Open seed basket" }).tap();
      await expect(page.locator("#service-panel")).toBeVisible();
      await expect(
        page.locator('[data-crop="turnip"] .control-detail'),
      ).toContainText("1 season to grow");
      await fits(page, '[data-crop="turnip"]');
      await page.locator('[data-crop="turnip"]').tap();
      await page.locator('[data-plot="0"]').tap();
      await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
        "aria-label",
        /growing/,
      );
      await tent(page);
      await page
        .getByRole("button", { name: "Build your house", exact: true })
        .tap();
      await expect(page.locator('[data-build="home"]')).toContainText(
        "Your home",
      );
      await expect(page.locator('[data-build="home"]')).toContainText(
        "Next season",
      );
      await fits(page, '[data-build="home"]');
      await page.locator('[data-build="home"]').tap();
      await page.locator('[data-cell="12,18"]').tap();
      await expect(page.locator("#farm-message")).toContainText(
        "construction started",
      );
      await tent(page);
      await page.locator("#next-season").tap();
      await expect(page.locator("#season")).toContainText("summer");
      await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
        "aria-label",
        /ready/,
      );
      await page.locator("#close-service").tap();
      await page.locator('[data-plot="0"]').tap();
      await expect(page.locator("#season")).toContainText("95 coins");
      await page.locator('[data-structure="1"]').tap();
      await expect(page.locator("#service-panel")).toBeVisible();
      await page
        .getByRole("button", { name: "Building plans", exact: true })
        .tap();
      await page.locator("#structure-target").selectOption("1");
      await page.locator("#move-building").tap();
      await page.locator('[data-cell="13,18"]').tap();
      await expect(page.locator('[data-cell="13,18"]')).toHaveAttribute(
        "data-structure",
        "1",
      );
      await expect(page.locator("#season")).toContainText("95 coins");
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
  test("validates coordinates, submits with Enter and keeps zoom working", async ({
    page,
  }) => {
    await begin(page, "validation-mobile-coordinate-form");
    await page.locator("#camera-controls summary").tap();
    await fits(page, ".camera-panel");
    await page.locator("#view-row").fill("");
    await page.locator("#view-col").fill("9");
    const before = await page
      .locator("#farm")
      .evaluate((e) => [e.scrollLeft, e.scrollTop]);
    await page.locator("#view-col").press("Enter");
    await expect(page.locator("#camera-error")).toHaveText(
      "Enter a row and column from 0 to 63.",
    );
    expect(
      await page.locator("#farm").evaluate((e) => [e.scrollLeft, e.scrollTop]),
    ).toEqual(before);
    for (const invalid of ["64", "-1", "12.5"]) {
      await page.locator("#view-row").fill(invalid);
      await page.locator("#go-to-cell").tap();
      await expect(page.locator("#view-row")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    }
    await page.locator("#view-row").fill("63");
    await page.locator("#view-col").fill("63");
    await page.locator("#view-col").press("Enter");
    await expect(page.locator("#camera-error")).toBeHidden();
    await expect(page.locator('[data-cell="63,63"]')).toBeAttached();
    await page.locator("#home-view").tap();
    await page.locator("#zoom-in").tap();
    await expect(page.locator("#zoom-level")).toHaveText("125%");
    await page.locator("#zoom-reset").tap();
    await expect(page.locator("#zoom-level")).toHaveText("100%");
  });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
  ]) {
    test(`keeps coordinate inputs and close control above the keyboard at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await begin(page, `validation-mobile-keyboard-${viewport.width}`);
      await page.locator("#camera-controls summary").tap();
      await page.locator("#view-row").focus();
      await page.evaluate(() => {
        Object.defineProperty(window.visualViewport, "height", {
          configurable: true,
          get: () => 400,
        });
        window.visualViewport!.dispatchEvent(new Event("resize"));
      });
      await expect
        .poll(async () => {
          const b = (await page.locator(".camera-panel").boundingBox())!;
          return b.y + b.height;
        })
        .toBeLessThanOrEqual(400);
      await fits(page, ".camera-panel");
      await page.locator("#view-col").scrollIntoViewIfNeeded();
      const input = (await page.locator("#view-col").boundingBox())!;
      expect(input.y + input.height).toBeLessThanOrEqual(400);
      const close = (await page.locator("#close-camera").boundingBox())!;
      expect(close.y + close.height).toBeLessThanOrEqual(400);
      await page.locator("#view-row").fill("20");
      await page.locator("#view-col").fill("21");
      await page.locator("#view-col").press("Enter");
      await expect(page.locator("#camera-error")).toBeHidden();
      await page.locator("#close-camera").tap();
      await expect(page.locator(".camera-panel")).toBeHidden();
    });
  }
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
