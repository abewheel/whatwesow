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
  await choosePlotWork(page);
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /empty/,
  );
});
