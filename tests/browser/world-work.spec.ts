import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { readFarm, setFarm, closeActions } from "./context-helpers";

// Observe in the browser before the action: a busy runner can spend longer than
// the entire fade returning from click(), so driver polling can miss it.
async function observeRemoval(page: Page, name: string) {
  await page.locator("canvas").evaluate((canvas, expectedName) => {
    delete canvas.dataset.testObservedRemoval;
    const observer = new MutationObserver(() => {
      const removing = JSON.parse(canvas.dataset.sceneRemoving ?? "[]") as {
        name: string;
        alpha: number;
      }[];
      if (
        removing.some(
          (view) =>
            view.name === expectedName && view.alpha > 0 && view.alpha < 1,
        )
      ) {
        canvas.dataset.testObservedRemoval = expectedName;
        observer.disconnect();
      }
    });
    observer.observe(canvas, {
      attributes: true,
      attributeFilter: ["data-scene-removing"],
    });
  }, name);
}

test("construction markers cover hives, pens, trees and distinct buildings", async ({
  page,
}) => {
  await page.goto("/?instance=validation-construction-markers");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const farm = await readFarm(page);
  for (const kind of ["beehive", "coop", "apple", "mill"]) {
    await setFarm(page, {
      ...farm,
      plotIds: [],
      nextPlotId: 1,
      plotCells: [],
      plots: [],
      debris: [],
      structures: [
        {
          id: 1,
          kind,
          row: 16,
          col: 16,
          level: 1,
          age: 0,
          pendingConstruction: true,
        },
      ],
      nextStructureId: 2,
    });
    await closeActions(page);
    await page.locator('[data-cell="16,16"]').scrollIntoViewIfNeeded();
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-scene-construction",
      "1",
    );
  }
});

test("obstacle previews follow rectangular and L-shaped occupied lots", async ({
  page,
}) => {
  await page.goto("/?instance=validation-obstacle-previews");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const farm = await readFarm(page);
  for (const kind of ["boulder", "fallenTree"]) {
    await setFarm(page, {
      ...farm,
      plotIds: [],
      nextPlotId: 1,
      plotCells: [],
      plots: [],
      structures: [],
      debris: [{ kind, row: 16, col: 16 }],
    });
    await closeActions(page);
    const tile = page.locator('[data-cell="16,16"]');
    await tile.scrollIntoViewIfNeeded();
    await tile.hover({ force: true });
    await expect(page.locator("#placement-preview")).toBeVisible();
    await expect(page.locator("#building-tooltip")).toHaveText(
      kind === "boulder" ? "Boulder" : "Fallen tree",
    );
    if (kind === "fallenTree")
      expect(
        await page
          .locator("#placement-preview")
          .evaluate((el) => getComputedStyle(el).clipPath),
      ).toContain("83.333%");
    await tile.press("Enter");
    await expect(page.locator("#service-panel")).toBeVisible();
    await expect(page.locator("[data-context]")).toHaveCount(
      kind === "boulder" ? 4 : 5,
    );
  }
});

test("cleared obstacles fade once while their tiles become available immediately", async ({
  page,
}) => {
  await page.goto("/?instance=validation-obstacle-removal");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const farm = await readFarm(page);
  await setFarm(page, {
    ...farm,
    plotIds: [],
    nextPlotId: 1,
    plotCells: [],
    plots: [],
    structures: [],
    debris: [{ kind: "fallenTree", row: 16, col: 16 }],
  });
  // Replacing the homestead also fades its former plots and buildings. Finish
  // that fixture transition before measuring this obstacle's own removal.
  await expect
    .poll(async () =>
      page
        .locator("canvas")
        .evaluate(
          (canvas) => JSON.parse(canvas.dataset.sceneRemoving ?? "[]").length,
        ),
    )
    .toBe(0);
  await closeActions(page);
  await page.locator('[data-cell="16,16"]').press("Enter");
  await expect(page.locator("#service-panel")).toBeVisible();
  await observeRemoval(page, "debris:16,16");
  await page
    .getByRole("button", { name: "Clear · 36 coins", exact: true })
    .click();
  const removals = () =>
    page.locator("canvas").evaluate(
      (canvas) =>
        JSON.parse(canvas.dataset.sceneRemoving ?? "[]") as {
          name: string;
          alpha: number;
        }[],
    );
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-test-observed-removal",
    "debris:16,16",
  );
  // Both arms share one removal; the simulation has already released all five cells.
  expect((await removals()).every((view) => view.name === "debris:16,16")).toBe(
    true,
  );
  await expect(page.locator('[data-cell="16,16"]')).toHaveAttribute(
    "aria-label",
    /Land 16,16/,
  );
  // A camera redraw during the fade must neither destroy nor re-register these arms.
  await page.locator("#farm").evaluate((view) => {
    view.scrollLeft += 20;
  });
  await expect.poll(async () => (await removals()).length).toBe(0);
  const current = await readFarm(page);
  expect(current.debris).toEqual([]);
});

for (const planted of [false, true])
  test(`deleting a ${planted ? "planted" : "empty"} field fades its soil into grass`, async ({
    page,
  }) => {
    await page.goto(`/?instance=validation-field-removal-${planted}`);
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    const farm = await readFarm(page);
    await setFarm(page, {
      ...farm,
      plotIds: [1],
      nextPlotId: 2,
      plotCells: [{ row: 16, col: 16 }],
      plots: [planted ? { crop: "turnip", growth: 0 } : null],
      debris: [],
      structures: [],
    });
    await closeActions(page);
    await page.locator('[data-cell="16,16"]').press("Enter");
    await expect(page.locator("#service-panel")).toBeVisible();
    await observeRemoval(page, "soil:16,16");
    await page.locator("#delete-plot").click();
    await page.locator("#confirm-delete").click();
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-test-observed-removal",
      "soil:16,16",
    );
    await expect(page.locator('[data-cell="16,16"]')).toHaveAttribute(
      "aria-label",
      "Land 16,16",
    );
    await page.locator("#farm").evaluate((view) => {
      view.scrollLeft += 20;
    });
    await expect
      .poll(() => page.locator("canvas").getAttribute("data-scene-removing"))
      .toBe("[]");
    const current = await readFarm(page);
    expect(current.plotCells).toEqual([]);
    await page.reload();
    await expect(page.locator('[data-cell="16,16"]')).toHaveAttribute(
      "aria-label",
      "Land 16,16",
    );
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-scene-removing",
      "[]",
    );
  });
