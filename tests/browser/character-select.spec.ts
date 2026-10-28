import { test, expect } from "@playwright/test";

for (const variant of ["male", "female"] as const) {
  test(`${variant} farmer selection survives reload`, async ({ page }) => {
    await page.goto(`/?instance=validation-character-${variant}`);
    await expect(page.locator("#begin-farm")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Male farmer", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", {
        name: `${variant === "male" ? "Male" : "Female"} farmer`,
        exact: true,
      })
      .click();
    await page.locator("#begin-farm").click();
    await expect(page.locator("main")).toHaveJSProperty("inert", false);
    const texture = variant === "male" ? "farmer" : "farmer-female";
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-frame",
      `${texture}:42`,
    );
    await page.reload();
    await expect(page.locator("#startup")).toBeHidden();
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-frame",
      `${texture}:42`,
    );
    const state = JSON.parse(
      await page.getByLabel("Game state JSON").inputValue(),
    );
    expect(state.farmerVariant).toBe(variant);
  });
}

test("female farmer plants and harvests with the selected artwork", async ({
  page,
}) => {
  const { homesteadState } = await import("../../src/game/state");
  const { choosePlotWork, endTurn, buySeeds } = await import("./helpers");
  await page.goto("/?instance=validation-female-work");
  await page
    .getByRole("button", { name: "Female farmer", exact: true })
    .click();
  await page.locator("#begin-farm").click();
  await page.getByLabel("Work on").selectOption("full");
  await page
    .getByLabel("Game state JSON")
    .fill(JSON.stringify({ ...homesteadState(), farmerVariant: "female" }));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await page.reload();
  await expect(page.locator("#startup")).toBeHidden();
  await buySeeds(page, "turnip");
  await page.evaluate(() => window.scrollTo(0, 0));
  const canvas = page.locator("canvas");
  await page
    .getByRole("button", { name: "Plot 1: empty", exact: true })
    .click();
  await choosePlotWork(page);
  await expect(canvas).toHaveAttribute("data-farmer-motion", "plant");
  await expect(canvas).toHaveAttribute(
    "data-farmer-frame",
    /farmer-female:1[2-7]/,
  );
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await endTurn(page);
  await expect(canvas).toHaveAttribute("data-farmer-frame", /farmer-female:/);
  // End turn leaves the home menu open over the farm.
  await page.keyboard.press("Escape");
  await expect(page.locator("#service-panel")).toBeHidden();
  await page.getByRole("button", { name: /Plot 1: Turnip, ready/ }).click();
  await choosePlotWork(page);
  await expect(canvas).toHaveAttribute("data-farmer-motion", "harvest");
  await expect(canvas).toHaveAttribute(
    "data-farmer-frame",
    /farmer-female:2[4-9]/,
  );
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
});

test("female farmer keeps her appearance in the alternating walking gait", async ({
  page,
}) => {
  await page.goto("/?instance=validation-female-gait");
  await page
    .getByRole("button", { name: "Female farmer", exact: true })
    .click();
  await page.locator("#begin-farm").click();
  const canvas = page.locator("canvas");
  // The starter clearing leaves this destination open even with field debris.
  await page.locator('[data-cell="19,20"]').click();
  await expect(canvas).toHaveAttribute("data-farmer-motion", "walk");
  const frames = new Set<string>();
  await expect
    .poll(
      async () => {
        const frame = (await canvas.getAttribute("data-farmer-frame"))!;
        expect(frame).toMatch(/^farmer-female-gait:[0-7]$/);
        frames.add(frame);
        return frames.size;
      },
      { intervals: [35] },
    )
    .toBeGreaterThanOrEqual(4);
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle", {
    timeout: 30000,
  });
  await expect(canvas).toHaveAttribute("data-farmer-frame", "farmer-female:42");
});
