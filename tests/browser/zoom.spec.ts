import { buySeeds } from "./helpers";
import { choosePlotWork } from "./helpers";
import { endTurn, clickCamera, setCameraCell } from "./helpers";
import { test, expect } from "./fixtures";
test("zoom controls preserve a centered land cell and clamp at their limits", async ({
  page,
}) => {
  await page.goto("/?instance=validation-zoom-controls");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await setCameraCell(page, "row", "32");
  await setCameraCell(page, "column", "32");
  const target = page.locator('[data-cell="32,32"]');
  // Development tools make the outer page scrollable. The camera invariant is
  // the land cell's position inside the farm, independent of document scrolling.
  const centerInFarm = () =>
    target.evaluate((cell) => {
      const bounds = cell.getBoundingClientRect();
      const farm = document.querySelector("#farm")!.getBoundingClientRect();
      return {
        x: bounds.x + bounds.width / 2 - farm.x,
        y: bounds.y + bounds.height / 2 - farm.y,
      };
    });
  const before = await centerInFarm();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator("#zoom-level")).toHaveText("125%");
  const after = await centerInFarm();
  expect(Math.abs(before.x - after.x)).toBeLessThan(2);
  expect(Math.abs(before.y - after.y)).toBeLessThan(2);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const settled = await centerInFarm();
  expect(Math.abs(before.x - settled.x)).toBeLessThan(2);
  expect(Math.abs(before.y - settled.y)).toBeLessThan(2);
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator("#zoom-level")).toHaveText("200%");
  await expect(
    page.getByRole("button", { name: "Zoom in", exact: true }),
  ).toBeDisabled();
  await page.locator("#farm").focus();
  await page.keyboard.press("+");
  await expect(page.locator("#zoom-level")).toHaveText("200%");
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(page.locator("#zoom-level")).toHaveText("50%");
  await expect(
    page.getByRole("button", { name: "Zoom out", exact: true }),
  ).toBeDisabled();
  await page.locator("#farm").focus();
  await page.keyboard.press("0");
  await expect(page.locator("#zoom-level")).toHaveText("100%");
  await expect(page.locator("#season")).toContainText("100 coins");
});
test("context menus stay attached and usable at both zoom extremes", async ({
  page,
}) => {
  await page.goto("/?instance=validation-context-zoom");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await buySeeds(page, "turnip");
  for (let i = 0; i < 2; i++) await clickCamera(page, "#zoom-out");
  await page.locator("#close-camera").click();
  await page.locator('[data-plot="0"]').press("Enter");
  await choosePlotWork(page);
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /growing/,
  );
  await endTurn(page);
  await page.locator("#close-service").click();
  await clickCamera(page, "#zoom-reset");
  for (let i = 0; i < 3; i++) await clickCamera(page, "#zoom-in");
  await page.locator("#close-camera").click();
  await page.locator('[data-plot="0"]').press("Enter");
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /empty/,
  );
});

test("wheel zoom is continuous, anchored and bounded", async ({ page }) => {
  await page.goto("/?instance=validation-wheel");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await expect(page.locator("#startup")).toBeHidden();
  const farm = page.locator("#farm");
  const before = await farm.evaluate((el) => ({
    left: el.scrollLeft,
    width: document.querySelector("#farm-world")!.clientWidth,
  }));
  await page.mouse.move(400, 350);
  await page.mouse.wheel(0, -120);
  await expect
    .poll(() => page.locator("#zoom-level").textContent())
    .toBe("127%");
  const after = await farm.evaluate((el) => ({
    left: el.scrollLeft,
    width: document.querySelector("#farm-world")!.clientWidth,
  }));
  const bounds = (await farm.boundingBox())!;
  expect(
    Math.abs(
      (before.left + 400 - bounds.x) / before.width -
        (after.left + 400 - bounds.x) / after.width,
    ),
  ).toBeLessThan(0.001);
  await page.mouse.wheel(0, 10000);
  await expect(page.locator("#zoom-level")).toHaveText("50%");
  await page.mouse.wheel(0, -10000);
  await expect(page.locator("#zoom-level")).toHaveText("200%");
});

test("native pinch zoom preserves the farm without activating cells", async ({
  browser,
  baseURL,
}) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 667, height: 375 },
  ]) {
    const context = await browser.newContext({
      baseURL,
      viewport,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto("/?instance=validation-pinch");
    await page.locator("#begin-farm").click();
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    const cdp = await context.newCDPSession(page);
    const y = Math.round(viewport.height * 0.65);
    const x = Math.round(viewport.width / 2);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: x - 40, y, id: 1 },
        { x: x + 40, y, id: 2 },
      ],
    });
    for (let step = 1; step <= 8; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: x - 40 - step * 4, y, id: 1 },
          { x: x + 40 + step * 4, y, id: 2 },
        ],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.locator("#zoom-level")).toHaveText("180%");
    await expect(page.locator("#season")).toContainText("240 coins");
    expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
    await context.close();
  }
});

test("wheel zoom during a mouse drag keeps subsequent panning continuous", async ({
  page,
}) => {
  await page.goto("/?instance=validation-drag-zoom");
  await expect(page.locator("#startup")).toBeHidden();
  const initialWidth = await page
    .locator("#farm-world")
    .evaluate((el) => el.clientWidth);
  await page.mouse.move(400, 350);
  await page.mouse.down();
  await page.mouse.move(430, 370);
  await page.mouse.wheel(0, -120);
  await expect(page.locator("#zoom-level")).toHaveText("127%");
  // Wait for the interpolation to reach its exact target, beyond rounded output.
  await expect
    .poll(() =>
      page.locator("#farm-world").evaluate((el) => parseFloat(el.style.width)),
    )
    .toBeCloseTo(initialWidth * Math.exp(0.24), 2);
  const before = await page
    .locator("#farm")
    .evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }));
  await page.mouse.move(450, 380);
  const after = await page
    .locator("#farm")
    .evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }));
  await page.mouse.up();
  expect(Math.abs(after.x - before.x + 20)).toBeLessThan(2);
  expect(Math.abs(after.y - before.y + 10)).toBeLessThan(2);
});
