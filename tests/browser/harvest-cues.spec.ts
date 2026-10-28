import { test, expect } from "./fixtures";
import { readFarm, setFarm, closeActions } from "./context-helpers";
import { endTurn } from "./helpers";

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 320, height: 568 },
  { width: 667, height: 375 },
])
  test(`harvest readiness uses artwork without floating text ${viewport.width}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => errors.push(request.url()));
    await page.setViewportSize(viewport);
    await page.goto("/?instance=validation-harvest-cues");
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    const farm = await readFarm(page);
    const structures = [
      "beehive",
      "coop",
      "dairy",
      "sheepfold",
      "apple",
      "oak",
    ].map((kind, index) => ({
      id: index + 1,
      kind,
      row: 16,
      col: 16,
      level: 1,
      age: kind === "oak" ? 40 : 12,
      product: true,
    }));
    for (const structure of structures) {
      for (const ready of [true, false]) {
        await setFarm(page, {
          ...farm,
          honeyReady: false,
          debris: [],
          plotIds: [],
          nextPlotId: 1,
          plotCells: [],
          plots: [],
          structures: [{ ...structure, product: ready }],
          nextStructureId: 7,
        });
        await closeActions(page);
        await page.locator('[data-cell="16,16"]').scrollIntoViewIfNeeded();
        await expect(page.locator("canvas")).toHaveAttribute(
          "data-scene-labels",
          "0",
        );
        const expected =
          ready && !["apple", "oak"].includes(structure.kind)
            ? JSON.stringify([structure.kind])
            : "[]";
        await expect(page.locator("canvas")).toHaveAttribute(
          "data-scene-harvest-cues",
          expected,
        );
        if (
          process.env.HARVEST_SCREENSHOTS &&
          ready &&
          ["beehive", "coop"].includes(structure.kind)
        ) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.locator("#farm").evaluate((farm) => {
            const tile = document
              .querySelector('[data-cell="16,16"]')!
              .getBoundingClientRect();
            const bounds = farm.getBoundingClientRect();
            farm.scrollTop += tile.y + tile.height / 2 - (bounds.bottom - 120);
          });
          await page.screenshot({
            path: `/tmp/harvest-${structure.kind}-${viewport.width}.png`,
          });
        }
        // Fruit on the trees and ripe crop stages remain their own natural readiness artwork.
      }
    }
    for (const growth of [0, 1]) {
      await setFarm(page, {
        ...farm,
        honeyReady: false,
        debris: [],
        structures: [],
        plotIds: [1],
        nextPlotId: 2,
        plotCells: [{ row: 16, col: 16 }],
        plots: [{ crop: "turnip", growth }],
      });
      await closeActions(page);
      await page.locator('[data-cell="16,16"]').scrollIntoViewIfNeeded();
      await expect(page.locator("canvas")).toHaveAttribute(
        "data-scene-labels",
        "0",
      );
      await expect(page.locator("canvas")).toHaveAttribute(
        "data-scene-harvest-cues",
        "[]",
      );
    }
    for (const ready of [true, false]) {
      await setFarm(page, {
        ...farm,
        honeyReady: ready,
        debris: [],
        structures: [],
      });
      await closeActions(page);
      await page.locator('[data-service="hive"]').scrollIntoViewIfNeeded();
      await expect(page.locator("canvas")).toHaveAttribute(
        "data-scene-labels",
        "0",
      );
      await expect(page.locator("canvas")).toHaveAttribute(
        "data-scene-harvest-cues",
        ready ? '["wild-hive"]' : "[]",
      );
    }
    expect(errors).toEqual([]);
  });

test("an upgrading coop keeps its collectible readiness cue", async ({
  page,
}) => {
  await page.goto("/?instance=validation-upgrade-cue");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const farm = await readFarm(page);
  await setFarm(page, {
    ...farm,
    honeyReady: false,
    debris: [],
    plots: [],
    plotIds: [],
    plotCells: [],
    nextPlotId: 1,
    structures: [
      {
        id: 1,
        kind: "coop",
        row: 16,
        col: 16,
        level: 1,
        product: true,
        pendingUpgrade: true,
      },
    ],
    nextStructureId: 2,
  });
  await closeActions(page);
  await page.locator('[data-cell="16,16"]').scrollIntoViewIfNeeded();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-scene-harvest-cues",
    '["coop"]',
  );
  await page.locator('[data-structure="1"]').press("Enter");
  await expect(page.locator("#collect-animal")).toBeEnabled();
  await page.locator("#collect-animal").click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-scene-harvest-cues",
    "[]",
  );
  await endTurn(page);
  await page.locator('[data-cell="16,16"]').scrollIntoViewIfNeeded();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-scene-harvest-cues",
    /coop/,
  );
});
