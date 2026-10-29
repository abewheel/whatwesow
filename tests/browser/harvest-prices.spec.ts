import { test, expect } from "./fixtures";
import { closeActions, openCell, readFarm } from "./context-helpers";
import { applyState, farmAt, records } from "./crisis-helpers";
import { endTurn, visitBuilding } from "./helpers";

const farm = farmAt(6, records(["D-LIB-P"], [6]), []);
farm.seeds.tomato = 1;
for (const device of [
  {
    name: "desktop",
    width: 1280,
    height: 800,
  },
  { name: "portrait", width: 320, height: 568 },
  {
    name: "landscape",
    width: 667,
    height: 375,
  },
]) {
  test.describe(device.name, () => {
    test.use({
      farmState: farm,
      viewport: { width: device.width, height: device.height },
      hasTouch: device.name !== "desktop",
    });
    test("tomato drought forecast matches the harvested coins", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("requestfailed", (request) => errors.push(request.url()));
      await page.goto(`/?instance=validation-harvest-prices-${device.name}`);
      await expect(page.locator("#save-status")).toHaveText(
        "Saved on this browser",
      );
      await page.locator("#open-inventory").click();
      await page.locator("#open-seed-shop").click();
      await expect(page.locator("#weather-status")).toHaveAttribute(
        "data-weather",
        "drought",
      );
      const range = page.locator('[data-buy-seed="tomato"] .seed-sale-range');
      await expect(range).toHaveAttribute("data-dry", "10");
      await expect(range).toHaveAttribute("data-wet", "21");
      await expect(page.locator("#sale-forecast-note")).toHaveCount(0);
      if (process.env.PRICE_SCREENSHOTS_DIR) {
        await range.evaluate((element) => {
          const body = element.closest(".service-body")!;
          body.scrollTop = body.scrollHeight;
        });
        await page.screenshot({
          path: `${process.env.PRICE_SCREENSHOTS_DIR}/shop-${device.name}.png`,
        });
      }
      await expect(page.locator('[data-buy-seed="tomato"]')).toHaveAttribute(
        "aria-label",
        /harvest 21 coins/,
      );
      await openCell(page, "16,16");
      const tomato = page.locator('[data-crop="tomato"]');
      await expect(tomato.locator('[data-metric="harvest"]')).toHaveAttribute(
        "data-water",
        "dry",
      );
      await expect(tomato.locator('[data-metric="harvest"]')).toContainText(
        "10",
      );
      await expect(tomato).not.toContainText(
        "Drought: half yield without water.",
      );
      if (process.env.PRICE_SCREENSHOTS_DIR)
        await page.screenshot({
          path: `${process.env.PRICE_SCREENSHOTS_DIR}/tomato-${device.name}.png`,
        });
      await tomato.click();
      await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
        "aria-label",
        /Tomato, growing/,
      );
      await openCell(page, "16,16");
      await expect(page.locator(".crop-water-status")).toHaveAttribute(
        "data-water",
        "danger",
      );
      if (process.env.PRICE_SCREENSHOTS_DIR)
        await page.screenshot({
          path: `${process.env.PRICE_SCREENSHOTS_DIR}/crop-${device.name}.png`,
        });
      await visitBuilding(page, "home");
      await expect(page.locator("#water-transition")).toHaveAttribute(
        "data-drying",
        "1",
      );
      if (process.env.PRICE_SCREENSHOTS_DIR) {
        await page.locator("#water-transition").evaluate((element) => {
          const body = element.closest(".service-body")!;
          body.scrollTop +=
            element.getBoundingClientRect().bottom -
            body.getBoundingClientRect().bottom;
        });
        await page.screenshot({
          path: `${process.env.PRICE_SCREENSHOTS_DIR}/transition-${device.name}.png`,
        });
      }
      await endTurn(page);
      await expect(page.locator("#weather-status")).toHaveAttribute(
        "data-weather",
        "normal",
      );
      const before = await readFarm(page);
      expect(before.plots[0].dry).toBe(true);
      await closeActions(page);
      await page.locator('[data-plot="0"]').press("Enter");
      await expect(page.locator("#farm-message")).toContainText(
        "Tomato harvested! +10 coins",
      );
      expect((await readFarm(page)).coins - before.coins).toBe(10);
      await expect(page.locator("#service-panel")).toBeHidden();
      expect(errors).toEqual([]);
    });
  });
}

test("water previews distinguish ripe, protected and previously dried crops", async ({
  page,
}) => {
  await page.goto("/?instance=validation-water-timing");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const thirsty = farmAt(6, records(["D-LIB-P"], [6]), [
    { crop: "tomato", growth: 0 },
  ]);
  thirsty.water = { turn: 6, choice: "bought", plots: [thirsty.plotIds[0]] };
  await applyState(page, thirsty);
  await openCell(page, "16,16");
  await expect(page.locator(".crop-water-status")).toHaveAttribute(
    "data-water",
    "watered",
  );
  await visitBuilding(page, "home");
  await expect(page.locator("#water-transition")).toHaveCount(0);
  delete thirsty.water;
  thirsty.plots[0] = { crop: "tomato", growth: 1 };
  await applyState(page, thirsty);
  await visitBuilding(page, "home");
  await expect(page.locator("#water-transition")).toHaveCount(0);
  const dry = farmAt(7, records(["D-LIB-P"], [6]), [
    { crop: "corn", growth: 1, dry: true },
  ]);
  await applyState(page, dry);
  await expect(page.locator("#weather-status")).toHaveAttribute(
    "data-weather",
    "normal",
  );
  await openCell(page, "16,16");
  await expect(page.locator(".crop-water-status")).toHaveAttribute(
    "data-water",
    "dry",
  );
});

test("irrigation limits show death separately from reduced harvests", async ({
  page,
}) => {
  await page.goto("/?instance=validation-water-limit-icons");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const capped = farmAt(
    70,
    records(
      ["D-LIB-P", "B-SOC", "E-SOC", "O-SOC", "D-PRO-M"],
      [6, 22, 37, 55, 69],
    ),
    [
      { crop: "corn", growth: 0 },
      { crop: "tomato", growth: 0 },
      { crop: "pumpkin", growth: 0 },
    ],
  );
  capped.seeds.tomato = 1;
  await applyState(page, capped);
  await visitBuilding(page, "home");
  await expect(page.locator("#water-transition .water-drying")).toContainText(
    "2",
  );
  await expect(
    page.locator("#water-transition .water-withering"),
  ).toContainText("1");
  if (process.env.PRICE_SCREENSHOTS_DIR)
    await page.screenshot({
      path: `${process.env.PRICE_SCREENSHOTS_DIR}/mixed-water.png`,
    });
  await openCell(page, "15,17");
  const metric = page.locator('[data-crop="tomato"] [data-metric="harvest"]');
  await expect(metric).toHaveAttribute("data-water", "withering");
  await expect(metric.locator(".metric-value")).toHaveText("0");
  await page.locator('[data-crop="tomato"]').click();
  await expect(page.locator('[data-plot="3"]')).toHaveAttribute(
    "aria-label",
    /Tomato, growing/,
  );
  await endTurn(page);
  expect((await readFarm(page)).plots[3].withered).toBe(true);
});
