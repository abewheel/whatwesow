import { expect, test } from "@playwright/test";

test("end turn reveals each season once, including the new year", async ({
  page,
}) => {
  await page.goto("/?instance=validation-season-cycle");
  await page.locator("#begin-farm").click();
  await page.locator('[data-service="home"]').click();
  await expect(page.locator("#service-panel")).toBeVisible();
  // Record insertion in the page: reduced motion can remove the title before
  // a round trip from the test runner has time to observe it.
  await page.evaluate(() => {
    const seasons: string[] = [];
    document.body.dataset.revealedSeasons = JSON.stringify(seasons);
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node instanceof Element && node.matches(".season-transition")) {
            seasons.push(node.querySelector("strong")!.textContent!);
            document.body.dataset.revealedSeasons = JSON.stringify(seasons);
          }
    }).observe(document.body, { childList: true, subtree: true });
  });
  const revealed: string[] = [];
  for (const season of ["summer", "fall", "winter", "spring"]) {
    await page.locator("#next-season").evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });

    await expect(page.locator("#season")).toContainText(season);
    await expect(page.locator(".season-transition")).toHaveCount(0);
    revealed.push(season);
    await expect(page.locator("body")).toHaveAttribute(
      "data-revealed-seasons",
      JSON.stringify(revealed),
    );
  }
  await expect(page.locator("#season")).toContainText("Year 2");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#next-season").click();

  await expect(page.locator(".season-transition")).toHaveCount(0);
  await expect(page.locator("#season")).toContainText("summer");
  await expect(page.locator("body")).toHaveAttribute(
    "data-revealed-seasons",
    JSON.stringify([...revealed, "summer"]),
  );
  // Year 2's summer brings the first council crisis, which meets once the season shows.
  await expect(page.locator("#crisis")).toBeVisible();
  await expect(page.locator("#crisis h2")).toHaveText("Crisis 1 of 8: Drought");
});
