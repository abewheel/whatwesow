import { expect, test } from "./fixtures";
import { homesteadMicroState } from "../../src/micro/state";
import { endTurn, visitBuilding } from "./helpers";

test("animals require a visit, persist collection, and produce again next season", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(r.url()));
  await page.goto("/?instance=validation-animals-test");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.getByLabel("Work on").selectOption("micro");
  const state = homesteadMicroState();
  state.structures.push(
    ...(["coop", "dairy", "sheepfold"] as const).map((kind, i) => ({
      id: i + 2,
      kind,
      row: 10 + i * 4,
      col: 18,
      level: 1,
      product: true,
    })),
  );
  state.nextStructureId = 5;
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await page.getByText("Playtest tools", { exact: true }).click();
  for (const [id, coins] of [
    [2, 130],
    [3, 205],
    [4, 325],
  ]) {
    await page.locator(`[data-structure="${id}"]`).click();
    await expect(page.locator("#coin-count")).toHaveText(String(coins), {
      timeout: 30000,
    });
    await expect(page.locator(`[data-structure="${id}"]`)).toHaveAttribute(
      "aria-label",
      /collected/,
    );
  }
  await page.reload();
  await expect(page.locator("#coin-count")).toHaveText("325");
  await endTurn(page);
  await expect(page.locator("#coin-count")).toHaveText("325");
  await expect(page.locator('[data-structure="2"]')).toHaveAttribute(
    "aria-label",
    /Eggs ready/,
  );
  expect(errors).toEqual([]);
});

test("coop plans reserve land, complete next season, and keep collection state when moved", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/?instance=validation-coop-build");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = homesteadMicroState();
  state.coins = 1000;
  state.harvests.turnip = 3;
  await page.getByLabel("Work on").selectOption("micro");
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await visitBuilding(page, "builder");
  await page.locator('[data-build="coop"]').click();
  await page.getByRole("button", { name: "Land 14,19", exact: true }).click();
  await expect(page.locator("#coin-count")).toHaveText("760");
  await expect(page.locator('[data-structure="2"]')).toHaveAttribute(
    "aria-label",
    /under construction/,
  );
  await endTurn(page);
  await expect(page.locator('[data-structure="2"]')).toHaveAttribute(
    "aria-label",
    /Eggs ready/,
  );
  await page.locator('[data-structure="2"]').click();
  await expect(page.locator("#coin-count")).toHaveText("790");
  await page.locator('[data-structure="2"]').click();
  await expect(page.locator("#service-panel")).toBeVisible();
  await page.locator("#move-building").click();
  await page.getByRole("button", { name: "Land 19,19", exact: true }).click();
  await expect(page.locator('[data-cell="19,19"]')).toHaveAttribute(
    "aria-label",
    /Chicken coop 2, collected/,
  );
  await page.reload();
  await expect(page.locator('[data-cell="19,19"]')).toHaveAttribute(
    "aria-label",
    /collected/,
  );
});

test("seasonal pens leave adjacent crops and buildings clickable", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/?instance=validation-animal-neighbors");
  await expect(page.locator("#startup")).toBeHidden();
  const state = homesteadMicroState();
  state.coins = 1000;
  state.plotCells[0] = { row: 14, col: 18 };
  state.plotCells[1] = { row: 13, col: 20 };
  state.structures.push(
    { id: 2, kind: "coop", row: 11, col: 17, level: 1, product: true },
    { id: 3, kind: "dairy", row: 14, col: 19, level: 1, product: true },
    { id: 4, kind: "sheepfold", row: 17, col: 19, level: 1, product: true },
    { id: 5, kind: "shed", row: 14, col: 22, level: 1 },
  );
  state.nextStructureId = 6;
  await page.getByLabel("Work on").selectOption("micro");
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  for (const season of ["spring", "summer", "fall", "winter"]) {
    if (season !== "spring") await endTurn(page);
    const close = page.locator("#close-service");
    if (await close.isVisible()) await close.click();
    await page.locator('[data-cell="14,17"]').click();
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-cell",
      "14,17",
    );
    await page.locator('[data-structure="2"]').click();
    await expect(page.locator('[data-structure="2"]')).toHaveAttribute(
      "aria-label",
      /collected/,
    );
    await page.locator('[data-structure="5"]').click();
    await expect(page.locator("#selected-building")).toContainText(
      "Seed storehouse",
    );
    await close.click();
  }
  // The two front-adjacent crop cells must respond to their ground hit targets.
  await page.locator('[data-plot="0"]').click();
  // In winter the failed planting still targets the plot, rather than collecting an animal.
  await expect(page.locator("#farm-message")).toContainText("plant");
});

test("new farmhouses reserve a 5 by 4 lot through construction and reload", async ({
  page,
}) => {
  await page.goto("/?instance=validation-large-home");
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  const { initialState } = await import("../../src/game/state");
  const state = initialState();
  state.coins = 10000;
  state.plots = [null];
  state.plotCells = [{ row: 16, col: 16 }];
  state.plotIds = [1];
  state.nextPlotId = 2;
  await page.getByLabel("Work on").selectOption("full");
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await visitBuilding(page, "home");
  await page
    .getByRole("button", { name: "Build your house", exact: true })
    .click();
  await page.locator('[data-build="home"]').click();
  await page.locator('[data-cell="14,14"]').hover();
  await expect(page.locator("#placement-preview")).toHaveAttribute(
    "data-valid",
    "false",
  );
  await page.locator('[data-cell="7,8"]').click();
  await expect(page.getByRole("button", { name: /^Farmhouse 1,/ })).toHaveCount(
    20,
  );
  await endTurn(page);
  await expect(page.locator('[data-service="home"]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: /^Farmhouse 1,/ })).toHaveCount(
    20,
  );
});
