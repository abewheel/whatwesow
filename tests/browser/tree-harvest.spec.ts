import { expect, test, type Page } from "@playwright/test";
import { initialMicroState } from "../../src/micro/state";
async function orchard(page: Page) {
  await page.goto("/?instance=validation-tree-harvest-test");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.getByLabel("Work on").selectOption("micro");
  const state = initialMicroState();
  state.plots[0] = { crop: "turnip", growth: 1 };
  state.structures.push(
    {
      id: 2,
      kind: "apple",
      row: 14,
      col: 18,
      level: 1,
      age: 12,
      product: true,
    },
    { id: 3, kind: "oak", row: 18, col: 19, level: 1, age: 40, product: true },
  );
  state.nextStructureId = 4;
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await page.getByText("Playtest tools", { exact: true }).click();
}
test("harvest rewards animate from the tile, count up, and stay correct across rapid harvests and spending", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(r.url()));
  await orchard(page);
  await page.locator('[data-structure="2"]').click();
  await expect(page.locator(".harvest-reward")).toContainText("+24");
  expect(Number(await page.locator("#coin-count").textContent())).toBeLessThan(
    124,
  );
  await expect(page.locator(".harvest-coin").first()).toBeAttached();
  await expect(page.locator('[data-structure="2"]')).not.toHaveAttribute(
    "aria-label",
    /ready to harvest/,
  );
  await expect
    .poll(async () =>
      Number(
        (await page.locator("#coin-count").textContent())?.replaceAll(",", ""),
      ),
    )
    .toBeGreaterThan(100);
  await expect(page.locator("#coin-count")).toHaveText("124");
  // Harvest stays in Plant mode so neighbors can be picked without changing tools.
  await expect(page.locator("#service-panel")).toBeHidden();
  await page.locator('[data-structure="3"]').click();
  await expect(page.locator('[data-structure="3"]')).not.toHaveAttribute(
    "aria-label",
    /ready to harvest/,
  );
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("#season .sr-only")).toContainText("141 coins");
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator("#coin-count")).toHaveText("137");
  await expect(page.locator(".harvest-feedback")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#coin-count")).toHaveText("137");
  for (const id of [2, 3])
    await expect(page.locator(`[data-structure="${id}"]`)).not.toHaveAttribute(
      "aria-label",
      /ready to harvest/,
    );
  expect(errors).toEqual([]);
});
test("failed harvest saves create no reward, and reduced motion settles the count immediately", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await orchard(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      IDBObjectStore.prototype.put = put;
      this.transaction.abort();
      return put.apply(this, args);
    };
  });
  await page.locator('[data-structure="2"]').click();
  await expect(page.locator("#farm-message")).toContainText(
    /abort|save|transaction/i,
  );
  await expect(page.locator("#coin-count")).toHaveText("100");
  await expect(page.locator(".harvest-feedback")).toHaveCount(0);
  await expect(page.locator('[data-structure="2"]')).toHaveAttribute(
    "aria-label",
    /ready to harvest/,
  );
  await page.locator('[data-structure="2"]').click();
  await expect(page.locator("#farm-message")).toContainText("Apples harvested");
  await expect(page.locator("#coin-count")).toHaveText("124");
  await expect(page.locator(".harvest-coin")).toHaveCount(0);
});
