import { expectAdjacentToCell } from "./context-helpers";
import { openCanvasHarness } from "./canvas-harness";
import { test, expect } from "./fixtures";
import {
  buildingArtwork,
  distinctBuildingRects,
  distinctStructures,
  distinctServices,
} from "../../src/game/building-artwork";
import {
  buildings,
  isTree,
  services,
  type BuildingKind,
} from "../../src/micro/world";

test("seasonal, construction and distinct sprite bases stay inside occupied tiles", async ({
  page,
}) => {
  await openCanvasHarness(page);
  const measured = await page.evaluate(async (distinctRects) => {
    const modulePath = "/src/game/atlas-isolation.ts";
    const { isolateAtlas, gridFrames } = await import(
      /* @vite-ignore */ modulePath
    );
    const result: {
      frame: number;
      distinct: boolean;
      minRow: number;
      minCol: number;
      maxRow: number;
      maxCol: number;
    }[] = [];
    for (const file of [
      "farm-atlas.png",
      "farm-atlas-fall.png",
      "farm-atlas-winter.png",
      "farm-states.png",
      "distinct-buildings.png",
    ]) {
      const image = new Image();
      image.src = `/art/${file}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      const frames =
        file === "distinct-buildings.png"
          ? distinctRects.map(([x, y, width, height]) => ({
              x,
              y,
              width,
              height,
            }))
          : gridFrames(image.width, image.height, 3, 2);
      context.drawImage(isolateAtlas(image, frames), 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      const distinct = file === "distinct-buildings.png";
      const rects = distinct
        ? distinctRects
            .slice(0, 7)
            .map((r, frame) => [
              frame,
              Math.round((r[0] * image.width) / 1254),
              Math.round((r[1] * image.height) / 1254),
              Math.round((r[2] * image.width) / 1254),
              Math.round((r[3] * image.height) / 1254),
            ])
        : [0, 1, 3, 4].map((frame) => [
            frame,
            ((frame % 3) * image.width) / 3,
            (Math.floor(frame / 3) * image.height) / 2,
            image.width / 3,
            image.height / 2,
          ]);
      for (const [frame, ox, oy, width, height] of rects) {
        let minRow = Infinity,
          minCol = Infinity,
          maxRow = -Infinity,
          maxCol = -Infinity;
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            if (pixels[((y + oy) * image.width + x + ox) * 4 + 3] <= 32)
              continue;
            const row = (2 * y) / width - x / width,
              col = (2 * y) / width + x / width;
            maxRow = Math.max(maxRow, row);
            maxCol = Math.max(maxCol, col);
            if (y / height >= 0.84) {
              minRow = Math.min(minRow, row);
              minCol = Math.min(minCol, col);
            }
          }
        result.push({ frame, distinct, minRow, minCol, maxRow, maxCol });
      }
    }
    return result;
  }, distinctBuildingRects);
  const lots = [
    ...Object.entries(buildings)
      .filter(([kind]) => !isTree(kind as BuildingKind))
      .map(([kind, item]) => ({
        ...item,
        frame: distinctStructures[kind as BuildingKind] ?? item.frame,
        distinct: distinctStructures[kind as BuildingKind] !== undefined,
      })),
    ...services.map((s) => ({
      ...s,
      frame: distinctServices[s.id] ?? s.frame,
      distinct: s.id !== "home",
    })),
  ];
  for (const lot of lots)
    for (const sample of measured.filter(
      (s) => s.frame === lot.frame && s.distinct === lot.distinct,
    )) {
      const art = buildingArtwork(
        { ...lot, row: 11, col: 14 },
        lot.frame,
        lot.distinct,
      );
      expect(art.row + (sample.maxRow * art.size) / 64).toBeLessThan(
        11 + lot.height - 0.5,
      );
      expect(art.col + (sample.maxCol * art.size) / 64).toBeLessThan(
        14 + lot.width - 0.5,
      );
      expect(art.row + (sample.minRow * art.size) / 64).toBeGreaterThan(10.5);
      expect(art.col + (sample.minCol * art.size) / 64).toBeGreaterThan(13.5);
    }
});

test("front neighbor tiles remain walkable while building artwork still opens its menu", async ({
  page,
}) => {
  await page.goto("/?instance=validation-footprint-clicks");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  for (const cell of ["13,15", "12,17"]) {
    await page.locator(`[data-cell="${cell}"]`).click();
    await expect(canvas).toHaveAttribute("data-farmer-target", cell);
    await expectAdjacentToCell(page, cell);
    await expect(page.locator("#service-panel")).toBeVisible();
    await expect(page.locator("#service-title")).toHaveText("Open land");
    await page.locator("#close-service").click();
  }
  const art = buildingArtwork({ row: 11, col: 14, width: 3, height: 2 }, 0);
  const anchor = await page.locator('[data-cell="11,14"]').boundingBox();
  const x =
    anchor!.x +
    anchor!.width / 2 +
    (art.col - 14 - art.row + 11) * 32 +
    art.size * 0.5;
  const y =
    anchor!.y +
    anchor!.height / 2 +
    (art.col - 14 + art.row - 11) * 16 +
    art.size * 0.4;
  await page.mouse.click(x, y);
  await expect(page.locator("#service-panel")).toBeVisible();
  await expect(page.locator("#service-title")).toHaveText("Farmhouse");
});
