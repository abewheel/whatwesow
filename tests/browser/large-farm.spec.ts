import { visitBuilding, setCameraCell } from "./helpers";
import { test, expect } from "@playwright/test";
test("uses the far corner of a 64-square farm with a viewport-sized canvas", async ({
  page,
}) => {
  test.setTimeout(180000);
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
  await setCameraCell(page, "row", "63");
  await setCameraCell(page, "column", "63");
  await page.getByRole("button", { name: "Go to land", exact: true }).click();
  await page.locator('[data-cell="63,63"]').click();
  await expect(page.locator("#season")).toContainText("100,036 coins", {
    timeout: 60000,
  });
  const dimensions = await page.locator("canvas").evaluate((el) => ({
    width: (el as HTMLCanvasElement).width,
    height: (el as HTMLCanvasElement).height,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(1280);
  expect(dimensions.height).toBeLessThanOrEqual(720);
  await visitBuilding(page, "seeds", 60000);
  await page.locator('[data-build="oak"]').click();
  await setCameraCell(page, "row", "63");
  await setCameraCell(page, "column", "63");
  await page.locator("#go-to-cell").click();
  await page.getByRole("button", { name: "Land 62,63", exact: true }).click();
  await expect(page.locator("#farm-message")).toContainText("Oak tree planted");
  await page.reload();
  await expect(page.locator('[data-cell="62,63"]')).toHaveAttribute(
    "data-structure",
    "3",
  );
  await expect(page.locator('[data-cell="63,63"]')).toHaveAttribute(
    "data-plot",
    "9",
  );
  expect(errors).toEqual([]);
});
