import { test, expect } from "@playwright/test";
test("uses the far corner of a 128-square farm with a viewport-sized canvas", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(r.url()));
  await page.goto("/?instance=validation-expanded-farm");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.getByLabel("Starting point").selectOption("expanse");
  await page.getByRole("button", { name: "Load preset", exact: true }).click();
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await page.getByLabel("View row").fill("127");
  await page.getByLabel("View column").fill("127");
  await page.getByRole("button", { name: "Go to land", exact: true }).click();
  await page.locator('[data-cell="127,127"]').click();
  await expect(page.locator("#season")).toContainText("100,036 coins");
  const dimensions = await page.locator("canvas").evaluate((el) => ({
    width: (el as HTMLCanvasElement).width,
    height: (el as HTMLCanvasElement).height,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(1280);
  expect(dimensions.height).toBeLessThanOrEqual(720);
  await page.locator("#build-shop").evaluate((el: HTMLDetailsElement) => {
    el.open = true;
  });
  await page.locator('[data-build="oak"]').click();
  await page.getByRole("button", { name: "Land 126,127", exact: true }).click();
  await expect(page.locator("#farm-message")).toContainText("Oak tree built");
  await page.reload();
  await expect(page.locator('[data-cell="126,127"]')).toHaveAttribute(
    "data-structure",
    "3",
  );
  await expect(page.locator('[data-cell="127,127"]')).toHaveAttribute(
    "data-plot",
    "9",
  );
  expect(errors).toEqual([]);
});
