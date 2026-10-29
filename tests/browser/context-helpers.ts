import { expect, type Page } from "@playwright/test";
export async function closeActions(page: Page) {
  // Escape also cancels placement and View controls without scrolling the page.
  await page.keyboard.press("Escape");
}

export async function openCell(page: Page, cell: string) {
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  await closeActions(page);
  const target = page.locator(`[data-cell="${cell}"]`);
  await target.press("Enter");
  if ((await target.getAttribute("aria-label"))?.startsWith("Land ")) {
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-cell",
      cell,
      { timeout: 30000 },
    );
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-motion",
      "idle",
    );
    const [row, col] = cell.split(",").map(Number);
    const neighbors = [
      { cell: `${row},${col - 1}`, key: "d" },
      { cell: `${row - 1},${col}`, key: "s" },
      { cell: `${row},${col + 1}`, key: "a" },
      { cell: `${row + 1},${col}`, key: "w" },
    ];
    for (const neighbor of neighbors) {
      const stance = page.locator(`[data-cell="${neighbor.cell}"]`);
      if (
        !(await stance.count()) ||
        !(await stance.getAttribute("aria-label"))?.startsWith("Land ")
      )
        continue;
      await stance.press("Enter");
      await expect(page.locator("canvas")).toHaveAttribute(
        "data-farmer-cell",
        neighbor.cell,
      );
      await expect(page.locator("canvas")).toHaveAttribute(
        "data-farmer-motion",
        "idle",
      );
      // Face and interact in the same input tick, before the next walking frame.
      await page.locator("#farm").evaluate((element, key) => {
        element.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true }),
        );
        element.dispatchEvent(
          new KeyboardEvent("keydown", { key: "e", bubbles: true }),
        );
      }, neighbor.key);
      break;
    }
  }
  await expect(page.locator("#service-panel")).toBeVisible();
}
export async function buildAt(page: Page, kind: string, cell: string) {
  await openCell(page, cell);
  const category = ["coop", "dairy", "sheepfold"].includes(kind)
    ? "animals"
    : ["apple", "oak"].includes(kind)
      ? "trees"
      : ["market", "mill", "greenhouse", "hall"].includes(kind)
        ? "trade"
        : "farm";
  await page.locator(`[data-category="${category}"]`).click();
  await page.locator(`[data-build="${kind}"]`).click();
  await page.locator(`[data-cell="${cell}"]`).press("Enter");
  await expect(page.locator("#farm-message")).toContainText(/started|planted/);
}
export async function loadPreset(page: Page, id: string) {
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  await closeActions(page);
  await page.getByLabel("Work on").selectOption("full");
  await page.getByLabel("Starting point").selectOption(id);
  await page.getByRole("button", { name: "Load preset", exact: true }).click();
  await clearStatus(page);
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
}
// The status keeps its text between applies: clear it so the wait sees this one.
async function clearStatus(page: Page) {
  await page.locator("#dev-status").evaluate((el) => (el.textContent = ""));
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
  await clearStatus(page);
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
}
export async function fits(page: Page, selector = "#service-panel") {
  // Viewport changes schedule layout and resize observers asynchronously.
  // Keep all four bounds required, but observe the settled layout.
  await expect
    .poll(
      async () => {
        const box = await page.locator(selector).boundingBox(),
          viewport = page.viewportSize()!;
        return (
          !!box &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= viewport.width + 1 &&
          box.y + box.height <= viewport.height + 1
        );
      },
      { message: `${selector} stays inside the viewport after layout settles` },
    )
    .toBe(true);
}
