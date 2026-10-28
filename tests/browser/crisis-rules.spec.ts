// Council rules on the farm: water, permits, the county's crop, sales limits, droughts and delivery work.
import { test, expect } from "./fixtures";
import { visitBuilding, endTurn } from "./helpers";
import { openCell } from "./context-helpers";
import { homesteadState, type GameState } from "../../src/game/state";
import { plantQuote, workThreshold } from "../../src/micro/money";
import { crops, type Plot } from "../../src/micro/state";
import {
  shot,
  begin,
  applyState,
  farmAt,
  records,
  nora,
  answerWith,
  openPlot,
  earns,
  work,
  purse,
  policyText,
} from "./crisis-helpers";

test("the public water company seals the well, ends water trading and sends a water bill", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await begin(page, "water-company", "crisis-5-control");
  const well = page.locator('[data-structure="3"]'),
    canvas = page.locator("canvas");
  await expect(well).toHaveAttribute(
    "aria-label",
    "Irrigation well 3, level 1",
  );
  await answerWith(
    page,
    "Crisis 5 of 8: Drought",
    nora,
    "Passed: Public water company.",
    "drought-0",
  );
  await expect(well).toHaveAttribute(
    "aria-label",
    "Irrigation well 3, level 1, sealed by the council",
  );
  await expect(canvas).toHaveAttribute("data-scene-sealed", "1");
  // No new well either: the plan on open land says why.
  await openCell(page, "24,16");
  await expect(page.locator('[data-build="well"]')).toBeDisabled();
  await expect(page.locator('[data-build="well"]')).toHaveText(
    /^Irrigation well · .+ · Not allowed by the council$/,
  );
  // A thirsty crop is watered at cost; there is no water to buy or sell.
  await work(page, 0, "corn", /Corn, growing/);
  const watered =
    "Drought this season: your 1 thirsty crop is watered, 1 coin each at End turn.";
  await visitBuilding(page, "home");
  await expect(page.locator("#council-facts li").first()).toHaveText(watered);
  await expect(page.locator("#buy-water")).toHaveCount(0);
  await expect(page.locator("#sell-water")).toHaveCount(0);
  await expect(page.locator("#council-standing")).toContainText(
    policyText("Drought", 0).drag,
  );
  await page.locator("#council-rules").scrollIntoViewIfNeeded();
  await shot(page, "ui-council-water-company-1280x800");
  await endTurn(page);
  await expect(page.locator("#farm-message")).toContainText(
    "Water bill: −9 coins.",
  );
  await expect(page.locator("#farm-message")).toContainText(
    /Water at cost: −1 coins?\./,
  );
  // The drained valley's drought lasts two seasons, and so does the water at cost.
  await visitBuilding(page, "home");
  await expect(page.locator("#council-facts li").first()).toHaveText(watered);
  await expect(well).toHaveAttribute("aria-label", /sealed by the council$/);
  expect(errors).toEqual([]);
});

test("the county's set price brings the council office, its permits and the county's crop", async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await begin(page, "county-crop", "crisis-7-control");
  const canvas = page.locator("canvas"),
    office = page.locator('[data-service="council"]');
  await expect(office).toHaveCount(0);
  await answerWith(
    page,
    "Crisis 7 of 8: Eminent domain",
    nora,
    /^Passed: Take the land, pay a set price\. The county took 6 plots: \+\d+ coins\.$/,
    "eminent-domain-40",
  );
  await expect(page.locator("#farm-summary")).toContainText("3 plots");
  await expect(canvas).toHaveAttribute("data-scene-taken", "6");
  // Permits: the council office stands on the farm, with this season's permit granted.
  await expect(office).toHaveCount(1);
  await expect(canvas).toHaveAttribute(
    "data-scene-council",
    (await office.getAttribute("data-cell"))!,
  );
  await visitBuilding(page, "council");
  await expect(page.locator("#service-title")).toHaveText("Council office");
  await expect(page.locator("#permit-status")).toHaveText(
    "This season: permit granted. Next season: not filed yet.",
  );
  await page
    .getByRole("button", { name: "File next season's permit · free" })
    .click();
  await expect(page.locator("#permit-status")).toHaveText(
    "This season: permit granted. Next season: permit filed.",
  );
  await visitBuilding(page, "home");
  await expect(page.locator("#council-facts")).toContainText(
    "Crop you may plant this season: Turnip.",
  );
  // The county's crop has free seed, so only the planting fee; any other crop is fined.
  await openPlot(page, 0);
  const turnip = page.locator('[data-crop="turnip"]');
  await expect(turnip.locator("strong")).toHaveText("Turnip · 2 coins");
  await expect(turnip.locator(".crop-rule")).toHaveCount(0);
  for (const crop of ["radish", "carrot", "corn"] as const) {
    const quote = page.locator(`[data-crop="${crop}"]`);
    await expect(quote.locator("strong")).toHaveText(
      `${crops[crop].name} · 2 coins`,
    );
    await expect(quote.locator(".crop-rule")).toHaveText(
      `Only turnip may be planted. Planting anyway costs a ${3 * crops[crop].sale}-coin fine.`,
    );
  }
  await shot(page, "ui-seeds-county-crop-1280x800");
  await work(page, 0, "turnip", /Turnip, growing/);
  await expect(page.locator("#farm-message")).toHaveText(
    "Turnip planted. −2 coins, including a 2-coin planting fee.",
  );
  expect(errors).toEqual([]);
});

test("planting limits bring a steady sales allowance and prices that stay put", async ({
  page,
}) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await begin(page, "sales-limit", "crisis-8-control");
  await answerWith(
    page,
    "Crisis 8 of 8: Overproduction",
    nora,
    /^Passed: Limits on how much you can plant\./,
    "overproduction-40",
  );
  await visitBuilding(page, "home");
  const facts = page.locator("#council-facts");
  await expect(facts).toContainText("Sales allowed: 0 of 5 this season.");
  // Four pumpkins and two tomatoes are ripe: five sales pay, the sixth earns nothing.
  for (let plot = 0; plot < 5; plot++) {
    await work(page, plot, "harvest", /: empty$/);
    await expect(page.locator("#farm-message")).toContainText(" coins");
  }
  await expect(page.locator("#farm-message")).not.toContainText("sales limit");
  // The sixth crop's popup quotes the limit before it is harvested.
  await openPlot(page, 5);
  await expect(
    page.locator("#tile-actions p").filter({ hasText: /^Sells for / }),
  ).toHaveText("Sells for 0 coins over this season's sales limit.");
  const coins = await purse(page);
  await work(page, 5, "harvest", /: empty$/);
  await expect(page.locator("#farm-message")).toHaveText(
    "Tomato harvested. Over this season's sales limit: taken for nothing.",
  );
  expect(await purse(page)).toBe(coins);
  await visitBuilding(page, "home");
  await expect(facts).toContainText("Sales allowed: 5 of 5 this season.");
  await page.locator("#council-rules").scrollIntoViewIfNeeded();
  await shot(page, "ui-council-sales-limit-1280x800");
  // Prices hold at what they were when the limits passed: better soil does not raise them.
  // Winter plants nothing, so the turnip's price is read in spring and again in summer.
  await endTurn(page);
  await endTurn(page);
  const value = await earns(page, "turnip", 0);
  await page.locator("#improve").click();
  await expect(page.locator("#improve")).toHaveText(
    "Soil improvement underway · next season",
  );
  await endTurn(page);
  await expect(page.locator("#farm-summary")).toContainText("Soil level 1/3");
  expect(await earns(page, "turnip", 0)).toBe(value);
  expect(errors).toEqual([]);
});

test("the farmhouse states each kind of drought as End turn will play it", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?instance=validation-crisis-game-droughts");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const three: Plot[] = [
    { crop: "tomato", growth: 0 },
    { crop: "pumpkin", growth: 0 },
    { crop: "corn", growth: 1 },
  ];
  const five: Plot[] = Array.from({ length: 5 }, () => ({
    crop: "tomato",
    growth: 0,
  }));
  const wells = records(["D-LIB-P"], [6]),
    trade = records(["D-OBJ"], [6]);
  // The first answer drains the valley's water, so the second drought comes in spring.
  const later = (crisis5: string[]) =>
    records(["D-LIB-P", ...crisis5], [6, 22, 37, 55, 69]);
  const well = {
    structures: [
      ...homesteadState().structures,
      { id: 2, kind: "well" as const, row: 20, col: 20, level: 1 },
    ],
    nextStructureId: 3,
  };
  // A trade the drought does not offer is left out of the farmhouse entirely.
  for (const { name, state, fact, buy, sell } of [
    {
      name: "plain",
      state: farmAt(6, wells, three),
      fact: "Drought this season: 3 thirsty crops will dry to half yield.",
    },
    {
      name: "partly-bought",
      state: farmAt(6, trade, three, {
        water: { turn: 6, choice: "bought", plots: [1, 2] },
      }),
      fact: "Drought this season: the water you bought keeps 2 thirsty crops from drying; 1 other will dry to half yield unless you buy water.",
      buy: "Buy water · 12 coins",
      sell: false,
    },
    {
      name: "sold",
      state: farmAt(6, trade, three, { water: { turn: 6, choice: "sold" } }),
      fact: "Drought this season: you sold your water, so 3 thirsty crops will dry to half yield.",
      buy: false,
      sell: false,
    },
    {
      name: "well",
      state: farmAt(6, wells, three, well),
      fact: "Drought this season: your well waters your 3 thirsty crops.",
    },
    {
      name: "at-cost",
      state: farmAt(
        69,
        later(["B-LIB-P", "E-LIB-P:accept", "O-LIB-P:accept", "D-PRO-M"]),
        three,
      ),
      fact: "Drought this season: your 3 thirsty crops are watered, 1 coin each at End turn.",
    },
    {
      name: "water-board",
      state: farmAt(69, later(["B-SOC", "E-SOC", "O-SOC", "D-PRO-M"]), five),
      fact: "Drought this season: 3 of your 5 thirsty crops get water, but only enough to survive at half yield; the other 2 wither.",
    },
  ] as {
    name: string;
    state: GameState;
    fact: string;
    buy?: string | false;
    sell?: boolean;
  }[]) {
    await applyState(page, state);
    await visitBuilding(page, "home");
    await expect(page.locator("#council-facts li").first()).toHaveText(fact);
    const buyButton = page.locator("#buy-water"),
      sellButton = page.locator("#sell-water");
    if (buy === undefined) await expect(buyButton).toHaveCount(0);
    else if (buy) {
      await expect(buyButton).toHaveText(buy);
      await expect(buyButton).toBeEnabled();
    } else await expect(buyButton).toBeDisabled();
    if (sell === undefined) await expect(sellButton).toHaveCount(0);
    else await expect(sellButton).toBeEnabled({ enabled: sell });
    await page.locator("#council-rules").scrollIntoViewIfNeeded();
    await shot(page, `ui-drought-${name}-desktop`);
  }
  expect(errors).toEqual([]);
});

test("delivery work stays offered until a planting with the council's fee is affordable", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = await begin(page, "work", "crisis-1");
  // Spring, broke, nothing planted, and a planting fee from the council.
  const policy = { plantingFee: 2 };
  const broke = farmAt(5, [], [], { coins: 0, farmPolicy: policy });
  const need = workThreshold(broke, policy, 5);
  expect(need).toBeGreaterThan(4);
  await applyState(page, broke);
  // Delivery work is offered at the farmhouse.
  await visitBuilding(page, "home");
  const delivery = page.locator("#work");
  for (let coins = 4; coins - 4 < need; coins += 4) {
    await expect(delivery).toBeVisible();
    await delivery.click();
    await expect(page.locator("#coin-count")).toHaveText(String(coins));
  }
  await expect(delivery).toHaveCount(0);
  // Now the cheapest seed and its fee are affordable.
  const cheapest = (["turnip", "radish"] as const).find((crop) => {
    const quote = plantQuote(broke, crop, policy, 5);
    return quote.seed + quote.fee === need;
  })!;
  await work(page, 0, cheapest, /growing/);
  expect(errors).toEqual([]);
});

test("the council office takes permits while the council requires them", async ({
  page,
}) => {
  const errors = await begin(page, "permits", "crisis-1");
  const editor = page.getByLabel("Game state JSON");
  const state = JSON.parse(await editor.inputValue());
  state.farmPolicy = { permitsRequired: true, plantingFine: 0.5 };
  await editor.fill(JSON.stringify(state));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  // Plots 1–7 grow the preset's spring crops; plot 8 is empty.
  await openPlot(page, 7);
  await expect(page.locator('[data-crop="turnip"] .crop-rule')).toHaveText(
    "No planting permit this season. Planting anyway costs a 5-coin fine.",
  );
  await expect(page.locator('[data-crop="corn"]')).toContainText("Thirsty");
  await visitBuilding(page, "council");
  await expect(page.locator("#service-title")).toHaveText("Council office");
  await expect(page.locator("#permit-status")).toHaveText(
    "This season: no permit. Next season: not filed yet.",
  );
  await page
    .getByRole("button", { name: "File next season's permit · free" })
    .click();
  await expect(page.locator("#permit-status")).toHaveText(
    "This season: no permit. Next season: permit filed.",
  );
  await expect(page.locator("#file-permit")).toBeDisabled();
  expect(errors).toEqual([]);
});
