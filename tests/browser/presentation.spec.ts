import { WORLD_TOP, project, TILE_WIDTH } from "../../src/game/layout";
import { expect, test } from "./fixtures";
import { clickCamera } from "./helpers";

test("building hover follows its complete footprint across cells and zoom", async ({
  page,
}) => {
  await page.goto("/?instance=validation-footprint-hover");
  const preview = page.locator("#placement-preview");
  const tooltip = page.getByRole("tooltip");
  for (const cell of Array.from(
    { length: 9 },
    (_, i) => `${7 + Math.floor(i / 3)},${14 + (i % 3)}`,
  )) {
    await page.locator(`[data-cell="${cell}"]`).hover();
    await expect(preview).toBeVisible();
    await expect(tooltip).toHaveText("Seed shop & nursery");
    await expect(preview).toHaveAttribute("data-mode", "hover");
    expect(
      await preview.evaluate((el) => ({
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
      })),
    ).toEqual({
      left: "2432px",
      top: `${WORLD_TOP + 320}px`,
      width: "192px",
      height: "96px",
    });
    await expect(page.locator(`[data-cell="${cell}"]`)).not.toHaveAttribute(
      "title",
    );
  }
  await clickCamera(page, "#zoom-out");
  await page.locator("#camera-controls summary").click();
  await page.locator('[data-cell="8,15"]').hover();
  expect(await preview.evaluate((el) => el.style.width)).toBe("144px");
  await page.locator('[data-cell="20,20"]').hover();
  await expect(preview).toBeHidden();
  await expect(tooltip).toBeHidden();
});

test("walking uses changing gait frames in both directions and returns to idle", async ({
  page,
}) => {
  await page.goto("/?instance=validation-gait");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  for (const cell of ["20,20", "14,14"]) {
    await page.locator(`[data-cell="${cell}"]`).click();
    await expect(canvas).toHaveAttribute("data-farmer-motion", "walk");
    const frames = new Set<string>();
    // Observe actual rendered frames instead of assuming CI paints 18 times
    // in 630ms. Software rendering can be much slower than a desktop GPU.
    await expect
      .poll(
        async () => {
          const frame = (await canvas.getAttribute("data-farmer-frame"))!;
          expect(frame).toMatch(/^farmer-gait:[0-7]$/);
          frames.add(frame);
          return frames.size;
        },
        { intervals: [35] },
      )
      .toBeGreaterThanOrEqual(4);
    await expect(canvas).toHaveAttribute("data-farmer-cell", cell, {
      timeout: 30000,
    });
    await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
    await expect(canvas).toHaveAttribute("data-farmer-frame", /^farmer:/);
  }
});

test("idle breathing keeps a stable pose and respects reduced motion", async ({
  page,
}) => {
  await page.goto("/?instance=validation-idle");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  const scales: number[] = [];
  for (let i = 0; i < 12; i++) {
    await expect(canvas).toHaveAttribute("data-farmer-frame", "farmer:42");
    scales.push(Number(await canvas.getAttribute("data-farmer-scale-y")));
    await page.waitForTimeout(100);
  }
  expect(Math.max(...scales) - Math.min(...scales)).toBeGreaterThan(0.0005);
  expect(Math.max(...scales) - Math.min(...scales)).toBeLessThan(0.006);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-farmer-scale-y")))
    .toBe(58 / 181);
});

test("farmer sorts ahead of both farmhouse front edges and behind its rear", async ({
  page,
}) => {
  await page.goto("/?instance=validation-farmer-depth");
  // Keyboard events must wait until the startup cover releases the farm.
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  // Both side paths have smaller screen y than the farmhouse front, so sorting
  // by feet alone would hide the farmer. Account for camera padding separately.
  const homeFront = WORLD_TOP + project(16.5, 12.5).y * (64 / TILE_WIDTH);
  for (const cell of ["13,15", "12,17", "10,15"]) {
    await page.locator(`[data-cell="${cell}"]`).press("Enter");
    await expect(canvas).toHaveAttribute("data-farmer-cell", cell);
    await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
    const depth = Number(await canvas.getAttribute("data-farmer-depth"));
    if (cell === "10,15") expect(depth).toBeLessThan(homeFront);
    else expect(depth).toBeGreaterThan(homeFront);
  }
});
