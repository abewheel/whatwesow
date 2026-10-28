import { test, expect, type Page } from "./fixtures";
import { homesteadState as initialState } from "../../src/game/state";

async function farPlot(page: Page, ripe = false) {
  await page.goto("/?instance=validation-arrival");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = initialState();
  state.plotCells[8] = { row: 22, col: 20 };
  state.plots[8] = ripe ? { crop: "turnip", growth: 1 } : null;
  await page.locator("#import").setInputFiles({
    name: "farm.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await expect(page.locator("[data-plot='8']")).toHaveAttribute(
    "data-cell",
    "22,20",
  );
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-motion",
    "idle",
  );
}

test("menus stay closed while approaching a building and open once at its entrance", async ({
  page,
}) => {
  await page.goto("/?instance=validation-menu-arrival");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await page.locator("[data-cell='20,20']").click();
  await expect(canvas).toHaveAttribute("data-farmer-cell", "20,20", {
    timeout: 20000,
  });
  await page.locator("[data-service=builder]").click();
  await expect(canvas).toHaveAttribute("data-farmer-motion", "walk");
  await expect(page.locator("#service-panel")).toBeHidden();
  await expect(page.locator("#service-panel")).toBeVisible({ timeout: 20000 });
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  const [row, col] = (await canvas.getAttribute("data-farmer-cell"))!
    .split(",")
    .map(Number);
  expect(
    (row === 10 && col >= 19 && col <= 21) ||
      (col === 22 && row >= 7 && row <= 9),
  ).toBe(true);
  await expect(page.locator("#service-title")).toHaveText("Builder's workshop");
});

test("planting spends seeds only after arrival and persists once", async ({
  page,
}) => {
  await farPlot(page);
  await page.locator("[data-plot='8']").click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await expect(page.locator("#season")).toContainText("100 coins");
  await expect(page.locator("[data-plot='8']")).toHaveAttribute(
    "aria-label",
    /empty/,
  );
  await expect(page.locator("[data-plot='8']")).toHaveAttribute(
    "aria-label",
    /Turnip, growing/,
    // This plot requires a full walk; software rendering on CI can be slower.
    { timeout: 30000 },
  );
  await expect(page.locator("#season")).toContainText("96 coins");
  const [row, col] = (await page
    .locator("canvas")
    .getAttribute("data-farmer-cell"))!
    .split(",")
    .map(Number);
  expect(Math.abs(row - 22) + Math.abs(col - 20)).toBe(1);
  await page.reload();
  await expect(page.locator("#season")).toContainText("96 coins");
  await expect(page.locator("[data-plot='8']")).toHaveAttribute(
    "aria-label",
    /Turnip, growing/,
  );
});

test("harvesting leaves the crop and balance intact until arrival", async ({
  page,
}) => {
  await farPlot(page, true);
  await page.locator("[data-plot='8']").click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await expect(page.locator("#season")).toContainText("100 coins");
  await expect(page.locator("[data-plot='8']")).toHaveAttribute(
    "aria-label",
    /ready to harvest/,
  );
  await expect(page.locator("[data-plot='8']")).toHaveAttribute(
    "aria-label",
    /empty/,
  );
  await expect(page.locator("#season")).toContainText("109 coins");
  await page.reload();
  await expect(page.locator("#season")).toContainText("109 coins");
});

test("redirecting or pressing Escape cancels unperformed plot work", async ({
  page,
}) => {
  await farPlot(page, true);
  await page.locator("[data-plot='8']").click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await page.locator("[data-cell='17,18']").click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-cell",
    "17,18",
    { timeout: 20000 },
  );
  await expect(page.locator("#season")).toContainText("100 coins");
  await expect(page.locator("[data-plot='8']")).toHaveAttribute(
    "aria-label",
    /ready to harvest/,
  );
  await farPlot(page);
  await page.locator("[data-plot='8']").click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-motion",
    "idle",
  );
  await expect(page.locator("#season")).toContainText("100 coins");
  await expect(page.locator("[data-plot='8']")).toHaveAttribute(
    "aria-label",
    /empty/,
  );
});

test("a canceled visit never opens a stale building menu", async ({ page }) => {
  await page.goto("/?instance=validation-canceled-visit");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await page.locator("[data-cell='20,20']").click();
  await expect(canvas).toHaveAttribute("data-farmer-cell", "20,20", {
    timeout: 20000,
  });
  await page.locator("[data-service=seeds]").click();
  await expect(page.locator("#service-panel")).toBeHidden();
  await page.locator("[data-cell='19,20']").click();
  await expect(canvas).toHaveAttribute("data-farmer-cell", "19,20", {
    timeout: 20000,
  });
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await expect(page.locator("#service-panel")).toBeHidden();
});

test("unreachable buildings do not open their menus", async ({ page }) => {
  await page.goto("/?instance=validation-unreachable-visit");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = initialState();
  // Block every entrance around the builder while leaving the service footprint clear.
  const cells = Array.from({ length: 3 }, (_, i) => [
    [6, 19 + i],
    [10, 19 + i],
    [7 + i, 18],
    [7 + i, 22],
  ]).flat();
  for (const [row, col] of cells)
    state.structures.push({
      id: state.nextStructureId++,
      kind: "oak",
      row,
      col,
      level: 1,
    });
  await page.locator("#import").setInputFiles({
    name: "farm.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await expect(page.locator("[data-service=builder]")).toHaveAttribute(
    "data-cell",
    "7,19",
  );
  // Wait until imported blockers are present.
  await expect(
    page.locator(`[data-structure="${state.nextStructureId - 1}"]`),
  ).toBeAttached();
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  await page.locator("[data-service=builder]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#farm-message")).toContainText("No walking path");
  await expect(page.locator("#service-panel")).toBeHidden();
});
