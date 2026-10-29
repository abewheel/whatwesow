import { openCell } from "./context-helpers";
import { test as farmTest } from "./fixtures";
import { homesteadState } from "../../src/game/state";
import { footprint, cellKey, structureSize } from "../../src/micro/world";
import { setCameraCell } from "./helpers";
import { buySeeds } from "./helpers";
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
  await expect(page.locator(selector)).toBeVisible();
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

      const view = (await page
        .locator("#camera-controls > summary")
        .boundingBox())!;
      const shop = (await page.locator("#open-actions").boundingBox())!;
      expect(shop.y + shop.height - view.y).toBeLessThan(120);
      await fits(page, ".field-note");
      await buySeeds(page, "turnip");
      await openCell(page, "16,16");
      await page.locator("#expand").tap();
      await expect(page.locator("#improve")).toHaveCount(0);
      await fits(page, "#service-panel");
      await fits(page, "#close-service");
      await page.locator('[data-crop="turnip"]').tap();
      await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
        "aria-label",
        /growing/,
      );
      await openCell(page, "12,18");
      await page.locator('[data-build="home"]').tap();
      await page.locator('[data-cell="12,18"]').press("Enter");
      await expect(page.locator("#service-title")).toHaveText("Farmhouse");
      await expect(page.locator("#next-season")).toBeDisabled();
      await tent(page);
      await page.locator("#farm-upgrades").tap();
      await expect(page.locator("#improve")).toBeDisabled();
      await expect(page.locator("#improve .soil-status")).toHaveText(
        "Harvest 3 crops",
      );
      await fits(page, "#service-panel");
      await page.locator("#back-home").tap();
      await page.locator("#next-season").tap();
      await expect(page.locator("#season")).toContainText("summer");
      await page.locator("#close-service").tap();
      await page.locator('[data-plot="0"]').tap();
      await expect(page.locator("#season")).toContainText("95 coins");
      await page.locator('[data-structure="1"]').press("Enter");
      await fits(page, "#service-panel");
      await expect(page.locator("#move-building")).toHaveCount(0);
      await page.locator("#teardown-building").tap();
      await page.locator("#confirm-delete").click();
      await expect(
        page.locator('[data-structure="1"]').first(),
      ).toHaveAttribute("aria-label", /tear.?down|demoli|remov/i);
      await page.locator("#close-service").tap();
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
  test("reuses the farm while panning inside the cached margin", async ({
    page,
  }) => {
    await begin(page, "validation-mobile-pan-cache");
    const canvas = page.locator("#farm canvas");
    await expect(canvas).toHaveAttribute("data-farm-draws", /[1-9]/);
    const settleScroll = () =>
      page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
    await settleScroll();
    const before = Number(await canvas.getAttribute("data-farm-draws"));
    await page.locator("#farm").evaluate((farm) => {
      farm.scrollLeft += 80;
    });
    await settleScroll();
    expect(Number(await canvas.getAttribute("data-farm-draws"))).toBe(before);
    await page.locator("#farm").evaluate((farm) => {
      farm.scrollLeft += 300;
    });
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-farm-draws")))
      .toBeGreaterThan(before);
    await page.getByLabel("View controls", { exact: true }).tap();
    await page.locator("#zoom-in").tap();
    await expect(page.locator("#zoom-level")).toHaveText("125%");
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-farm-draws")))
      .toBeGreaterThan(before + 1);
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

farmTest.describe("immediate touch selection", () => {
  farmTest.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  farmTest(
    "highlights a tile and the complete building lot in the tap event before arrival",
    async ({ page }) => {
      await page.goto("/?instance=validation-immediate-selection");
      await expect(page.locator("main")).toHaveJSProperty("inert", false);
      const home = homesteadState().structures[0];
      for (const { cell, cells, selector } of [
        {
          cell: { row: 20, col: 20 },
          cells: ["20,20"],
          selector: "[data-selected]",
        },
        {
          cell: home,
          selector: "[data-context]",
          cells: footprint(
            home,
            structureSize(home).width,
            structureSize(home).height,
          ).map(cellKey),
        },
      ]) {
        await page.keyboard.press("Escape");
        await setCameraCell(page, "row", String(cell.row));
        await setCameraCell(page, "column", String(cell.col));
        await page.locator("#camera-controls summary").tap();
        // Observe synchronously after the application's click handlers. An eventual
        // locator assertion could pass after arrival and miss delayed feedback.
        await page.evaluate((selector) => {
          document.addEventListener(
            "click",
            () => {
              const selected = [
                ...document.querySelectorAll<HTMLElement>(selector),
              ];
              (window as Window & { selectionAtTap?: unknown }).selectionAtTap =
                {
                  cells: selected.map((el) => el.dataset.cell).sort(),
                  menuHidden:
                    document.querySelector<HTMLElement>("#service-panel")!
                      .hidden,
                  visibleHighlight:
                    selected.length > 0 &&
                    selected.every(
                      (el) =>
                        getComputedStyle(el).backgroundColor !==
                        "rgba(0, 0, 0, 0)",
                    ),
                  nativeHighlight: selected.length
                    ? getComputedStyle(selected[0]).getPropertyValue(
                        "-webkit-tap-highlight-color",
                      )
                    : null,
                };
            },
            { once: true },
          );
        }, selector);
        await page.locator(`[data-cell="${cellKey(cell)}"]`).tap();
        const atTap = await page.evaluate(
          () =>
            (window as Window & { selectionAtTap?: unknown }).selectionAtTap,
        );
        expect(atTap).toEqual({
          cells: [...cells].sort(),
          menuHidden: true,
          visibleHighlight: true,
          nativeHighlight: "rgba(0, 0, 0, 0)",
        });
      }
    },
  );
});
