import { test, expect, type Page } from "@playwright/test";
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
  await page.locator("#build-shop").evaluate((el: HTMLDetailsElement) => {
    el.open = true;
  });
  await page.locator('[data-build="' + kind + '"]').click();
}
test("places plots, trees and structures with footprints, moves and upgrades them, and preserves the estate", async ({
  page,
}) => {
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
  await expect(page.locator("#farm-message")).toContainText("Tool shed built");
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
    .getByRole("button", { name: "Farm tool / cancel build", exact: true })
    .click();
  await page.locator('[data-structure="2"]').click();
  await expect(page.locator("#upgrade-building")).toBeDisabled();
  await expect(page.locator("#upgrade-building")).toContainText("turn 9");
  await page.locator("#move-building").click();
  await page.getByRole("button", { name: "Land 13,21", exact: true }).click();
  await expect(page.locator("#farm-message")).toContainText("moved");
  await expect(page.locator("#season")).toContainText("145 coins");
  await page
    .getByRole("button", { name: "Farm tool / cancel build", exact: true })
    .click();
  for (let turn = 2; turn <= 9; turn++) {
    await page.locator("#next-season").click();
    await expect(page.locator("#next-season")).toContainText(turn + "/160");
  }
  await page.locator('[data-structure="2"]').click();
  await page.locator("#upgrade-building").click();
  await expect(page.locator("#selected-building")).toContainText("Level 2/3");
  await expect(page.locator("#season")).toContainText("25 coins");
  await page.reload();
  await expect(page.locator("#next-season")).toContainText("9/160");
  await expect(page.locator("#farm-summary")).toContainText("10 plots");
  await expect(page.locator('[data-cell="13,21"]')).toHaveAttribute(
    "aria-label",
    /Tool shed 2, level 2/,
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
  await page.locator("#home-view").click();
  const before = await farm.evaluate((el) => el.scrollLeft);
  await page.getByRole("button", { name: "Pan right", exact: true }).click();
  await expect
    .poll(() => farm.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(before);
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
  await page.locator('[data-structure="10"]').click();
  await expect(page.locator("#selected-building")).toContainText("Legacy hall");
  await page.locator("#upgrade-building").click();
  await expect(page.locator("#selected-building")).toContainText("Level 2/3");
  await page.locator("#upgrade-building").click();
  await expect(page.locator("#selected-building")).toContainText("Level 3/3");
  await expect(page.locator("#upgrade-building")).toBeDisabled();
  await page.locator("#next-season").click();
  await expect(page.locator("#next-season")).toHaveText(
    "Final season · 160/160",
  );
  await expect(page.locator("#next-season")).toBeDisabled();
  await expect(page.locator("#season")).toContainText(
    "Year 40 · winter · 25,156 coins",
  );
  await page.reload();
  await expect(page.locator("#next-season")).toBeDisabled();
  await expect(page.locator("#season")).toContainText("25,156 coins");
});
test("repeated builds, plot relocation, and macro land policies remain playable", async ({
  page,
}) => {
  await page.goto("/?instance=validation-flexible-construction");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await load(page, "reinvesting");
  for (const cell of ["14,18", "19,18"]) {
    await buildTool(page, "shed");
    await page.locator('[data-cell="' + cell + '"]').click();
    await expect(page.locator("#farm-message")).toContainText(
      "Tool shed built",
    );
  }
  await expect(page.locator("[data-structure]")).toHaveCount(3);
  await expect(page.locator("#season")).toContainText("130 coins");
  await page.locator("#farm-mode").click();
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("#season")).toContainText("128 coins");
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
  await expect(page.locator("#season")).toContainText("128 coins");
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
  await page.locator("#build-shop").evaluate((el: HTMLDetailsElement) => {
    el.open = true;
  });
  await expect(page.locator('[data-build="barn"]')).toBeDisabled();
  await page.reload();
  await page.locator("#build-shop summary").click();
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
  await page.locator("#move-plot").click();
  await page.locator('[data-plot="0"]').click();
  await page.locator("#build-shop").evaluate((el: HTMLDetailsElement) => {
    el.open = true;
  });
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
  await page.locator("#move-plot").click();
  await page.locator("#build-shop").evaluate((el: HTMLDetailsElement) => {
    el.open = true;
  });
  await page.locator("#move-building").click();
  await page.getByRole("button", { name: "Land 25,25", exact: true }).click();
  await expect(page.locator("#farm-message")).toContainText("Farmhouse moved");
  await expect(page.locator('[data-cell="25,25"]')).toHaveAttribute(
    "data-structure",
    "1",
  );
  await expect(page.locator("#season")).toContainText("100 coins");
});
