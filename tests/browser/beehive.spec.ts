import { initialState, type GameState } from "../../src/game/state";
import { openCell, readFarm, setFarm, fits } from "./context-helpers";
import { test, expect } from "./fixtures";
import { endTurn } from "./helpers";

test("honey rescues an empty farm and can only be collected once until next season", async ({
  page,
}) => {
  await page.goto("/?instance=validation-honey");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  await page.getByLabel("Work on").selectOption("micro");
  await page.getByRole("button", { name: "Read current state" }).click();
  const farm = JSON.parse(
    await page.getByLabel("Game state JSON").inputValue(),
  );
  await page.getByLabel("Game state JSON").fill(
    JSON.stringify({
      ...farm,
      coins: 0,
      plots: [null],
      plotCells: [{ row: 6, col: 2 }],
      plotIds: [1],
      nextPlotId: 2,
      structures: [{ id: 1, kind: "home", row: 1, col: 1, level: 1 }],
      // Occupying the default start selects the valid spawn beside this plot.
      debris: [{ kind: "rockpile", row: 14, col: 14 }],
    }),
  );
  await page.getByRole("button", { name: "Apply state" }).click();
  await expect(page.locator("#dev-status")).toContainText("applied");
  // Applying state resets the farmer against the scene's current layout.
  // Read the loaded fixture again so both the first visit and the reload check
  // start beside its plot, rather than at the default new-scene position.
  const stageFarmer = async () => {
    await page.getByRole("button", { name: "Read current state" }).click();
    await page.getByRole("button", { name: "Apply state" }).click();
    await expect(page.locator("#dev-status")).toHaveText(
      "State applied and saved.",
    );
    await expect(page.locator("#farm canvas")).toHaveAttribute(
      "data-farmer-cell",
      "6,1",
    );
  };
  await stageFarmer();
  const hive = page.locator('[data-service="hive"]');
  // Center the ground target below the fixed HUD, then let Playwright check
  // that the pointer can actually reach it instead of forcing an obscured hit.
  await hive.evaluate((target) =>
    target.scrollIntoView({ block: "center", inline: "center" }),
  );
  await hive.click();
  await expect(page.locator("#farm canvas")).toHaveAttribute(
    "data-farmer-motion",
    "walk",
  );
  await expect(page.locator("#service-panel")).toBeHidden();

  await expect(page.locator("#farm canvas")).toHaveAttribute(
    "data-farmer-cell",
    "0,0",
  );
  await expect(page.locator("#farm canvas")).toHaveAttribute(
    "data-farmer-motion",
    "idle",
  );
  await expect(page.locator("#season")).toContainText("12 coins");
  await expect(page.locator("#collect-honey")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  await stageFarmer();
  await hive.evaluate((target) =>
    target.scrollIntoView({ block: "center", inline: "center" }),
  );
  await hive.click();
  await expect(page.locator("#service-panel")).toBeVisible();
  await expect(page.locator("#collect-honey")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Close actions", exact: true })
    .click();
  await endTurn(page);
  await expect(page.locator("#season")).toContainText("summer");
  await hive.evaluate((target) =>
    target.scrollIntoView({ block: "center", inline: "center" }),
  );
  await hive.click();
  await expect(page.locator("#service-panel")).toBeHidden();
  await expect(page.locator("#season")).toContainText("24 coins");
});

for (const size of [{ width: 1280, height: 800 }]) {
  test(`wooden hives can be built, collected, saved and torn down at ${size.width}px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: size,
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("requestfailed", (r) => errors.push(r.url()));
    await page.goto(`/?instance=validation-wooden-${size.width}`);
    await page.locator("#begin-farm").click();
    await expect(page.locator("main")).toHaveJSProperty("inert", false);
    const { openCell, readFarm, setFarm, closeActions, fits } =
      await import("./context-helpers");
    await openCell(page, "8,10");
    await fits(page);
    const plan = page.locator('[data-build="beehive"]');
    await expect(plan).toHaveAttribute("aria-label", /120 coins/);
    await expect(plan).toContainText("15 coins");
    await plan.tap();
    await page.locator('[data-cell="8,10"]').press("Enter");
    await expect(page.locator("#season")).toContainText("120 coins");
    await openCell(page, "8,10");
    await expect(page.locator("#tile-actions")).toContainText(
      "Under construction",
    );
    await closeActions(page);
    await endTurn(page);
    await expect(page.locator("#season")).toContainText("summer");
    await page.keyboard.press("Escape");
    await page.locator('[data-cell="8,10"]').tap();
    await expect(page.locator("#season")).toContainText("135 coins");
    let farm = await readFarm(page);
    expect(farm.structures[0]).toMatchObject({
      kind: "beehive",
      product: false,
    });
    expect(farm.honeyReady).toBe(true);
    await page.reload();
    await expect(page.locator("main")).toHaveJSProperty("inert", false);
    await openCell(page, "8,10");
    await expect(page.locator("#tile-actions")).toContainText("Collected");
    expect(farm.coins).toBe(135);
    await setFarm(page, { ...farm, season: "winter" });
    await openCell(page, "8,10");
    await fits(page);
    await page.locator("#teardown-building").tap();
    await page.locator("#confirm-delete").click();
    farm = await readFarm(page);
    expect(farm.structures[0].pendingDemolition).toBe(true);
    expect(farm.structures[0].product).toBe(false);
    await endTurn(page);
    expect((await readFarm(page)).structures).toHaveLength(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  const farm: GameState = {
    ...initialState(),
    debris: [],
    plots: [null],
    plotCells: [{ row: 16, col: 16 }],
    plotIds: [1],
    nextPlotId: 2,
  };
  test.describe(`seeded hive controls at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true, farmState: farm });
    test("touch plans, construction, collection and teardown fit", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("requestfailed", (request) => errors.push(request.url()));
      await page.goto(`/?instance=validation-hive-controls-${viewport.width}`);
      await openCell(page, "16,18");
      const plan = page.locator('[data-build="beehive"]');
      await expect(plan).toHaveAttribute("aria-label", /120 coins/);
      await expect(plan).toContainText("15 coins");
      await fits(page);
      await plan.tap();
      await expect(page.locator("#placement-ghost")).toBeVisible();
      await page.locator('[data-cell="16,18"]').tap();
      await expect(page.locator("#season")).toContainText("120 coins");
      await openCell(page, "16,18");
      await expect(page.locator("#tile-actions")).toContainText(
        "Under construction",
      );
      await fits(page);
      const ready = await readFarm(page);
      ready.structures[0].pendingConstruction = undefined;
      ready.structures[0].product = true;
      await setFarm(page, ready);
      await page.keyboard.press("Escape");
      const before = ready.coins;
      await page.locator('[data-cell="16,18"]').tap();
      await expect(page.locator("#season")).toContainText(
        `${before + 15} coins`,
      );
      const collected = await readFarm(page);
      expect(collected.coins).toBe(before + 15);
      expect(collected.structures[0].product).toBe(false);
      await openCell(page, "16,18");
      await expect(page.locator("#tile-actions")).toContainText("Collected");
      await page.locator("#teardown-building").tap();
      await page.locator("#confirm-delete").click();
      expect((await readFarm(page)).structures[0].pendingDemolition).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}
