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
          .and(page.getByRole("button", { name: /^Farmhouse / }))
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
  await page.getByLabel(`View ${axis}`, { exact: true }).fill(value);
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
