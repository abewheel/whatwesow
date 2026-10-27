import { test, expect } from "@playwright/test";
test("zoom controls preserve a centered land cell and clamp at their limits", async ({
  page,
}) => {
  await page.goto("/?instance=validation-zoom-controls");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.getByLabel("View row").fill("64");
  await page.getByLabel("View column").fill("64");
  await page.locator("#go-to-cell").click();
  const target = page.locator('[data-cell="64,64"]'),
    before = await target.boundingBox();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator("#zoom-level")).toHaveText("125%");
  const after = await target.boundingBox();
  expect(
    Math.abs(before!.x + before!.width / 2 - after!.x - after!.width / 2),
  ).toBeLessThan(2);
  expect(
    Math.abs(before!.y + before!.height / 2 - after!.y - after!.height / 2),
  ).toBeLessThan(2);
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator("#zoom-level")).toHaveText("200%");
  await expect(
    page.getByRole("button", { name: "Zoom in", exact: true }),
  ).toBeDisabled();
  await page.locator("#farm").focus();
  await page.keyboard.press("+");
  await expect(page.locator("#zoom-level")).toHaveText("200%");
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(page.locator("#zoom-level")).toHaveText("25%");
  await expect(
    page.getByRole("button", { name: "Zoom out", exact: true }),
  ).toBeDisabled();
  await page.locator("#farm").focus();
  await page.keyboard.press("0");
  await expect(page.locator("#zoom-level")).toHaveText("100%");
  await expect(page.locator("#season")).toContainText("100 coins");
});
test("farming, multi-cell building previews and distant placements work at both zoom extremes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(r.url()));
  await page.goto("/?instance=validation-zoom-interactions");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  for (let i = 0; i < 3; i++) await page.locator("#zoom-out").click();
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("#season")).toContainText("96 coins");
  await page.locator("#grow").click();
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("#season")).toContainText("105 coins");
  await page.locator("#zoom-reset").click();
  for (let i = 0; i < 3; i++) await page.locator("#zoom-in").click();
  await page.locator("#build-shop summary").click();
  await page.locator('[data-build="shed"]').click();
  await page.locator('[data-cell="14,18"]').hover();
  await expect(page.locator("#placement-preview")).toHaveAttribute(
    "data-valid",
    "true",
  );
  await expect(page.locator("#placement-preview")).toHaveCSS("width", "256px");
  await page.locator('[data-cell="14,18"]').click();
  await expect(page.locator("#season")).toContainText("45 coins");
  await page.locator("#build-shop").evaluate((el: HTMLDetailsElement) => {
    el.open = true;
  });
  await page.locator('[data-build="oak"]').click();
  await page.locator('[data-cell="14,18"]').hover();
  await expect(page.locator("#placement-preview")).toHaveAttribute(
    "data-valid",
    "false",
  );
  await page.getByLabel("View row").fill("127");
  await page.getByLabel("View column").fill("127");
  await page.locator("#go-to-cell").click();
  await page.locator('[data-cell="127,127"]').click();
  await expect(page.locator("#farm-message")).toContainText("Oak tree built");
  await expect(page.locator("#season")).toContainText("30 coins");
  const size = await page.locator("canvas").evaluate((el) => ({
    width: (el as HTMLCanvasElement).width,
    height: (el as HTMLCanvasElement).height,
  }));
  expect(size.width).toBeLessThanOrEqual(1280);
  expect(size.height).toBeLessThanOrEqual(720);
  await page.reload();
  await expect(page.locator("#zoom-level")).toHaveText("100%");
  await expect(page.locator('[data-cell="127,127"]')).toHaveAttribute(
    "data-structure",
    "3",
  );
  expect(errors).toEqual([]);
});
