// One check per crisis from its preset, and the blight's seed rules.
import { test, expect, type Page } from "./fixtures";
import { visitBuilding, endTurn } from "./helpers";
import { openCell } from "./context-helpers";
import { type GameState } from "../../src/game/state";
import { crops, type CropId } from "../../src/micro/state";
import {
  shot,
  begin,
  callCouncil,
  card,
  nora,
  cropIds,
  openPlot,
  seedPrices,
  earns,
  work,
  purse,
  policyText,
} from "./crisis-helpers";

// The last crisis needs earlier answers that leave the council room for control: with
// these, Tom Brennan's argument passes the crop ban.
const banPicks = [
  "D-LIB-P",
  "B-LIB-M",
  "E-SOC",
  "O-SOC",
  "D-SOC",
  "P-SOC",
  "E-SOC",
];
/** End turns until the season comes round, since a plot offers only that season's crops. */
async function untilSeason(page: Page, season: string) {
  const status = page.locator("#season .sr-only");
  for (
    let turns = 0;
    turns < 4 && !(await status.textContent())!.includes(` · ${season} · `);
    turns++
  )
    await endTurn(page);
}
/** The crops planted in a season, as an empty plot lists them. */
const sownIn = (season: string) =>
  cropIds.filter((crop) =>
    (crops[crop].plantingSeasons as readonly string[]).includes(season),
  );
// One check per remaining crisis: each fires from its preset, and each check fails
// if the answer were ignored, because it looks for what that answer passed.
for (const { preset, heading, speaker, deal, edit, check } of [
  {
    preset: "crisis-2",
    heading: "Crisis 2 of 8: Crop disease",
    speaker: "Ada Kessler",
    check: async (page: Page) => {
      // Ada's answer opens premium seed purchases at the shop.
      await page.locator("#open-inventory").click();
      await page.locator("#open-seed-shop").click();
      await expect(page.locator("#service-panel")).toBeVisible();
      await expect(page.locator("#service-title")).toHaveText("Seed shop");
      await page.locator('[data-seed-quality="premium"]').click();
      await expect(page.locator("[data-buy-premium]")).toHaveCount(6);
      await expect(page.locator("#tile-actions")).toContainText(
        "Premium: +30% yield; 1 in 8 may fail.",
      );
      // The summer blight took the spring corn, which by next spring is still recovering.
      await untilSeason(page, "spring");
      await openPlot(page, 7);
      await expect(page.locator('[data-crop="corn"]')).toContainText(
        "Corn is still recovering from blight.",
      );
      await expect(page.locator('[data-crop="corn"]')).toBeDisabled();
      await page.locator("#close-service").click();
      await page.locator("#open-inventory").click();
      await page.locator("#open-seed-shop").click();
      await expect(page.locator("#service-panel")).toBeVisible();
      await expect(page.locator("#service-title")).toHaveText("Seed shop");
      await page.locator('[data-seed-quality="premium"]').click();
      await expect(page.locator("[data-buy-premium]")).toHaveCount(6);
    },
  },
  {
    preset: "crisis-5",
    heading: "Crisis 5 of 8: Drought",
    speaker: "Walt Finch",
    check: async (page: Page) => {
      // Every farm pumps for itself: a well can be drilled without its milestone.
      await openCell(page, "20,20");
      await expect(page.locator('[data-build="well"]')).toBeVisible();
      await expect(page.locator('[data-build="well"]')).toBeEnabled();
    },
  },
  {
    preset: "crisis-6",
    heading: "Crisis 6 of 8: Prices drop",
    speaker: "Walt Finch",
    check: async (page: Page) => {
      await visitBuilding(page, "home");
      await expect(page.locator("#council-facts")).toContainText(
        "Sale prices: everything at 60%.",
      );
      await page
        .getByRole("button", { name: "Lock in 85% for 4 seasons" })
        .click();
      await expect(page.locator("#council-facts")).toContainText(
        "Price locked at 85% through year 23 spring.",
      );
      // A trade that no longer applies leaves the farmhouse.
      await expect(page.locator("#lock-price")).toHaveCount(0);
    },
  },
  {
    preset: "crisis-7",
    heading: "Crisis 7 of 8: Land for a dam",
    speaker: "Walt Finch",
    deal: true,
    check: async (page: Page) => {
      // The county bought four edge plots, now under its reservoir.
      await expect(page.locator("#farm-summary")).toContainText("5 plots");
      await expect(page.locator("canvas")).toHaveAttribute(
        "data-scene-taken",
        "4",
      );
    },
  },
  {
    preset: "crisis-8",
    heading: "Crisis 8 of 8: Too much of one crop",
    speaker: "Tom Brennan",
    edit: (state: GameState) => ({
      ...state,
      crises: state.crises!.map((r, k) => ({ ...r, pick: banPicks[k] })),
    }),
    check: async (page: Page) => {
      await expect(page.locator("#farm-message")).toContainText(
        "4 pumpkin plots plowed under.",
      );
      await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
        "aria-label",
        "Plot 1: empty",
      );
      // Pumpkin is sown in summer, when the ban still stands. By then the county also
      // assigns this year's summer crop, and the second eminent domain's answer
      // requires planting permits.
      await untilSeason(page, "summer");
      await openPlot(page, 0);
      await expect(page.locator('[data-crop="pumpkin"] .crop-rule')).toHaveText(
        /^Pumpkin is banned\. Only turnip may be planted\. No planting permit this season\. Planting anyway costs a \d+-coin fine\.$/,
      );
    },
  },
] as {
  preset: string;
  heading: string;
  speaker: string;
  deal?: boolean;
  edit?: (state: GameState) => GameState;
  check: (page: Page) => Promise<void>;
}[])
  test(`${heading} fires from its preset and its answer reaches the farm`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    const errors = await begin(page, preset, preset, edit);
    const dialog = await callCouncil(page);
    await expect(dialog.locator("h2")).toHaveText(heading);
    await card(page, speaker).click();
    await expect(dialog).toContainText(`${speaker} · `);
    if (deal)
      await dialog.getByRole("button", { name: "Take the deal" }).click();
    await dialog.getByRole("button", { name: "Back to the farm" }).click();
    await expect(dialog).toBeHidden();
    await check(page);
    expect(errors).toEqual([]);
  });

/**
 * End the turn and step out of the meeting: while the council waits, an empty plot
 * offers the new season's crops at their prices before any answer.
 */
async function pricesWhileWaiting(page: Page, plot: number) {
  const spring = await seedPrices(page, plot);
  await page.locator("#close-service").click();
  await page.locator("#open-inventory").click();
  await page.locator("#open-seed-shop").click();
  await expect(page.locator("#service-panel")).toBeVisible();
  await expect(page.locator("#service-title")).toHaveText("Seed shop");
  const regular = page.locator('[data-seed-quality="regular"]');
  if (await regular.count()) await regular.click();
  await expect(page.locator("[data-buy-seed]")).toHaveCount(6);
  const shop: Partial<Record<CropId, number>> = {};
  for (const button of await page.locator("[data-buy-seed]").all()) {
    const crop = (await button.getAttribute("data-buy-seed")) as CropId;
    shop[crop] = Number(await button.getAttribute("data-unit-price"));
  }
  const dialog = await callCouncil(page);
  await dialog.getByRole("button", { name: "Close council meeting" }).click();
  await expect(dialog).toBeHidden();
  await openPlot(page, plot);
  const prices: Partial<Record<CropId, number>> = {};
  for (const button of await page.locator("#tile-actions [data-crop]").all()) {
    const crop = (await button.getAttribute("data-crop")) as CropId;
    prices[crop] = shop[crop];
  }
  // Waiting changes no policy; retain the shop prices for the new season's crops.
  expect(prices.turnip).toBe(spring.turnip);
  return prices;
}
/** Back to the waiting council from the open popup, as answerWith answers it. */
async function answerWaiting(
  page: Page,
  heading: string,
  speaker: string,
  outcome: string,
  name?: string,
) {
  await page.locator("#council-return").click();
  const dialog = page.locator("#crisis");
  await expect(dialog.locator("h2")).toHaveText(heading);
  await card(page, speaker).click();
  await expect(dialog.locator(".crisis-outcome")).toHaveText(outcome);
  if (name) {
    await shot(page, `ui-reveal-${name}-1280x800`);
    await dialog.locator(".crisis-outcome").scrollIntoViewIfNeeded();
    await shot(page, `ui-outcome-${name}-1280x800`);
  }
  await dialog.getByRole("button", { name: "Back to the farm" }).click();
  await expect(dialog).toBeHidden();
}

test("Walt Finch's answer to the blight puts a quarter on the price of seed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await begin(page, "seed-label", "crisis-2");
  const before = await pricesWhileWaiting(page, 7);
  await answerWaiting(
    page,
    "Crisis 2 of 8: Crop disease",
    "Walt Finch",
    `Passed: ${policyText("Blight", 40).name}.`,
  );
  const after = await seedPrices(page, 7);
  // Every crop the plot offers this season, before and after the answer.
  expect(Object.keys(before)).toEqual(sownIn("summer"));
  expect(Object.keys(after)).toEqual(sownIn("summer"));
  for (const crop of Object.keys(before) as CropId[]) {
    expect(after[crop]).toBeGreaterThan(before[crop]!);
    expect(after[crop]).toBe(Math.ceil(before[crop]! * 1.25));
  }
  await visitBuilding(page, "home");
  await expect(page.locator("#council-standing")).toContainText(
    policyText("Blight", 40).drag,
  );
  expect(errors).toEqual([]);
});

test("the county seed check's fee, treated seed and crop rotation reach the plot and the harvest", async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await begin(page, "seed-check", "crisis-2-control");
  const before = await pricesWhileWaiting(page, 7),
    value = await earns(page, "turnip", 7);
  await answerWaiting(
    page,
    "Crisis 2 of 8: Crop disease",
    nora,
    "Passed: You pay the county to check seed.",
    "blight-0",
  );
  // Checked seed costs a quarter more plus a 2-coin fee, and yields 10% less.
  const after = await seedPrices(page, 7);
  expect(Object.keys(before)).toEqual(sownIn("summer"));
  expect(Object.keys(after)).toEqual(sownIn("summer"));
  for (const crop of Object.keys(before) as CropId[])
    expect(after[crop]).toBe(Math.ceil(before[crop]! * 1.25) + 2);
  await expect(page.locator('[data-crop="turnip"]')).toHaveAccessibleName(
    /includes a 2-coin fee/,
  );
  expect(await earns(page, "turnip", 7)).toBe(Math.floor(value * 0.9));
  // The blight cleared the corn: sow turnip in its first plot and harvest it in fall.
  await work(page, 0, "turnip", /Turnip, growing/);
  await expect(page.locator("#farm-message")).toContainText(
    "Turnip planted. −2 coins, including a 2-coin planting fee.",
  );
  await endTurn(page);
  await work(page, 0, "harvest", /^Plot 1: empty, turnip grew here last$/);
  await expect(page.locator("#farm-message")).toContainText(
    `Turnip harvested! +${Math.floor(value * 0.9)} coins.`,
  );
  // By spring, the plot warns that turnip cannot follow itself, and the farm fines it.
  await endTurn(page);
  await endTurn(page);
  await openPlot(page, 0);
  const fine = 3 * crops.turnip.sale;
  await expect(page.locator("#tile-actions")).toContainText(
    "Turnip grew here last; the council's rotation rule applies.",
  );
  await expect(page.locator('[data-crop="turnip"] .crop-rule')).toHaveText(
    `Turnip grew here last. Planting anyway costs a ${fine}-coin fine.`,
  );
  await shot(page, "ui-seeds-rotation-1280x800");
  const coins = await purse(page);
  await work(page, 0, "turnip", /Turnip, growing/);
  await expect(page.locator("#farm-message")).toContainText(
    `Planted against the rules (Turnip grew here last). Fine −${fine} coins.`,
  );
  expect(await purse(page)).toBe(coins - after.turnip! - fine);
  // Rotation is per plot: where corn grew, turnip is no rule broken.
  await openPlot(page, 1);
  await expect(page.locator('[data-crop="turnip"] .crop-rule')).toHaveCount(0);
  await work(page, 1, "turnip", /Turnip, growing/);
  await expect(page.locator("#farm-message")).toHaveText(
    "Turnip planted. −2 coins, including a 2-coin planting fee.",
  );
  expect(errors).toEqual([]);
});
