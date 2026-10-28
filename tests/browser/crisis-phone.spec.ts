// The council meeting, the farm's popups and council rules on phones.
import { test, expect } from "./fixtures";
import { visitBuilding } from "./helpers";
import { seasons } from "../../src/macro/state";
import { homesteadState } from "../../src/game/state";
import { plantQuote, saleQuote } from "../../src/micro/money";
import { crops } from "../../src/micro/state";
import {
  shot,
  begin,
  applyState,
  card,
  farmAt,
  fits,
  answerOnPhone,
  openPlot,
} from "./crisis-helpers";

test.describe("touch phone 320x568", () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true });
  test("a plot's crop choices state fees, fines and bans in plain words", async ({
    page,
  }) => {
    const errors = await begin(page, "seed-rules", "crisis-1");
    const policy = {
      permitsRequired: true,
      plantingFine: 0.25,
      plantingFee: 2,
      bannedCrops: ["pumpkin"],
      harvestTax: 0.2,
      sellDelay: { turnip: 0 },
    };
    // Summer, with one turnip planted so turnip sales wait under the sale delay.
    const state = farmAt(6, [], [{ crop: "turnip", growth: 0 }], {
      harvests: { ...homesteadState().harvests, turnip: 3, carrot: 1 },
      farmPolicy: policy,
      coins: 300,
    });
    await applyState(page, state);
    // The empty second plot offers this season's crops: turnip, tomato and pumpkin.
    await openPlot(page, 1);
    await expect(page.locator("#service-title")).toHaveText("Plant this plot");
    for (const crop of ["turnip", "tomato", "pumpkin"] as const) {
      const quote = plantQuote(state, crop, policy, 6, false, 1),
        sale = saleQuote(state, crop, policy, 6);
      const button = page.locator(`#tile-actions [data-crop="${crop}"]`);
      await expect(button.locator("strong")).toHaveText(crops[crop].name);
      await expect(button).toHaveAccessibleName(
        new RegExp(
          `harvest ${sale.value} coins after ${sale.tax} to the relief fund${crop === "turnip" ? ", paid next season" : ""}`,
        ),
      );
      await expect(button.locator(".crop-rule")).toHaveText(
        `${crop === "pumpkin" ? "Pumpkin is banned. " : ""}No planting permit this season. Planting anyway costs a ${quote.fine}-coin fine.`,
      );
      // The fee is in the button's visible text, so its accessible name carries it too.
      await expect(button).toHaveAccessibleName(/includes a 2-coin fee/);
    }
    // Nothing in the popup runs past the phone's edge.
    const body = page.locator(".service-body");
    expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    // The playtest tools sit below the farm.
    for (const crop of ["turnip", "pumpkin"]) {
      await page.locator(`[data-crop="${crop}"]`).scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, `ui-seeds-${crop}-320x568`);
    }
    expect(errors).toEqual([]);
  });
  test("what is owed fits the season bar in every season", async ({ page }) => {
    const errors = await begin(page, "owed", "crisis-1");
    for (const [i, season] of seasons.entries()) {
      await applyState(
        page,
        farmAt(5 + i, [], [], { coins: 0, owed: i % 2 ? 45 : 1234 }),
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      const owed = page.locator("#owed");
      await expect(owed).toHaveText(`Owed ${i % 2 ? "45" : "1,234"}`);
      await expect(page.locator("#season")).toContainText(season);
      const bar = (await page.locator("#season").boundingBox())!,
        debt = (await owed.boundingBox())!;
      // Inside the bar's 8px frame, and without making the bar scroll.
      expect(debt.x + debt.width).toBeLessThanOrEqual(bar.x + bar.width - 8);
      expect(debt.y + debt.height).toBeLessThanOrEqual(
        bar.y + bar.height - 8 + 0.5,
      );
      expect(
        await page
          .locator("#season")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      const menu = (await page.locator("#open-menu").boundingBox())!;
      expect(bar.x + bar.width).toBeLessThanOrEqual(menu.x);
      await shot(page, `ui-owed-${season}-320x568`);
    }
    expect(errors).toEqual([]);
  });
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 667, height: 375 },
]) {
  test.describe(`touch phone ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });
    test("the council meeting and council rules fit the phone", async ({
      page,
    }) => {
      test.setTimeout(90000);
      const size = `${viewport.width}x${viewport.height}`;
      const errors = await begin(page, `phone-${size}`, "crisis-1");
      await visitBuilding(page, "home", 60000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator("#next-season").tap();
      // The farmer walks home and the season changes before the council meets.
      const dialog = page.locator("#crisis");
      await expect(dialog).toBeVisible({ timeout: 60000 });
      await fits(page, "#crisis");
      await fits(page, "#crisis-heading");
      const close = dialog.getByRole("button", {
        name: "Close council meeting",
      });
      await fits(page, '#crisis [aria-label="Close council meeting"]');
      for (const button of await dialog.locator(".crisis-card").all())
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await shot(page, `ui-hand-${size}`);
      // One scrolling body: the heading and close control stay put at the bottom.
      const body = dialog.locator(".crisis-body");
      await body.evaluate((el) => (el.scrollTop = el.scrollHeight));
      await fits(page, '#crisis [aria-label="Close council meeting"]');
      await expect(close).toBeInViewport();
      await card(page, "Ada Kessler").tap();
      await expect(dialog).toContainText("Ada Kessler · Your rights");
      await fits(page, "#crisis-heading");
      await shot(page, `ui-reveal-${size}`);
      const back = dialog.getByRole("button", { name: "Back to the farm" });
      await back.scrollIntoViewIfNeeded();
      await expect(back).toBeInViewport();
      await shot(page, `ui-outcome-${size}`);
      await back.tap();
      await expect(dialog).toBeHidden();
      await visitBuilding(page, "home");
      await page.evaluate(() => window.scrollTo(0, 0));
      const council = page.locator("#council-rules");
      await council.scrollIntoViewIfNeeded();
      await page
        .getByRole("button", { name: "Buy water · 60 coins" })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByRole("button", { name: "Buy water · 60 coins" }),
      ).toBeInViewport();
      await fits(page, "#service-panel");
      await fits(page, "#close-service");
      for (const id of ["#buy-water", "#sell-water"])
        expect(
          (await page.locator(id).boundingBox())!.height,
        ).toBeGreaterThanOrEqual(44);
      await shot(page, `ui-council-${size}`);
      expect(errors).toEqual([]);
    });
  });
}

test.describe("touch phone 320x568, council leaning to control", () => {
  test.use({
    viewport: { width: 320, height: 568 },
    hasTouch: true,
    isMobile: true,
  });
  for (const { preset, heading, name } of [
    {
      preset: "crisis-2-control",
      heading: "Crisis 2 of 8: Blight",
      name: "blight-0",
    },
    {
      preset: "crisis-5-control",
      heading: "Crisis 5 of 8: Drought",
      name: "drought-0",
    },
    {
      preset: "crisis-8-control",
      heading: "Crisis 8 of 8: Overproduction",
      name: "overproduction-40",
    },
  ])
    test(`the ${name} outcome fits the phone`, async ({ page }) => {
      test.setTimeout(90000);
      const errors = await begin(page, `phone-${name}`, preset);
      await answerOnPhone(page, heading, name);
      expect(errors).toEqual([]);
    });
  test("a plot's crop choices under the county's crop fit the phone", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors = await begin(page, "phone-county-crop", "crisis-7-control");
    await answerOnPhone(
      page,
      "Crisis 7 of 8: Eminent domain",
      "eminent-domain-40",
    );
    // Spring of year 26 with every plot empty: the first plot offers the spring crops.
    await openPlot(page, 0);
    await expect(page.locator("#service-title")).toHaveText("Plant this plot");
    await page.evaluate(() => window.scrollTo(0, 0));
    await fits(page, "#service-panel");
    await fits(page, "#close-service");
    const body = page.locator(".service-body");
    expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    for (const crop of ["turnip", "carrot"]) {
      const button = page.locator(`[data-crop="${crop}"]`);
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator('[data-crop="carrot"] .crop-rule')).toHaveText(
      /^Only turnip may be planted\./,
    );
    await shot(page, "ui-seeds-county-crop-320x568");
    await page.locator('[data-crop="carrot"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator("#close-service")).toBeInViewport();
    await shot(page, "ui-seeds-county-crop-scrolled-320x568");
    expect(errors).toEqual([]);
  });
  test("the playtest presets' longer names stay inside the phone", async ({
    page,
  }) => {
    const errors = await begin(page, "phone-presets", "crisis-1");
    const presets = page.getByLabel("Starting point");
    await presets.selectOption("crisis-7-control");
    await presets.scrollIntoViewIfNeeded();
    const box = (await presets.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await shot(page, "ui-presets-320x568");
    expect(errors).toEqual([]);
  });
});
for (const viewport of [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test.describe(`touch phone ${viewport.width}x${viewport.height}, many council rules`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });
    test("the farmhouse's longest list of council rules scrolls inside the sheet", async ({
      page,
    }) => {
      test.setTimeout(90000);
      const size = `${viewport.width}x${viewport.height}`;
      const errors = await begin(
        page,
        `phone-rules-${size}`,
        "crisis-8-control",
      );
      await answerOnPhone(
        page,
        "Crisis 8 of 8: Overproduction",
        "overproduction-40",
      );
      await visitBuilding(page, "home");
      await page.evaluate(() => window.scrollTo(0, 0));
      const rules = page.locator("#council-standing li");
      await expect(rules).toHaveCount(6);
      await page.locator("#council-rules").scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, 0));
      await fits(page, "#service-panel");
      await fits(page, "#close-service");
      await shot(page, `ui-council-rules-${size}`);
      // One scrolling body: the last rule scrolls into view under a close control that stays.
      await rules.last().scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(rules.last()).toBeInViewport();
      await fits(page, "#close-service");
      const body = page.locator(".service-body");
      expect(
        await body.evaluate(
          (el) =>
            el.scrollHeight > el.clientHeight &&
            el.scrollWidth <= el.clientWidth,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      await shot(page, `ui-council-rules-end-${size}`);
      await page.locator("#close-service").tap();
      await expect(page.locator("#service-panel")).toBeHidden();
      expect(errors).toEqual([]);
    });
  });
}
