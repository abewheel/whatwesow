import { expect, type Page } from "@playwright/test";

export async function visitBuilding(
  page: Page,
  service: string,
  timeout = 20000,
) {
  // Closing with Escape does not scroll back from the playtest editor, which
  // can dismiss an anchored menu before a click on its close button lands.
  await page.keyboard.press("Escape");
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
  // A council meeting opens once the new season has been revealed.
  await expect(page.locator(".season-transition")).toHaveCount(0);
  await answerCouncil(page);
}
/** Answer a council meeting End turn opened: the first argument, and no to any deal. */
export async function answerCouncil(page: Page) {
  const dialog = page.locator("#crisis");
  if (!(await dialog.isVisible())) return;
  await dialog.locator(".crisis-card").first().click();
  const back = dialog.getByRole("button", { name: "Back to the farm" });
  await expect(back).toBeVisible();
  const no = dialog.getByRole("button", { name: "Say no" });
  if (await no.isVisible()) await no.click();
  await back.click();
  await expect(dialog).toBeHidden();
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

export async function buySeeds(
  page: Page,
  crop: string,
  quantity = 1,
  premium = false,
) {
  const close = page.locator("#close-service");
  if (await close.isVisible()) await close.click();
  await page.locator("#open-inventory").click();
  await page.locator("#open-seed-shop").click();
  const quality = page.locator(
    `[data-seed-quality="${premium ? "premium" : "regular"}"]`,
  );
  if (premium || (await quality.count())) await quality.click();
  await page.locator("#seed-quantity").fill(String(quantity));
  await page
    .locator(`[data-buy-${premium ? "premium" : "seed"}="${crop}"]`)
    .click();
  await page.locator("#close-service").click();
}
