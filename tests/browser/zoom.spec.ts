import { visitBuilding, endTurn, clickCamera, setCameraCell } from "./helpers";
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
test("farming, multi-cell building previews and distant placements work at both zoom extremes", async ({
  page,
}) => {
  // This path includes travel across the estate at both zoom limits and a reload.
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(r.url()));
  await page.goto("/?instance=validation-zoom-interactions");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  for (let i = 0; i < 2; i++) await clickCamera(page, "#zoom-out");
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("#season")).toContainText("96 coins");
  await endTurn(page);
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("#season")).toContainText("105 coins");
  await clickCamera(page, "#zoom-reset");
  for (let i = 0; i < 3; i++) await clickCamera(page, "#zoom-in");
  await page.getByLabel("Work on").selectOption("micro");
  await page.getByRole("button", { name: "Read current state" }).click();
  const farm = JSON.parse(
    await page.getByLabel("Game state JSON").inputValue(),
  );
  farm.harvests.turnip = 3;
  await page.getByLabel("Game state JSON").fill(JSON.stringify(farm));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await visitBuilding(page, "builder");
  await page.locator('[data-build="shed"]').click();
  await page.locator('[data-cell="14,18"]').hover();
  await expect(page.locator("#placement-preview")).toHaveAttribute(
    "data-valid",
    "true",
  );
  await expect(page.locator("#placement-preview")).toHaveCSS("width", "384px");
  await page.locator('[data-cell="14,18"]').click();
  await expect(page.locator("#season")).toContainText("45 coins");
  await visitBuilding(page, "seeds");
  await page.locator('[data-build="oak"]').click();
  await page.locator('[data-cell="14,18"]').hover();
  await expect(page.locator("#placement-preview")).toHaveAttribute(
    "data-valid",
    "false",
  );
  await setCameraCell(page, "row", "63");
  await setCameraCell(page, "column", "63");
  await page.locator('[data-cell="63,63"]').click();
  await expect(page.locator("#farm-message")).toContainText("Oak tree planted");
  await expect(page.locator("#season")).toContainText("30 coins");
  const size = await page.locator("canvas").evaluate((el) => ({
    width: (el as HTMLCanvasElement).width,
    height: (el as HTMLCanvasElement).height,
  }));
  expect(size.width).toBeLessThanOrEqual(1280);
  expect(size.height).toBeLessThanOrEqual(720);
  await page.reload();
  await expect(page.locator("#zoom-level")).toHaveText("100%");
  await expect(page.locator('[data-cell="63,63"]')).toHaveAttribute(
    "data-structure",
    "3",
  );
  expect(errors).toEqual([]);
});
