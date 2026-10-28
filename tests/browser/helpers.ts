import { expect, type Page } from "@playwright/test";

export async function visitBuilding(
  page: Page,
  service: string,
  timeout = 20000,
) {
  const cancel = page.locator("#farm-mode");
  if (await cancel.isVisible()) await cancel.click();
  const close = page.locator("#close-service");
  if (await close.isVisible()) await close.click();
  if (
    await page
      .locator("#camera-controls")
      .evaluate((el: HTMLDetailsElement) => el.open)
  )
    await page.locator("#camera-controls summary").click();
  const target =
    service === "home"
      ? page
          .locator("[data-structure]")
          .and(page.getByRole("button", { name: /^Farmhouse \d+, level/ }))
          .or(page.locator('[data-service="home"]'))
          .first()
      : page.locator(`[data-service="${service}"]`);
  await target.click();
  await expect(page.locator("#service-panel")).toBeVisible({ timeout });
}
export async function clickCamera(page: Page, selector: string) {
  await openCamera(page);
  await page.locator(selector).click();
}
export async function setCameraCell(
  page: Page,
  axis: "row" | "column",
  value: string,
) {
  await openCamera(page);
  await page.evaluate(
    ({ axis, value }) => {
      const farm = document.querySelector<HTMLElement>("#farm")!;
      farm.dataset[axis] = value;
      const row = farm.dataset.row ?? "16";
      const col = farm.dataset.column ?? "16";
      const cell = document.querySelector<HTMLElement>(
        `[data-cell="${row},${col}"]`,
      )!;
      const bounds = cell.getBoundingClientRect();
      const view = farm.getBoundingClientRect();
      farm.scrollBy(
        bounds.x + bounds.width / 2 - view.x - view.width / 2,
        bounds.y + bounds.height / 2 - view.y - view.height / 2,
      );
    },
    { axis, value },
  );
}
async function openCamera(page: Page) {
  if (
    !(await page
      .locator("#camera-controls")
      .evaluate((el: HTMLDetailsElement) => el.open))
  )
    await page.locator("#camera-controls summary").click();
}

export async function endTurn(page: Page) {
  await visitBuilding(page, "home", 60000);
  const button = page.locator("#next-season");
  const before = await button.textContent();
  await button.click();
  await expect(button).not.toHaveText(before!);
}

// Choose the work explicitly now that tapping a plot opens its actions.
export async function choosePlotWork(page: Page, crop = "turnip") {
  const actions = page.locator("#tile-actions");
  await expect(actions).toBeVisible();
  const harvest = actions.getByRole("button", {
    name: "Harvest crop",
    exact: true,
  });
  if (await harvest.isVisible()) {
    await harvest.click();
    return;
  }
  const plant = actions.locator(`[data-crop="${crop.toLowerCase()}"]`);
  if (await plant.isVisible()) await plant.click();
}
