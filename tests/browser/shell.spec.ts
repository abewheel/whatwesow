import { homesteadMicroState as initialMicroState } from "../../src/micro/state";
import { test, expect } from "./fixtures";
test("playtest state persists, invalid state is rejected, and instances are isolated", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?instance=validation-browser");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByLabel("Starting point").selectOption("mid");
  await page.getByRole("button", { name: "Load preset" }).click();
  await page.getByRole("button", { name: "Apply state" }).click();
  await expect(page.locator("#season")).toContainText("Year 20");
  await page.reload();
  await expect(page.locator("#season")).toContainText("Year 20");
  await page
    .getByLabel("Game state JSON")
    .fill('{"version":1,"year":99,"season":"spring","coins":100}');
  await page.getByRole("button", { name: "Apply state" }).click();
  await expect(page.locator("#dev-status")).toContainText("year 1–40");
  await expect(page.locator("#season")).toContainText("Year 20");
  await page.goto("/?instance=validation-other");
  await expect(page.locator("#season")).toContainText("Year 1 ·");
  expect(errors).toEqual([]);
});
test("imports and exports saves", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.locator("#import").setInputFiles({
    name: "save.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ version: 1, year: 40, season: "winter", coins: 12 }),
    ),
  });
  await expect(page.locator("#season")).toContainText("Year 40");
  await page.getByRole("button", { name: "Open farm menu" }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export save" }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("what-we-sow-save.json");
});

test("isolated domain editors compose, reject invalid edits, and persist", async ({
  page,
}) => {
  await page.goto("/?instance=validation-domains");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.getByLabel("Work on").selectOption("micro");
  await page.getByLabel("Game state JSON").fill(
    JSON.stringify({
      ...initialMicroState(),
      coins: 777,
      year: 40,
      plots: Array(9).fill(null),
      soilLevel: 0,
    }),
  );
  await page.getByRole("button", { name: "Apply state" }).click();
  await expect(page.locator("#season")).toContainText(
    "Year 1 · spring · 777 coins",
  );
  await page.getByLabel("Work on").selectOption("macro");
  await page.getByLabel("Starting point").selectOption("late");
  await page.getByRole("button", { name: "Load preset" }).click();
  await page.getByRole("button", { name: "Apply state" }).click();
  await expect(page.locator("#season")).toContainText(
    "Year 40 · winter · 777 coins",
  );
  await page
    .getByLabel("Game state JSON")
    .fill('{"year":41,"season":"winter"}');
  await page.getByRole("button", { name: "Apply state" }).click();
  await expect(page.locator("#dev-status")).toContainText("year 1–40");
  await page.getByRole("button", { name: "Read current state" }).click();
  await expect(page.getByLabel("Game state JSON")).toHaveValue(/"year": 40/);
  await page.reload();
  await expect(page.locator("#season")).toContainText(
    "Year 40 · winter · 777 coins",
  );
});
