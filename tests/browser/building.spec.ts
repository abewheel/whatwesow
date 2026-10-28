import { visitBuilding, endTurn, clickCamera } from "./helpers";
import { test, expect, type Page } from "./fixtures";
async function load(page: Page, id: string) {
  await page.getByLabel("Work on").selectOption("full");
  await page.getByLabel("Starting point").selectOption(id);
  await page.getByRole("button", { name: "Load preset", exact: true }).click();
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
}
async function buildTool(page: Page, kind: string) {
  await visitBuilding(
    page,
    kind === "plot"
      ? "fields"
      : ["oak", "apple"].includes(kind)
        ? "seeds"
        : "builder",
  );
  await page.locator('[data-build="' + kind + '"]').click();
}
test("places plots, trees and structures with footprints, moves and upgrades them, and preserves the estate", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(r.url()));
  await page.goto("/?instance=validation-construction");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await load(page, "reinvesting");
  await buildTool(page, "shed");
  await page.getByRole("button", { name: "Land 14,18", exact: true }).hover();
  await expect(page.locator("#placement-preview")).toHaveAttribute(
    "data-valid",
    "true",
  );
  await page.getByRole("button", { name: "Land 14,18", exact: true }).click();
  await expect(page.locator("#farm-message")).toContainText(
    "Seed storehouse construction started",
  );
  await expect(page.locator("#season")).toContainText("190 coins");
  await buildTool(page, "oak");
  await page.locator('[data-cell="14,18"]').hover();
  await expect(page.locator("#placement-preview")).toHaveAttribute(
    "data-valid",
    "false",
  );
  await page.locator('[data-cell="14,18"]').click();
  await expect(page.locator("#farm-message")).toContainText("occupied");
  await expect(page.locator("#season")).toContainText("190 coins");
  await page.getByRole("button", { name: "Land 20,17", exact: true }).click();
  await expect(page.locator("#season")).toContainText("175 coins");
  await buildTool(page, "plot");
  await page.getByRole("button", { name: "Land 18,16", exact: true }).click();
  await expect(page.locator("#farm-summary")).toContainText("10 plots");
  await page
    .getByRole("button", { name: "Cancel placement", exact: true })
    .click();
  await page.locator('[data-structure="2"]').click();
  await expect(page.locator("#upgrade-building")).toBeDisabled();
  await expect(page.locator("#upgrade-building")).toContainText(
    "Ready next season",
  );
  await page.locator("#move-building").click();
  await page.getByRole("button", { name: "Land 13,21", exact: true }).click();
  await expect(page.locator("#farm-message")).toContainText("moved");
  await expect(page.locator("#season")).toContainText("145 coins");

  for (let turn = 2; turn <= 9; turn++) {
    await endTurn(page);
    await expect(page.locator("#next-season")).toContainText(turn + "/160");
  }
  await page.getByLabel("Work on").selectOption("micro");
  await page.getByRole("button", { name: "Read current state" }).click();
  const farm = JSON.parse(
    await page.getByLabel("Game state JSON").inputValue(),
  );
  farm.harvests.turnip += 12;
  await page.getByLabel("Game state JSON").fill(JSON.stringify(farm));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await page.locator('[data-structure="2"]').click();
  await page.locator("#upgrade-building").click();
  await expect(page.locator("#selected-building")).toContainText("Level 1/3");
  await expect(page.locator("#upgrade-building")).toContainText("underway");
  await page.reload();
  await endTurn(page);
  await page.locator('[data-structure="2"]').click();
  await expect(page.locator("#selected-building")).toContainText("Level 2/3");
  await expect(page.locator("#season")).toContainText("25 coins");
  await page.reload();
  await expect(page.locator("#next-season")).toContainText("10/160");
  await expect(page.locator("#farm-summary")).toContainText("10 plots");
  await expect(page.locator('[data-cell="13,21"]')).toHaveAttribute(
    "aria-label",
    /Seed storehouse 2, level 2/,
  );
  await expect(page.locator('[data-structure="3"]')).toHaveAttribute(
    "aria-label",
    /Oak tree/,
  );
  expect(errors).toEqual([]);
});
test("explores distant land and drag panning does not plant or spend", async ({
  page,
}) => {
  await page.goto("/?instance=validation-scrollable-farm");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const farm = page.locator("#farm");
  await clickCamera(page, "#home-view");
  const before = await farm.evaluate((el) => el.scrollLeft);
  await farm.focus();
  for (let step = 0; step < 3; step++) await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => farm.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(before);
  await page.getByRole("button", { name: "Close view controls" }).click();
  await farm.focus();
  await page.keyboard.press("ArrowDown");
  const top = await farm.evaluate((el) => el.scrollTop);
  const bounds = await farm.boundingBox();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2,
    bounds!.y + bounds!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2 - 160,
    bounds!.y + bounds!.height / 2 - 90,
    { steps: 6 },
  );
  await page.mouse.up();
  await expect
    .poll(() => farm.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(top);
  await expect(page.locator("#season")).toContainText("100 coins");
  await buildTool(page, "plot");
  await page.getByRole("button", { name: "Land 1,30", exact: true }).click();
  await expect(page.locator("#farm-summary")).toContainText("10 plots");
  await expect(page.locator('[data-cell="1,30"]')).toHaveAttribute(
    "data-plot",
    "9",
  );
});
test("late progression and the final seasonal income respect the 160-turn boundary", async ({
  page,
}) => {
  await page.goto("/?instance=validation-lifetime-builds");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await load(page, "legacy");
  await expect(page.locator("#next-season")).toContainText("159/160");
  await page.locator('[data-structure][aria-label^="Legacy hall"]').click();
  await expect(page.locator("#selected-building")).toContainText("Legacy hall");
  await page.locator("#upgrade-building").click();
  await expect(page.locator("#selected-building")).toContainText("Level 1/3");
  await expect(page.locator("#upgrade-building")).toContainText("underway");
  await expect(page.locator("#upgrade-building")).toBeDisabled();
  await endTurn(page);
  await expect(page.locator("#next-season")).toHaveText(
    "Final season · 160/160",
  );
  await expect(page.locator("#next-season")).toBeDisabled();
  await expect(page.locator("#season")).toContainText(
    "Year 40 · winter · 130,150 coins",
  );
  await page.reload();
  await expect(page.locator("#next-season")).toBeDisabled();
  await expect(page.locator("#season")).toContainText("130,150 coins");
});
test("repeated builds, plot relocation, and macro land policies remain playable", async ({
  page,
}) => {
  // This full playthrough includes several real-time walks between services.
  test.setTimeout(120000);
  await page.goto("/?instance=validation-flexible-construction");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await load(page, "reinvesting");
  for (const cell of ["14,18", "19,18"]) {
    await buildTool(page, "shed");
    await page.locator('[data-cell="' + cell + '"]').click();
    await expect(page.locator("#farm-message")).toContainText(
      "Seed storehouse construction started",
    );
  }
  await expect(page.locator("[data-structure]")).toHaveCount(3);
  await expect(page.locator("#season")).toContainText("70 coins");
  await page.locator("#farm-mode").click();
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("#season")).toContainText("66 coins");
  await visitBuilding(page, "fields");
  await page.locator("#move-plot").click();
  await page.locator('[data-plot="0"]').click();
  await page.getByRole("button", { name: "Land 22,22", exact: true }).click();
  await expect(page.locator('[data-cell="22,22"]')).toHaveAttribute(
    "data-plot",
    "0",
  );
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /Turnip, growing 0/,
  );
  await expect(page.locator("#season")).toContainText("66 coins");
  await load(page, "restricted");
  await expect(page.locator("#next-season")).toContainText("25/160");
  await buildTool(page, "plot");
  await page.getByRole("button", { name: "Land 1,1", exact: true }).hover();
  await expect(page.locator("#placement-preview")).toHaveAttribute(
    "data-valid",
    "false",
  );
  await page.getByRole("button", { name: "Land 1,1", exact: true }).click();
  await expect(page.locator("#farm-message")).toContainText("unoccupied");
  await visitBuilding(page, "builder");
  await expect(page.locator('[data-build="barn"]')).toBeDisabled();
  await page.reload();
  await visitBuilding(page, "builder");
  await expect(page.locator('[data-build="barn"]')).toBeDisabled();
});
test("switching from plot relocation to building relocation clears the previous target", async ({
  page,
}) => {
  await page.goto("/?instance=validation-switch-move-tools");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.locator('[data-structure="1"]').click();
  await visitBuilding(page, "fields");
  await page.locator("#move-plot").click();
  await page.locator('[data-plot="0"]').click();
  await visitBuilding(page, "builder");
  await page.locator("#structure-target").selectOption("1");
  await page.locator("#move-building").click();
  await page.getByRole("button", { name: "Land 22,22", exact: true }).click();
  await expect(page.locator("#farm-message")).toContainText("Farmhouse moved");
  await expect(page.locator('[data-cell="22,22"]')).toHaveAttribute(
    "data-structure",
    "1",
  );
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "data-cell",
    "16,16",
  );
  await page.locator('[data-structure="1"]').click();
  await visitBuilding(page, "fields");
  await page.locator("#move-plot").click();
  await visitBuilding(page, "builder");
  await page.locator("#structure-target").selectOption("1");
  await page.locator("#move-building").click();
  await page.getByRole("button", { name: "Land 25,25", exact: true }).click();
  await expect(page.locator("#farm-message")).toContainText("Farmhouse moved");
  await expect(page.locator('[data-cell="25,25"]')).toHaveAttribute(
    "data-structure",
    "1",
  );
  await expect(page.locator("#season")).toContainText("100 coins");
});

test("construction persists, withholds benefits, and completes next season", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/?instance=validation-pending-construction");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await load(page, "community");
  await buildTool(page, "shed");
  await page.locator('[data-cell="14,18"]').click();
  await expect(page.locator("#season")).toContainText("2,880 coins");
  await expect(page.locator('[data-crop="carrot"]')).toHaveAttribute(
    "aria-label",
    /6 coins to plant/,
  );
  await page.reload();
  await page.locator('[data-cell="14,18"]').click();
  await expect(page.locator("#selected-building")).toContainText(
    "Ready next season",
  );
  await expect(page.locator("#upgrade-building")).toBeDisabled();
  await endTurn(page);
  await page.locator('[data-cell="14,18"]').click();
  await expect(page.locator("#selected-building")).toContainText("Level 1/3");
  await expect(page.locator('[data-crop="carrot"]')).toHaveAttribute(
    "aria-label",
    /5 coins to plant/,
  );
  await expect(page.locator("#season")).toContainText("2,880 coins");
});

test("apple harvests pay on click, persist after picking, and regrow in fall", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/?instance=validation-fruit-harvest");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await load(page, "community");
  const tree = page.locator('[data-cell="13,19"]');
  await expect(tree).toHaveAttribute("aria-label", /ready to harvest/);
  await tree.click();
  await expect(page.locator("#season")).toContainText("3,024 coins");
  await expect(tree).toHaveAttribute("aria-label", /produces in fall/);
  await expect(page.locator("#service-panel")).toBeHidden();
  await page.reload();
  await expect(tree).toHaveAttribute("aria-label", /produces in fall/);
  for (let season = 0; season < 2; season++) await endTurn(page);
  await expect(page.locator("#season")).toContainText("3,024 coins");
  await expect(tree).toHaveAttribute("aria-label", /ready to harvest/);
  await tree.click();
  await expect(page.locator("#season")).toContainText("3,048 coins");
  await expect(tree).toHaveAttribute("data-structure", "4");
});
