import { expect, test } from "./fixtures";
import { clickCamera } from "./helpers";

test("building hover follows its complete footprint across cells and zoom", async ({
  page,
}) => {
  await page.goto("/?instance=validation-footprint-hover");
  const preview = page.locator("#placement-preview");
  const tooltip = page.getByRole("tooltip");
  for (const cell of ["7,14", "7,15", "8,14", "8,15"]) {
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
    ).toEqual({ left: "2464px", top: "480px", width: "128px", height: "64px" });
    await expect(page.locator(`[data-cell="${cell}"]`)).not.toHaveAttribute(
      "title",
    );
  }
  await clickCamera(page, "#zoom-out");
  await page.locator("#camera-controls summary").click();
  await page.locator('[data-cell="8,15"]').hover();
  expect(await preview.evaluate((el) => el.style.width)).toBe("96px");
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
  for (const [cell, row] of [
    ["20,20", 0],
    ["14,14", 1],
  ] as const) {
    await page.locator(`[data-cell="${cell}"]`).click();
    await expect(canvas).toHaveAttribute("data-farmer-motion", "walk");
    const frames = new Set<string>();
    for (let i = 0; i < 18; i++) {
      const frame = (await canvas.getAttribute("data-farmer-frame"))!;
      expect(frame).toMatch(/^farmer-walk:/);
      expect(Math.floor(Number(frame.split(":")[1]) / 6)).toBe(row);
      frames.add(frame);
      await page.waitForTimeout(35);
    }
    expect(frames.size).toBeGreaterThanOrEqual(4);
    await expect(canvas).toHaveAttribute("data-farmer-cell", cell);
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
