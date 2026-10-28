import { test, expect } from "@playwright/test";
test("production excludes tools and ignores playtest instance parameters", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(r.url()));
  await page.goto("/?instance=validation-production");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.getByRole("button", { name: "Inherit your farm" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Playtest tools")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Crisis test" })).toHaveCount(
    0,
  );
  await page.locator("#import").setInputFiles({
    name: "save.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ version: 1, year: 20, season: "fall", coins: 55 }),
    ),
  });
  await expect(page.locator("#season")).toContainText("Year 20");
  await page.goto("/?instance=another-instance");
  await expect(page.locator("#season")).toContainText("Year 20");
  expect(errors).toEqual([]);
});
