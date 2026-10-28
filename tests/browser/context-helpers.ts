import { expect, type Page } from "@playwright/test";
export async function closeActions(page: Page) {
  if (await page.locator("#close-service").isVisible())
    await page.locator("#close-service").click();
  if (await page.locator("#farm-mode").isVisible())
    await page.locator("#farm-mode").click();
  if (
    await page
      .locator("#camera-controls")
      .evaluate((e: HTMLDetailsElement) => e.open)
  )
    await page.locator("#close-camera").click();
}
export async function openCell(page: Page, cell: string) {
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  await closeActions(page);
  await page.locator(`[data-cell="${cell}"]`).press("Enter");
  await expect(page.locator("#service-panel")).toBeVisible();
}
export async function buildAt(page: Page, kind: string, cell: string) {
  await openCell(page, cell);
  await page.locator(`[data-build="${kind}"]`).click();
  await expect(page.locator("#farm-message")).toContainText(/started|planted/);
}
export async function loadPreset(page: Page, id: string) {
  await closeActions(page);
  await page.getByLabel("Work on").selectOption("full");
  await page.getByLabel("Starting point").selectOption(id);
  await page.getByRole("button", { name: "Load preset", exact: true }).click();
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
}
export async function readFarm(page: Page) {
  await page.getByLabel("Work on").selectOption("full");
  await page
    .getByRole("button", { name: "Read current state", exact: true })
    .click();
  return JSON.parse(await page.getByLabel("Game state JSON").inputValue());
}
export async function setFarm(page: Page, state: unknown) {
  await page.getByLabel("Work on").selectOption("full");
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
}
export async function fits(page: Page, selector = "#service-panel") {
  const box = (await page.locator(selector).boundingBox())!,
    viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}
