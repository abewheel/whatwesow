import { test, expect } from "./fixtures";
import { loadPreset, openCell, readFarm } from "./context-helpers";
test.use({ hasTouch: true });

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test(`placement previews, rejects occupied lots, and commits a chosen lot at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("requestfailed", (r) => errors.push(r.url()));
    await page.goto(`/?instance=validation-placement-${viewport.width}`);
    await loadPreset(page, "community");
    const before = await readFarm(page);
    const land = page.locator('[data-cell="30,30"]');
    await land.press("Enter");
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-cell",
      "30,30",
    );
    await expect(page.locator("#service-panel")).toBeHidden();
    await page.locator("#open-actions").tap();
    await page.locator('[data-build="shed"]').click();
    const ghost = page.locator("#placement-ghost"),
      preview = page.locator("#placement-preview");
    await expect(ghost).toBeVisible();
    await expect(preview.locator("polygon")).toHaveCount(9);
    await expect(page.locator("#service-panel")).toBeHidden();
    await expect(page.locator("#coin-count")).toHaveText(
      before.coins.toLocaleString(),
    );
    await page.locator('[data-cell="16,16"]').press("Enter");
    await expect(preview).toHaveAttribute("data-valid", "false");
    await expect(ghost).toBeVisible();
    await expect(page.locator("#coin-count")).toHaveText(
      before.coins.toLocaleString(),
    );
    await page.locator('[data-cell="30,31"]').tap();
    await expect(page.locator("#service-title")).toHaveText("Seed storehouse");
    await expect(ghost).toBeHidden();
    const after = await readFarm(page);
    expect(after.structures).toHaveLength(before.structures.length + 1);
    expect(after.structures.at(-1)).toMatchObject({
      kind: "shed",
      row: 30,
      col: 31,
      pendingConstruction: true,
    });
    expect(after.coins).toBeLessThan(before.coins);
    expect(errors).toEqual([]);
  });
}

test("E opens actions, I opens inventory, and Escape cancels an unplaced ghost", async ({
  page,
}) => {
  await page.goto("/?instance=validation-placement-cancel");
  await loadPreset(page, "community");
  await openCell(page, "30,30");
  await page.locator('[data-build="shed"]').click();
  await expect(page.locator("#placement-ghost")).toBeVisible();
  const top = await page
    .locator("#placement-ghost")
    .evaluate((el) => el.style.top);
  await page.locator('[data-cell="31,31"]').hover();
  await expect(page.locator("#placement-ghost")).not.toHaveCSS("top", top);
  await page.keyboard.press("Escape");
  await expect(page.locator("#placement-ghost")).toBeHidden();
  await expect(page.locator("#farm-mode")).toBeHidden();
  await page.keyboard.press("e");
  await expect(page.locator("#service-title")).toHaveText("Open land");
  await page.keyboard.press("e");
  await expect(page.locator("#service-panel")).toBeHidden();
  await page.keyboard.press("i");
  await expect(page.locator("#service-title")).toHaveText("Inventory");
});

test("E and Actions reopen selected buildings and services", async ({
  page,
}) => {
  await page.goto("/?instance=validation-entity-actions");
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  for (const [selector, title] of [
    ['[data-structure="1"]', "Farmhouse"],
    ['[data-service="seeds"]', "Seed shop"],
  ]) {
    await page.keyboard.press("Escape");
    await page.locator(selector).first().press("Enter");
    await expect(page.locator("#service-title")).toHaveText(title);
    await expect(page.locator("#service-panel")).toBeVisible();
    await page.keyboard.press("e");
    await expect(page.locator("#service-panel")).toBeHidden();
    await page.keyboard.press("e");
    await expect(page.locator("#service-title")).toHaveText(title);
    await expect(page.locator("#service-panel")).toBeVisible();
    await page.locator("#open-actions").tap();
    await expect(page.locator("#service-panel")).toBeHidden();
    await page.locator("#open-actions").tap();
    await expect(page.locator("#service-title")).toHaveText(title);
    await expect(page.locator("#service-panel")).toBeVisible();
  }
});
