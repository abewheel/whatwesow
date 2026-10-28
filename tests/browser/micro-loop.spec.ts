import { test, expect } from "./fixtures";
import { homesteadState } from "../../src/game/state";
import { visitBuilding, endTurn } from "./helpers";
import {
  buildingArtwork,
  hitsBuildingArtwork,
} from "../../src/game/building-artwork";

test("recovers from a farmhouse enclosed by trees without spending coins", async ({
  page,
}) => {
  await page.goto("/?instance=validation-blocked-recovery");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = homesteadState();
  const ring = [
    ...[14, 15, 16].map((col) => ({ row: 10, col })),
    ...[14, 15, 16].map((col) => ({ row: 13, col })),
    ...[11, 12].flatMap((row) => [13, 17].map((col) => ({ row, col }))),
  ];
  state.structures.push(
    ...ring.map((cell, i) => ({
      ...cell,
      id: i + 2,
      kind: "oak" as const,
      level: 1,
      age: 40,
    })),
  );
  state.nextStructureId = 12;
  await page.getByLabel("Work on").selectOption("full");
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await page.locator('[data-structure="1"]').press("Enter");
  await expect(page.locator("#farm-message")).toHaveText(
    "No walking path to Farmhouse.",
  );
  await page.getByRole("button", { name: "Open farm menu" }).click();
  await page.getByRole("button", { name: "Clear blocked access" }).click();
  await page.locator("#structure-target").selectOption("6");
  await page.locator("#move-building").click();
  await page.locator('[data-cell="20,20"]').click();
  await expect(page.locator("#farm-message")).toContainText(
    "moved. No coins spent",
  );
  await page.locator('[data-structure="1"]').press("Enter");
  await expect(page.locator("#service-panel")).toBeVisible();
  await expect(page.locator("#next-season")).toBeEnabled();
  await expect(page.locator("#season-guide")).toContainText(
    "Plant turnip or carrot",
  );
  await page.locator("#next-season").click();
  await expect(page.locator("#season")).toContainText("summer");
  await expect(page.locator("#season")).toContainText("100 coins");
});

test("quotes repeated facilities and remaining market payback", async ({
  page,
}) => {
  await page.goto("/?instance=validation-economy-quotes");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = {
    ...homesteadState(),
    year: 30,
    coins: 20000,
    harvests: { turnip: 300, carrot: 1, corn: 12 },
    opportunities: ["well", "market"],
  };
  await page.getByLabel("Work on").selectOption("full");
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await visitBuilding(page, "builder");
  await expect(page.locator('[data-build="market"]')).toContainText(
    "20 seasons to repay · 43 seasons left",
  );
  await page.locator('[data-build="well"]').click();
  await page.locator('[data-cell="14,20"]').click();
  await expect(page.locator("#farm-message")).toContainText("−180 coins");
  await page.locator("#farm-mode").click();
  await visitBuilding(page, "builder");
  await expect(page.locator('[data-build="well"]')).toHaveAttribute(
    "aria-label",
    /360 coins/,
  );
  await page.locator('[data-build="market"]').click();
  await page.locator('[data-cell="19,20"]').click();
  await expect(page.locator("#farm-message")).toContainText("−3000 coins");
  await page.locator("#farm-mode").click();
  await visitBuilding(page, "home");
  await page.locator("#next-season").click();
  await expect(page.locator("#season")).toContainText("summer");
  await visitBuilding(page, "builder");
  await page.locator("#structure-target").selectOption("3");
  await expect(page.locator("#selected-building")).toContainText(
    "Upgrade repays in 40 seasons; 42 seasons remain",
  );
});

test("seed forecasts match irrigation and the crop ripens in the advertised season", async ({
  page,
}) => {
  await page.goto("/?instance=validation-irrigation-forecast");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = homesteadState();
  state.harvests = { turnip: 1, carrot: 1, corn: 0 };
  state.structures.push({ id: 2, kind: "well", row: 18, col: 20, level: 2 });
  state.nextStructureId = 3;
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await visitBuilding(page, "seeds");
  await expect(page.locator('[data-crop="corn"]')).toHaveAttribute(
    "aria-label",
    /1 season to grow/,
  );
  await page.locator('[data-crop="corn"]').click();
  await expect(page.locator("#farm-message")).toContainText(
    "Corn · 1 season to grow",
  );
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /Corn, growing/,
  );
  await endTurn(page);
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /Corn, ready/,
  );
});

test("selects the visible front building when newer rear artwork overlaps it", async ({
  page,
}) => {
  await page.goto("/?instance=validation-artwork-order");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = homesteadState();
  state.structures.push({ id: 2, kind: "barn", row: 9, col: 13, level: 1 });
  state.nextStructureId = 3;
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await page.locator("#farm").scrollIntoViewIfNeeded();
  const project = ({ row, col }: { row: number; col: number }) => ({
    x: 2304 + (col - row) * 32,
    y: 160 + (col + row) * 16,
  });
  const candidates: { x: number; y: number }[] = [];
  const home = { row: 11, col: 14, width: 3, height: 2 },
    barn = { row: 9, col: 13, width: 3, height: 2 };
  const anchor = project(home);
  for (let y = anchor.y - 120; y < anchor.y + 30; y += 2)
    for (let x = anchor.x - 150; x < anchor.x + 150; x += 2)
      if (
        hitsBuildingArtwork({ x, y }, home, 0, project) &&
        hitsBuildingArtwork({ x, y }, barn, 1, project)
      ) {
        candidates.push({ x, y });
      }
  const overlap = await page.evaluate(
    async ({ candidates, arts }) => {
      const image = new Image();
      image.src = "/art/farm-atlas.png";
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
      return candidates.find((p) =>
        arts.every((art, frame) => {
          const x =
            Math.floor((((p.x - art.x) / art.size) * image.width) / 3) +
            (frame * image.width) / 3;
          const y = Math.floor((((p.y - art.y) / art.size) * image.height) / 2);
          return pixels[(y * image.width + x) * 4 + 3] > 32;
        }),
      );
    },
    {
      candidates,
      arts: [home, barn].map((lot, frame) => {
        const art = buildingArtwork(lot, frame);
        return { ...project(art), size: art.size };
      }),
    },
  );
  expect(overlap).toBeDefined();
  const point = await page.locator("#farm").evaluate((el, p) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + p!.x - el.scrollLeft, y: r.y + p!.y - el.scrollTop };
  }, overlap);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("#service-panel")).toBeVisible();
  await expect(page.locator("#service-title")).toHaveText("Farmhouse");
});
