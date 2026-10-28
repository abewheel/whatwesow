import { visitBuilding, endTurn } from "./helpers";
import { test, expect } from "./fixtures";
import { homesteadState as initialState } from "../../src/game/state";

test("buildings own their actions and selecting seeds returns to field work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(r.url()));
  await page.goto("/?instance=validation-services");
  await expect(page.locator("[data-service=seeds]")).toBeAttached();
  await expect(page.locator("#crop-options")).toBeHidden();
  await expect(page.locator("#next-season")).toBeHidden();
  const seed = initialState();
  seed.harvests.turnip = 3;
  await page.locator("#import").setInputFiles({
    name: "farm.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(seed)),
  });
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const shop = await page.locator("[data-service=seeds]").boundingBox();
  await page.mouse.click(
    shop!.x + shop!.width / 2,
    shop!.y + shop!.height / 2 - 50,
  );
  await expect(page.locator("#service-title")).toHaveText(
    "Seed shop & nursery",
  );
  await page.locator("[data-crop=carrot]").click();
  await expect(page.locator("#service-panel")).toBeHidden();
  await page.locator("[data-plot='0']").click();
  await expect(page.locator("#season")).toContainText("93 coins");
  await page.locator("[data-structure='1']").click();
  await expect(page.locator("#service-title")).toHaveText("Farmhouse");
  await page.locator("#next-season").click();
  await expect(page.locator("#season")).toContainText("summer");
  await visitBuilding(page, "builder");
  await expect(page.locator("#service-title")).toHaveText("Builder's workshop");
  await page.locator("[data-build=shed]").click();
  await expect(page.locator("#service-panel")).toBeHidden();
  await page.locator("[data-cell='14,18']").click();
  await expect(page.locator("#farm-message")).toContainText(
    "Seed storehouse construction started",
  );
  await page.keyboard.press("Escape");
  await page.locator("[data-service=builder]").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#service-panel")).toBeHidden();
  expect(errors).toEqual([]);
});

test("outlying older saves remain exportable and cannot be overwritten by farming", async ({
  page,
}) => {
  const original = initialState();
  original.plotCells[0] = { row: 127, col: 127 };
  await page.goto("/?instance=validation-old-estate");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.evaluate(async (saved) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("whatwesow-dev-validation-old-estate", 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("saves", "readwrite");
      tx.objectStore("saves").put(saved, "current");
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, original);
  await page.reload();
  await expect(page.locator("#save-status")).toContainText("64 × 64");
  await visitBuilding(page, "home");
  await page
    .getByRole("button", { name: "Prepare fields", exact: true })
    .click();
  await page.locator("#expand").click();
  await page.locator('[data-cell="16,16"]').click();
  await expect(page.locator("#farm-message")).toContainText(
    "Export your original save",
  );
  await page.locator("#farm-mode").click();
  const download = page.waitForEvent("download");
  await page.locator("#open-menu").click();
  await page.locator("#export").click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(original);
  await page.locator("#import").setInputFiles({
    name: "farm.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(initialState())),
  });
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.locator("#resume").click();
  await page.locator("[data-plot='0']").click();
  await expect(page.locator("#season")).toContainText("96 coins");
});

test("imported farms keep their plots and relocated shops work with the keyboard", async ({
  page,
}) => {
  await page.goto("/?instance=validation-relocated-service");
  await expect(page.locator("[data-service=seeds]")).toHaveAttribute(
    "data-cell",
    "7,14",
  );
  const saved = initialState();
  saved.plotCells[0] = { row: 7, col: 14 };
  await page.locator("#import").setInputFiles({
    name: "farm.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await expect(page.locator("[data-service=seeds]")).toHaveAttribute(
    "data-cell",
    "0,0",
  );
  await expect(page.locator("[data-plot='0']")).toHaveAttribute(
    "data-cell",
    "7,14",
  );
  await page.locator("[data-service=seeds]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#service-title")).toHaveText(
    "Seed shop & nursery",
    { timeout: 30000 },
  );
  await expect(page.locator("#crop-options")).toBeVisible();
});

test("field work, nursery purchases, and structural work each stay at their own building", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(r.url()));
  await page.goto("/?instance=validation-service-roles");
  await expect(page.locator("[data-service=fields]")).toBeAttached();
  const saved = initialState();
  saved.year = 4;
  saved.coins = 1000;
  saved.harvests.turnip = 100;
  saved.structures.push({
    id: 2,
    kind: "apple",
    row: 21,
    col: 21,
    level: 1,
    age: 12,
    product: false,
  });
  saved.nextStructureId = 3;
  await page.locator("#import").setInputFiles({
    name: "farm.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await expect(page.locator("#season")).toContainText("1,000 coins");
  await visitBuilding(page, "builder");
  await expect(page.locator("#expand")).toBeHidden();
  await expect(page.locator("#improve")).toBeHidden();
  await expect(page.locator("[data-build=apple]")).toBeHidden();
  await expect(page.locator("[data-build=shed]")).toBeVisible();
  await expect(page.locator("#structure-target option")).toHaveCount(2);
  await page.locator("#structure-target").selectOption("1");
  await expect(page.locator("#move-building")).toBeVisible();
  await expect(page.locator("#upgrade-building")).toBeHidden();
  await visitBuilding(page, "seeds");
  await expect(page.locator("[data-build=apple]")).toBeVisible();
  await expect(page.locator("[data-build=oak]")).toBeVisible();
  await expect(page.locator("[data-build=well]")).toBeHidden();
  await page.locator("[data-build=oak]").click();
  await page.locator("[data-cell='21,24']").click();
  await expect(page.locator("#farm-message")).toContainText("Oak tree planted");
  await page.keyboard.press("Escape");
  await page.locator("[data-structure='2']").click();
  await expect(page.locator("#service-title")).toHaveText("Field shed");
  await expect(page.locator("#upgrade-building")).toContainText(
    "Improve tree care",
  );
  await page.locator("#upgrade-building").click();
  await expect(page.locator("#upgrade-building")).toContainText("underway");
  await page.locator("#improve").click();
  await expect(page.locator("#farm-summary")).toContainText("Soil level 0/3");
  await expect(page.locator("#move-building")).toHaveText(
    "Transplant selected tree",
  );
  await page.locator("#move-building").click();
  await page.locator("[data-cell='24,24']").click();
  await expect(page.locator("#farm-message")).toContainText("Apple tree moved");
  await page.keyboard.press("Escape");
  await page.locator("[data-service=fields]").click();
  await expect(page.locator("#expand")).toBeVisible();
  await expect(page.locator("[data-build=barn]")).toBeHidden();
  await expect(page.locator("#structure-target option")).toHaveCount(3);
  await visitBuilding(page, "home");
  await expect(page.locator("#next-season")).toBeVisible();
  await expect(page.locator("#structure-inspection")).toBeHidden();
  await expect(page.locator("#grow")).toHaveCount(0);
  await endTurn(page);
  await expect(page.locator("#farm-summary")).toContainText("Soil level 1/3");
  expect(errors).toEqual([]);
});

test("farms without a home keep an arrival-gated calendar", async ({
  page,
}) => {
  await page.goto("/?instance=validation-calendar-recovery");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = initialState();
  state.structures = [];
  state.season = "winter";
  state.coins = 100;
  await page.locator("#import").setInputFiles({
    name: "farm.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await expect(page.locator('[data-service="home"]')).toBeAttached();
  await visitBuilding(page, "home");
  await page.locator("#next-season").click();
  await expect(page.locator("#season")).toContainText("Year 2 · spring");
});

test("dense imported farms can visit roadside services without losing plots", async ({
  page,
}) => {
  await page.goto("/?instance=validation-dense-services");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const state = initialState();
  state.structures = [];
  state.plotCells = Array.from({ length: 1024 }, (_, i) => ({
    row: Math.floor(i / 32) * 2,
    col: (i % 32) * 2,
  }));
  state.plots = state.plotCells.map(() => null);
  state.plotIds = state.plotCells.map((_, i) => i + 1);
  state.nextPlotId = 1025;
  await page.locator("#import").setInputFiles({
    name: "farm.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await expect(page.locator('[data-service="fields"]')).toHaveAttribute(
    "data-cell",
    "-2,24",
  );
  await visitBuilding(page, "fields");
  await expect(page.locator("#move-plot")).toBeVisible();
  await expect(page.locator("[data-plot]")).toHaveCount(1024);
});
