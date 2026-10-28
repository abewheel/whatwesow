import { expect, test } from "@playwright/test";

test("end turn reveals each season once, including the new year", async ({
  page,
}) => {
  await page.goto("/?instance=validation-season-cycle");
  await page.locator("#begin-farm").click();
  await page.locator('[data-service="home"]').click();
  await expect(page.locator("#service-panel")).toBeVisible();
  for (const season of ["summer", "fall", "winter", "spring"]) {
    await page.locator("#next-season").evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(page.locator(".season-transition strong")).toHaveText(season);
    await expect(page.locator("#season")).toContainText(season);
    await expect(page.locator(".season-transition")).toHaveCount(0);
  }
  await expect(page.locator("#season")).toContainText("Year 2");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#next-season").click();
  await expect(page.locator(".season-transition strong")).toHaveText("summer");
  await expect(page.locator(".season-transition")).toHaveCount(0);
  await expect(page.locator("#season")).toContainText("summer");
});
