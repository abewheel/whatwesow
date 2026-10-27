import { test, expect, type Page } from "@playwright/test";
async function preset(page: Page, id: string) {
  await page.getByLabel("Work on").selectOption("micro");
  await page.getByLabel("Starting point").selectOption(id);
  await page.getByRole("button", { name: "Load preset" }).click();
  await page.getByRole("button", { name: "Apply state" }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
}
test("plant, grow, harvest, replant, reinvest and persist through actual farm plots", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(r.url()));
  await page.goto("/?instance=validation-loop-browser");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  for (const [crop, steps, balance] of [
    ["Turnip", 1, 105],
    ["Carrot", 2, 116],
    ["Corn", 3, 138],
  ] as const) {
    await page
      .locator("#crop-options")
      .getByRole("button", { name: new RegExp(crop) })
      .click();
    await page
      .getByRole("button", { name: "Plot 1: empty", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: new RegExp(`Plot 1: ${crop}, growing`),
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: new RegExp(`Plot 1: ${crop}, growing`) })
      .click();
    await expect(page.locator("#farm-message")).toHaveText(
      "This crop is not ready yet.",
    );
    for (let i = 0; i < steps; i++) {
      await page
        .getByRole("button", { name: "Advance growth", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: new RegExp(
            `Plot 1: ${crop}, ${i + 1 === steps ? "ready" : `growing ${i + 1}/`}`,
          ),
        }),
      ).toBeVisible();
    }
    await page
      .getByRole("button", {
        name: new RegExp(`Plot 1: ${crop}, ready to harvest`),
      })
      .click();
    await expect(page.locator("#season")).toContainText(`${balance} coins`);
  }
  await page.getByRole("button", { name: /Open a plot/ }).click();
  await expect(page.locator("#farm-summary")).toContainText("10 plots");
  await page.getByRole("button", { name: /Improve soil/ }).click();
  await expect(page.locator("#farm-summary")).toContainText("Soil level 1/3");
  await expect(page.locator("#season")).toContainText("28 coins");
  await page.reload();
  await expect(page.locator("#farm-summary")).toContainText("10 plots");
  await expect(page.locator("#farm-summary")).toContainText("Soil level 1/3");
  await expect(page.locator("#season")).toContainText(
    "Year 1 · spring · 28 coins",
  );
  expect(errors).toEqual([]);
});
test("presets cover every farming stage and preserve the calendar", async ({
  page,
}) => {
  await page.goto("/?instance=validation-loop-presets");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await preset(page, "growing");
  await expect(page.getByRole("button", { name: /growing/ })).toHaveCount(9);
  await page
    .getByRole("button", { name: "Advance growth", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /ready to harvest/ }),
  ).toHaveCount(3);
  await preset(page, "harvesting");
  await expect(
    page.getByRole("button", { name: /ready to harvest/ }),
  ).toHaveCount(9);
  await expect(
    page.getByRole("button", { name: "Advance growth", exact: true }),
  ).toBeDisabled();
  await preset(page, "reinvesting");
  await expect(page.locator("#season")).toContainText(
    "Year 1 · spring · 250 coins",
  );
  await expect(
    page.getByRole("button", { name: /Improve soil/ }),
  ).toBeEnabled();
  await preset(page, "planting");
  await expect(
    page.getByRole("button", { name: /Plot \d+: empty/ }),
  ).toHaveCount(9);
  await expect(page.locator("#season")).toContainText("100 coins");
});
test("an empty broke farm can recover, and unaffordable seeds do not spend money", async ({
  page,
}) => {
  await page.goto("/?instance=validation-loop-recovery");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.getByLabel("Work on").selectOption("micro");
  await page
    .getByLabel("Game state JSON")
    .fill(
      JSON.stringify({ coins: 0, plots: Array(9).fill(null), soilLevel: 0 }),
    );
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#season")).toContainText("0 coins");
  await page
    .getByRole("button", { name: "Plot 1: empty", exact: true })
    .click();
  await expect(page.locator("#farm-message")).toHaveText(
    "Not enough coins for those seeds.",
  );
  await page.getByRole("button", { name: /Help with a delivery/ }).click();
  await expect(page.locator("#season")).toContainText("4 coins");
  await expect(
    page.getByRole("button", { name: /Help with a delivery/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Plot 1: empty", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: /Plot 1: Turnip, growing/ }),
  ).toBeVisible();
});
test("rapid plot clicks and grow steps queue through slow saves", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(
      IDBTransaction.prototype,
      "oncomplete",
    )!;
    Object.defineProperty(IDBTransaction.prototype, "oncomplete", {
      configurable: true,
      get: descriptor.get,
      set(callback: ((event: Event) => void) | null) {
        descriptor.set!.call(
          this,
          callback
            ? function (this: IDBTransaction, event: Event) {
                setTimeout(() => callback.call(this, event), 500);
              }
            : null,
        );
      },
    });
  });
  await page.goto("/?instance=validation-slow-saves");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.locator('[data-crop="corn"]').click();
  for (const index of [0, 1, 2])
    await page.locator('[data-plot="' + index + '"]').click();
  await expect(page.locator("#season")).toContainText("64 coins");
  await expect(page.getByRole("button", { name: /Corn, growing/ })).toHaveCount(
    3,
  );
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("button", { name: "Advance growth", exact: true })
      .click();
  await expect(
    page.getByRole("button", { name: /ready to harvest/ }),
  ).toHaveCount(3);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /ready to harvest/ }),
  ).toHaveCount(3);
  await expect(page.locator("#season")).toContainText("64 coins");
});
