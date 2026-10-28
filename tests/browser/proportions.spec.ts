import { test, expect } from "./fixtures";
import { openCell } from "./context-helpers";
import { visitBuilding } from "./helpers";
import { homesteadState } from "../../src/game/state";

test("old saves enlarge building reservations once while preserving the farm", async ({
  page,
}) => {
  await page.goto("/?instance=validation-larger-lots-migration");
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  const old = homesteadState();
  delete old.buildingLayout;
  old.coins = 777;
  old.plots[0] = { crop: "turnip", growth: 1 };
  await page.locator("#import").setInputFiles({
    name: "old-farm.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  await expect(page.getByRole("button", { name: /^Farmhouse 1,/ })).toHaveCount(
    20,
  );
  await page.reload();
  await expect(page.getByRole("button", { name: /^Farmhouse 1,/ })).toHaveCount(
    20,
  );
  await page
    .locator("#state")
    .evaluate((e) => (e.closest("details")!.open = true));
  await page.getByLabel("Work on").selectOption("full");
  await page.getByRole("button", { name: "Read current state" }).click();
  const saved = JSON.parse(
    await page.getByLabel("Game state JSON").inputValue(),
  );
  expect(saved.buildingLayout).toBe(2);
  expect(saved.coins).toBe(777);
  expect(saved.plotCells).toEqual(old.plotCells);
  expect(saved.plots).toEqual(old.plots);
  expect(saved.structures[0]).toMatchObject({
    id: 1,
    kind: "home",
    footprint: { width: 5, height: 4 },
  });
});

test("End Turn visits a compact retained farmhouse using its actual lot", async ({
  page,
}) => {
  await page.goto("/?instance=validation-compact-home-seeds");
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  const farm = homesteadState();
  farm.selfBuilt = true;
  await page.locator("#import").setInputFiles({
    name: "compact-farm.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(farm)),
  });
  await expect(page.getByRole("button", { name: /^Farmhouse 1,/ })).toHaveCount(
    6,
  );
  await openCell(page, "13,15");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-cell",
    "13,15",
  );
  await visitBuilding(page, "home");
  await page.locator("#next-season").click();
  await expect(page.locator("#season")).toContainText("summer");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-cell",
    "13,15",
  );
});
