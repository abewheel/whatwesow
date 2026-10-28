import content from "../../crisis-layer/content.json" with { type: "json" };
import { test, expect, type Page } from "./fixtures";
import { visitBuilding, endTurn } from "./helpers";
import { homesteadState, type GameState } from "../../src/game/state";
import { seasons, type CrisisRecord } from "../../src/macro/state";
import { plantQuote, saleQuote, workThreshold } from "../../src/micro/money";
import { crops, type CropId, type Plot } from "../../src/micro/state";

const personas = [
  ...content.personas.map((p) => p.id),
  ...content.cards.flatMap((c) => (c.personaLabel ? [c.personaLabel] : [])),
];
const trigger = (id: string) =>
  content.crises.find((c) => c.id === id)!.trigger;
const waiting = "The council is waiting for your answer.";

// Set CRISIS_SCREENSHOTS_DIR to keep pictures of the council meeting and council rules.
async function shot(page: Page, name: string) {
  const dir = process.env.CRISIS_SCREENSHOTS_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}
/** Open the farm on a crisis preset; `edit` may change the preset's save before it applies. */
async function begin(
  page: Page,
  instance: string,
  preset: string,
  edit?: (state: GameState) => GameState,
) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?instance=validation-crisis-game-${instance}`);
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.getByLabel("Work on").selectOption("full");
  await page.getByLabel("Starting point").selectOption(preset);
  await page.getByRole("button", { name: "Load preset", exact: true }).click();
  if (edit) {
    const editor = page.getByLabel("Game state JSON");
    await editor.fill(
      JSON.stringify(edit(JSON.parse(await editor.inputValue()))),
    );
  }
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  return errors;
}
/** Replace the whole save through the playtest tools. */
async function applyState(page: Page, state: GameState) {
  await page.getByLabel("Work on").selectOption("full");
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  // The status keeps its text between applies: clear it so the wait sees this one.
  await page.locator("#dev-status").evaluate((el) => (el.textContent = ""));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
}
/** End the turn at the farmhouse and wait for the council to meet. */
async function callCouncil(page: Page) {
  await visitBuilding(page, "home", 60000);
  await page.locator("#next-season").click();
  const dialog = page.locator("#crisis");
  await expect(dialog).toBeVisible();
  return dialog;
}
const card = (page: Page, speaker: string) =>
  page.locator("#crisis .crisis-card").filter({ hasText: speaker });
/** How often a sentence appears in an element's text. */
const occurrences = async (page: Page, selector: string, text: string) =>
  ((await page.locator(selector).textContent()) ?? "").split(text).length - 1;

/** A homestead save at a turn: 9 plots sown with these crops, then empty. */
const farmAt = (
  turn: number,
  crises: CrisisRecord[],
  plots: Plot[],
  fields: Partial<GameState> = {},
): GameState => ({
  ...homesteadState(),
  year: Math.ceil(turn / 4),
  season: seasons[(turn - 1) % 4],
  ...(crises.length ? { crises } : {}),
  plots: Array.from({ length: 9 }, (_, i) => plots[i] ?? null),
  ...fields,
});
// Real answers in run order; the engine decides what each one passes.
const records = (picks: string[], turns: number[]): CrisisRecord[] =>
  picks.map((pick, k) => ({
    id: content.params.runOrder[k],
    turn: turns[k],
    pick,
    ...(k === 1 ? { crop: "corn" } : k === 3 ? { crop: "pumpkin" } : {}),
  }));

test("End turn calls the council, which waits for an answer that changes the farm", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = await begin(page, "drought", "crisis-1");
  const coins = await page.locator("#coin-count").textContent();
  const dialog = await callCouncil(page);
  await expect(dialog.locator("h2")).toHaveText("Crisis 1 of 8: Drought");
  await expect(dialog).toContainText(trigger("Drought"));
  await expect(dialog).toContainText("What do you say to the council?");
  await expect(dialog.locator(".crisis-card")).toHaveCount(5);
  await expect(dialog.locator(".crisis-card .crisis-portrait svg")).toHaveCount(
    5,
  );
  await expect(dialog.locator(".council-meter")).toBeVisible();
  for (const persona of personas)
    await expect(dialog).not.toContainText(persona);

  // Escape and × only hide the meeting; the turn cannot end until the council has an answer.
  // Escape leaves the farmhouse open behind it, and focus moves to the way back.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("#service-panel")).toBeVisible();
  const meeting = page.getByRole("button", { name: "Council meeting" });
  await expect(meeting).toBeVisible();
  await expect(meeting).toBeFocused();
  const endButton = page.locator("#next-season");
  await expect(endButton).toBeDisabled();
  await expect(endButton).toHaveAttribute("aria-describedby", "council-wait");
  await expect(page.locator("#council-wait")).toHaveText(waiting);
  await page.getByRole("button", { name: "Answer the council" }).click();
  await expect(dialog.locator("h2")).toHaveText("Crisis 1 of 8: Drought");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await meeting.click();
  await expect(dialog.locator("h2")).toHaveText("Crisis 1 of 8: Drought");
  await dialog.getByRole("button", { name: "Close council meeting" }).click();
  await expect(dialog).toBeHidden();

  // A saved crisis reopens once the farm is visible again.
  await page.reload();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("h2")).toHaveText("Crisis 1 of 8: Drought");
  await expect(page.locator("#coin-count")).toHaveText(coins!);

  await card(page, "Ada Kessler").click();
  await expect(dialog).toContainText("Ada Kessler · Your rights");
  await expect(dialog).toContainText("What happens to you");
  await expect(dialog).toContainText("Rules you still have to follow");
  await expect(dialog.locator(".crisis-outcome")).toHaveText(
    "Passed: Water rights you can buy and sell.",
  );
  for (const persona of personas)
    await expect(dialog).not.toContainText(persona);
  await dialog.getByRole("button", { name: "Back to the farm" }).click();
  await expect(dialog).toBeHidden();
  await expect(meeting).toBeHidden();
  // Neither the meeting button nor End turn is on screen: focus returns to the farm.
  await expect(page.locator("#farm")).toBeFocused();

  // Water rights on a drought turn: five growing corn plots are thirsty.
  await visitBuilding(page, "home");
  await expect(endButton).toBeEnabled();
  await expect(endButton).not.toHaveAttribute("aria-describedby");
  await expect(page.locator("#council-wait")).toBeHidden();
  await expect(page.locator("#council-return")).toBeHidden();
  const council = page.locator("#council-rules");
  await expect(council.locator("#council-facts li").first()).toHaveText(
    "Drought this season: 5 thirsty crops will dry to half yield unless you buy water.",
  );
  await expect(
    council.getByRole("button", { name: "Buy water · 60 coins" }),
  ).toBeEnabled();
  await expect(
    council.getByRole("button", { name: "Sell water rights · +30" }),
  ).toBeEnabled();
  // Left unwatered, the corn dries to half yield at the season's end.
  await endTurn(page);
  await expect(page.locator("#farm-message")).toContainText(
    "Drought: 5 thirsty crops dried to half yield.",
  );
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    "Plot 1: Corn, ready to harvest, dry",
  );
  await expect(page.locator("#crisis")).toBeHidden();
  expect(errors).toEqual([]);
});

test("closing the meeting after an answer puts focus on End turn", async ({
  page,
}) => {
  const errors = await begin(page, "focus", "crisis-1");
  const dialog = await callCouncil(page);
  await card(page, "Walt Finch").click();
  await dialog.getByRole("button", { name: "Back to the farm" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#service-panel")).toBeVisible();
  await expect(page.locator("#next-season")).toBeFocused();
  expect(errors).toEqual([]);
});

test("bought water keeps the corn from drying, and crops planted later need their own", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = await begin(page, "water", "crisis-1");
  const dialog = await callCouncil(page);
  await card(page, "Ada Kessler").click();
  await dialog.getByRole("button", { name: "Back to the farm" }).click();
  await visitBuilding(page, "home");
  await page.getByRole("button", { name: "Buy water · 60 coins" }).click();
  await expect(page.locator("#farm-message")).toHaveText(
    "Water bought for 5 thirsty crops. −60 coins.",
  );
  await expect(page.locator("#buy-water")).toHaveText(
    "Water bought this season",
  );
  await expect(page.locator("#buy-water")).toBeDisabled();
  await expect(page.locator("#sell-water")).toBeDisabled();
  await expect(page.locator("#council-facts li").first()).toHaveText(
    "Drought this season: the water you bought keeps 5 thirsty crops from drying.",
  );
  // A tomato planted after the purchase is not covered by it.
  await visitBuilding(page, "seeds");
  await page.locator('[data-crop="tomato"]').click();
  await page.locator('[data-plot="7"]').click();
  await expect(page.locator('[data-plot="7"]')).toHaveAttribute(
    "aria-label",
    /Tomato, growing/,
  );
  await visitBuilding(page, "home");
  await expect(page.locator("#council-facts li").first()).toHaveText(
    "Drought this season: the water you bought keeps 5 thirsty crops from drying; 1 other will dry to half yield unless you buy water.",
  );
  await expect(
    page.getByRole("button", { name: "Buy water · 12 coins" }),
  ).toBeEnabled();
  await expect(page.locator("#sell-water")).toBeDisabled();
  await endTurn(page);
  await expect(page.locator("#farm-message")).toContainText(
    "Drought: 1 thirsty crop dried to half yield.",
  );
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    "Plot 1: Corn, ready to harvest",
  );
  await expect(page.locator('[data-plot="7"]')).toHaveAttribute(
    "aria-label",
    "Plot 8: Tomato, ready to harvest, dry",
  );
  expect(errors).toEqual([]);
});

test("while the council waits, farm actions wait and every menu leads back to it", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = await begin(page, "waiting", "crisis-1");
  const dialog = await callCouncil(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // Menus stay open to read; their actions wait, and they lead back to the council.
  await visitBuilding(page, "seeds");
  const notice = page.locator("#service-panel #council-waiting");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(waiting);
  await expect(page.locator('[data-crop="tomato"]')).toBeDisabled();
  await expect(page.locator('[data-crop="tomato"]')).toContainText("coins");
  await shot(page, "ui-waiting-seeds-desktop");
  await visitBuilding(page, "builder");
  await expect(notice).toBeVisible();
  for (const plan of await page.locator("#build-options button").all())
    if (await plan.isVisible()) await expect(plan).toBeDisabled();
  await visitBuilding(page, "fields");
  await expect(notice).toBeVisible();
  await expect(page.locator("#expand")).toBeDisabled();
  await expect(page.locator("#move-plot")).toBeDisabled();
  await page.locator("#close-service").click();
  // Planting on the farm is refused before the farmer walks, with the reason.
  await page.locator('[data-plot="7"]').click();
  // Read at once: without the guard the farmer would set off first.
  expect(await page.locator("#farm-message").textContent()).toBe(waiting);
  await expect(page.locator('[data-plot="7"]')).toHaveAttribute(
    "aria-label",
    "Plot 8: empty",
  );
  await expect(
    page.getByRole("button", { name: "Council meeting" }),
  ).toBeVisible();
  await visitBuilding(page, "seeds");
  await notice.getByRole("button", { name: "Answer the council" }).click();
  await expect(dialog.locator(".crisis-card")).toHaveCount(5);
  await card(page, "Ada Kessler").click();
  await dialog.getByRole("button", { name: "Back to the farm" }).click();
  await expect(dialog).toBeHidden();
  // Answered: the seed basket works again.
  await expect(notice).toBeHidden();
  await expect(page.locator('[data-crop="tomato"]')).toBeEnabled();
  expect(errors).toEqual([]);
});

test("a deal waits through a reload, and taking it sells land to the county", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = await begin(page, "deal", "crisis-3");
  await expect(page.locator("#farm-summary")).toContainText("9 plots");
  const dialog = await callCouncil(page);
  await expect(dialog.locator("h2")).toHaveText(
    "Crisis 3 of 8: Eminent domain",
  );
  await card(page, "Walt Finch").click();
  const back = dialog.getByRole("button", { name: "Back to the farm" });
  await expect(back).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Take the deal" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Council meeting" }),
  ).toBeVisible();
  await page.reload();
  await expect(dialog).toBeVisible();
  await expect(back).toBeDisabled();
  await dialog.getByRole("button", { name: "Take the deal" }).click();
  await expect(dialog.locator(".crisis-outcome")).toHaveText(
    /^You took the deal\. The county bought 4 plots: \+\d+ coins\.$/,
  );
  // The deal's result is said once, in the outcome.
  expect(
    await occurrences(page, "#crisis", content.strings.offerAccepted),
  ).toBe(1);
  await expect(back).toBeEnabled();
  await shot(page, "ui-deal-desktop");
  await back.click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#farm-summary")).toContainText("5 plots");
  await expect(page.locator("canvas")).toHaveAttribute("data-scene-taken", "4");
  await visitBuilding(page, "home");
  await expect(page.locator("#next-season")).toBeEnabled();
  expect(errors).toEqual([]);
});

test("saying no to a deal leaves the farm as it was", async ({ page }) => {
  const errors = await begin(page, "decline", "crisis-4");
  const dialog = await callCouncil(page);
  await expect(dialog.locator("h2")).toHaveText(
    "Crisis 4 of 8: Overproduction",
  );
  await card(page, "Walt Finch").click();
  await dialog.getByRole("button", { name: "Say no" }).click();
  await expect(dialog).toContainText(content.strings.offerDeclined);
  expect(
    await occurrences(page, "#crisis", content.strings.offerDeclined),
  ).toBe(1);
  await dialog.getByRole("button", { name: "Back to the farm" }).click();
  await visitBuilding(page, "home");
  await expect(page.locator("#next-season")).toBeEnabled();
  // The glut still lowers the price of the top crop for two seasons.
  await expect(page.locator("#council-facts")).toContainText(
    "Sale prices: Pumpkin 75%.",
  );
  expect(errors).toEqual([]);
});

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
// One check per remaining crisis: each fires from its preset, and each check fails
// if the answer were ignored, because it looks for what that answer passed.
for (const { preset, heading, speaker, deal, edit, check } of [
  {
    preset: "crisis-2",
    heading: "Crisis 2 of 8: Blight",
    speaker: "Ada Kessler",
    check: async (page: Page) => {
      await visitBuilding(page, "seeds");
      // The summer blight took the spring corn; Ada's answer opens premium seed.
      await expect(page.locator('[data-crop="corn"]')).toContainText(
        "Corn is still recovering from blight.",
      );
      await expect(page.locator("#premium-seed")).toBeVisible();
      await expect(page.locator("#premium-terms")).toHaveText(
        "Seed costs 50% more · yields 30% more · 1 planting in 8 fails",
      );
    },
  },
  {
    preset: "crisis-5",
    heading: "Crisis 5 of 8: Drought",
    speaker: "Walt Finch",
    check: async (page: Page) => {
      // Every farm pumps for itself: a well can be drilled without its milestone.
      await visitBuilding(page, "builder");
      await expect(page.locator('[data-build="well"]')).toBeVisible();
      await expect(page.locator('[data-build="well"]')).toBeEnabled();
    },
  },
  {
    preset: "crisis-6",
    heading: "Crisis 6 of 8: Price crash",
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
      await expect(page.locator("#lock-price")).toBeHidden();
    },
  },
  {
    preset: "crisis-7",
    heading: "Crisis 7 of 8: Eminent domain",
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
    heading: "Crisis 8 of 8: Overproduction",
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
      await visitBuilding(page, "seeds");
      // The second eminent domain's answer also requires planting permits.
      await expect(page.locator('[data-crop="pumpkin"] .crop-rule')).toHaveText(
        /^Pumpkin is banned\. No planting permit this season\. Planting anyway costs a \d+-coin fine\.$/,
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
    test.setTimeout(90000);
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

// The council leaning to control: Nora Delgado's card, picked every time, passes 0 at
// crises 2–5 and −40 at crises 6–8. Each check reads a harm her answer passed on the
// farm, so each fails if the answer were ignored.
const nora = "Nora Delgado";
const cropIds = Object.keys(crops) as CropId[];
/** End the turn and answer the meeting with one speaker's argument, then go back to the farm. */
async function answerWith(
  page: Page,
  heading: string,
  speaker: string,
  outcome: string | RegExp,
  name?: string,
) {
  const dialog = await callCouncil(page);
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
/** The seed basket's price for each crop: seed plus any fee. */
async function seedPrices(page: Page) {
  await visitBuilding(page, "seeds");
  const prices = {} as Record<CropId, number>;
  for (const crop of cropIds)
    prices[crop] = Number(
      await page.locator(`[data-crop="${crop}"] .seed-price`).textContent(),
    );
  return prices;
}
/** What the seed basket says a harvest of the crop earns now. */
async function earns(page: Page, crop: CropId) {
  await visitBuilding(page, "seeds");
  const label = await page
    .locator(`[data-crop="${crop}"]`)
    .getAttribute("aria-label");
  return Number(/harvest (\d+) coins/.exec(label!)![1]);
}
/** Walk to a plot and plant or harvest it; resolves once the plot shows the result. */
async function work(page: Page, plot: number, after: RegExp) {
  await page.locator(`[data-plot="${plot}"]`).click();
  await expect(page.locator(`[data-plot="${plot}"]`)).toHaveAttribute(
    "aria-label",
    after,
  );
}
/** The coins saved, read before the coin counter finishes counting up a sale. */
async function purse(page: Page) {
  const status = await page.locator("#season .sr-only").textContent();
  return Number(/([\d,]+) coins/.exec(status!)![1].replaceAll(",", ""));
}
const policyText = (crisis: string, pos: number) =>
  content.crises
    .find((c) => c.id === crisis)!
    .policies.find((p) => p.pos === pos)!;

test("Walt Finch's answer to the blight puts a quarter on the price of seed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await begin(page, "seed-label", "crisis-2");
  const before = await seedPrices(page);
  await answerWith(
    page,
    "Crisis 2 of 8: Blight",
    "Walt Finch",
    `Passed: ${policyText("Blight", 40).name}.`,
  );
  const after = await seedPrices(page);
  for (const crop of cropIds) {
    expect(after[crop]).toBeGreaterThan(before[crop]);
    expect(after[crop]).toBe(Math.ceil(before[crop] * 1.25));
  }
  await visitBuilding(page, "home");
  await expect(page.locator("#council-standing")).toContainText(
    policyText("Blight", 40).drag,
  );
  expect(errors).toEqual([]);
});

test("the county seed check's fee, treated seed and crop rotation reach the seed basket and the harvest", async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await begin(page, "seed-check", "crisis-2-control");
  const before = await seedPrices(page),
    value = await earns(page, "turnip");
  await answerWith(
    page,
    "Crisis 2 of 8: Blight",
    nora,
    "Passed: County seed checks, for a fee.",
    "blight-0",
  );
  // Checked seed costs a quarter more plus a 2-coin fee, and yields 10% less.
  const after = await seedPrices(page);
  for (const crop of cropIds)
    expect(after[crop]).toBe(Math.ceil(before[crop] * 1.25) + 2);
  await expect(page.locator('[data-crop="turnip"]')).toHaveAttribute(
    "aria-label",
    /including a 2-coin fee/,
  );
  expect(await earns(page, "turnip")).toBe(Math.floor(value * 0.9));
  // The blight cleared the corn: sow turnip in its first plot and harvest it in fall.
  await page.locator('[data-crop="turnip"]').click();
  await work(page, 0, /Turnip, growing/);
  await expect(page.locator("#farm-message")).toContainText(
    `Turnip planted. −${after.turnip} coins, including a 2-coin planting fee.`,
  );
  await endTurn(page);
  await page.locator("#close-service").click();
  await work(page, 0, /^Plot 1: empty, turnip grew here last$/);
  await expect(page.locator("#farm-message")).toContainText(
    `Turnip harvested! +${Math.floor(value * 0.9)} coins.`,
  );
  // By spring, the basket warns that turnip cannot follow itself, and the farm fines it.
  await endTurn(page);
  await endTurn(page);
  await visitBuilding(page, "seeds");
  const fine = 3 * crops.turnip.sale;
  await expect(page.locator('[data-crop="turnip"] .crop-rule')).toHaveText(
    `Turnip grew last in 1 empty plot. Planting it there costs a ${fine}-coin fine.`,
  );
  await shot(page, "ui-seeds-rotation-1280x800");
  await page.locator('[data-crop="turnip"]').click();
  const coins = await purse(page);
  await work(page, 0, /Turnip, growing/);
  await expect(page.locator("#farm-message")).toContainText(
    `Planted against the rules (Turnip grew here last). Fine −${fine} coins.`,
  );
  expect(await purse(page)).toBe(coins - after.turnip - fine);
  // Rotation is per plot: where corn grew, turnip is no rule broken.
  await work(page, 1, /Turnip, growing/);
  await expect(page.locator("#farm-message")).toHaveText(
    `Turnip planted. −${after.turnip} coins, including a 2-coin planting fee.`,
  );
  expect(errors).toEqual([]);
});

test("the public water company seals the well, ends water trading and sends a water bill", async ({
  page,
}) => {
  test.setTimeout(150000);
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
  // No new well either: the plan says why.
  await visitBuilding(page, "builder");
  await expect(page.locator('[data-build="well"]')).toBeDisabled();
  await expect(page.locator('[data-build="well"] .plan-rule')).toHaveText(
    "Not allowed by the council",
  );
  // A thirsty crop is watered at cost; there is no water to buy or sell.
  await visitBuilding(page, "seeds");
  await page.locator('[data-crop="corn"]').click();
  await work(page, 0, /Corn, growing/);
  const watered =
    "Drought this season: your 1 thirsty crop is watered, 1 coin each at End turn.";
  await visitBuilding(page, "home");
  await expect(page.locator("#council-facts li").first()).toHaveText(watered);
  await expect(page.locator("#buy-water")).toBeHidden();
  await expect(page.locator("#sell-water")).toBeHidden();
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
  test.setTimeout(120000);
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
  await visitBuilding(page, "seeds");
  const turnip = page.locator('[data-crop="turnip"]');
  await expect(turnip.locator(".seed-price")).toHaveText("2");
  await expect(turnip.locator(".crop-rule")).toHaveCount(0);
  for (const crop of ["radish", "carrot", "corn"] as const) {
    const quote = page.locator(`[data-crop="${crop}"]`);
    await expect(quote.locator(".seed-price")).toHaveText("2");
    await expect(quote.locator(".crop-rule")).toHaveText(
      `Only turnip may be planted. Planting anyway costs a ${3 * crops[crop].sale}-coin fine.`,
    );
  }
  await shot(page, "ui-seeds-county-crop-1280x800");
  await turnip.click();
  await work(page, 0, /Turnip, growing/);
  await expect(page.locator("#farm-message")).toHaveText(
    "Turnip planted. −2 coins, including a 2-coin planting fee.",
  );
  expect(errors).toEqual([]);
});

test("planting limits bring a steady sales allowance and prices that stay put", async ({
  page,
}) => {
  test.setTimeout(150000);
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
  await page.locator("#close-service").click();
  for (let plot = 0; plot < 5; plot++) {
    await work(page, plot, /: empty$/);
    await expect(page.locator("#farm-message")).toContainText(" coins");
  }
  await expect(page.locator("#farm-message")).not.toContainText("sales limit");
  const coins = await purse(page);
  await work(page, 5, /: empty$/);
  await expect(page.locator("#farm-message")).toHaveText(
    "Tomato harvested. Over this season's sales limit: taken for nothing.",
  );
  expect(await purse(page)).toBe(coins);
  await visitBuilding(page, "home");
  await expect(facts).toContainText("Sales allowed: 5 of 5 this season.");
  await page.locator("#council-rules").scrollIntoViewIfNeeded();
  await shot(page, "ui-council-sales-limit-1280x800");
  await visitBuilding(page, "seeds");
  await expect(page.locator('[data-crop="turnip"]')).toHaveAttribute(
    "aria-label",
    /harvest 0 coins over this season's sales limit\./,
  );
  // Prices hold at what they were when the limits passed: better soil does not raise them.
  await endTurn(page);
  const value = await earns(page, "turnip");
  await visitBuilding(page, "fields");
  await page.locator("#improve").click();
  await expect(page.locator("#soil-status")).toHaveText("Ready next season");
  await endTurn(page);
  await expect(page.locator("#farm-summary")).toContainText("Soil level 1/3");
  expect(await earns(page, "turnip")).toBe(value);
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
    if (buy === undefined) await expect(buyButton).toBeHidden();
    else if (buy) {
      await expect(buyButton).toHaveText(buy);
      await expect(buyButton).toBeEnabled();
    } else await expect(buyButton).toBeDisabled();
    if (sell === undefined) await expect(sellButton).toBeHidden();
    else await expect(sellButton).toBeEnabled({ enabled: sell });
    await page.locator("#council-rules").scrollIntoViewIfNeeded();
    await shot(page, `ui-drought-${name}-desktop`);
  }
  expect(errors).toEqual([]);
});

test.describe("touch phone 320x568", () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true });
  test("the seed basket states fees, fines and bans in plain words", async ({
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
    await visitBuilding(page, "seeds");
    for (const crop of ["turnip", "tomato", "pumpkin"] as const) {
      const quote = plantQuote(state, crop, policy, 6),
        sale = saleQuote(state, crop, policy, 6);
      const button = page.locator(`[data-crop="${crop}"]`);
      await expect(button.locator(".seed-price")).toHaveText(
        String(quote.seed + quote.fee),
      );
      await expect(button.locator(".control-detail")).toContainText(
        `${sale.value} coins after ${sale.tax} to the relief fund${crop === "turnip" ? ", paid next season" : ""}`,
      );
      await expect(button.locator(".crop-rule")).toHaveText(
        `${crop === "pumpkin" ? "Pumpkin is banned. " : ""}No planting permit this season. Planting anyway costs a ${quote.fine}-coin fine.`,
      );
      await expect(button).toHaveAttribute(
        "aria-label",
        new RegExp(`including a 2-coin fee`),
      );
    }
    // Nothing in the basket runs past the phone's edge.
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

test("delivery work stays offered until a planting with the council's fee is affordable", async ({
  page,
}) => {
  const errors = await begin(page, "work", "crisis-1");
  // Spring, broke, nothing planted, and a planting fee from the council.
  const policy = { plantingFee: 2 };
  const broke = farmAt(5, [], [], { coins: 0, farmPolicy: policy });
  const need = workThreshold(broke, policy, 5);
  expect(need).toBeGreaterThan(4);
  await applyState(page, broke);
  await visitBuilding(page, "seeds");
  const work = page.locator("#work");
  for (let coins = 4; coins - 4 < need; coins += 4) {
    await expect(work).toBeVisible();
    await work.click();
    await expect(page.locator("#coin-count")).toHaveText(String(coins));
  }
  await expect(work).toBeHidden();
  // Now the cheapest seed and its fee are affordable.
  const cheapest = (["turnip", "radish"] as const).find((crop) => {
    const quote = plantQuote(broke, crop, policy, 5);
    return quote.seed + quote.fee === need;
  })!;
  await page.locator(`[data-crop="${cheapest}"]`).click();
  await page.locator('[data-plot="0"]').click();
  await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
    "aria-label",
    /growing/,
  );
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
  await visitBuilding(page, "seeds");
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

test("the development Crisis test leaves the farm's council alone", async ({
  page,
}) => {
  const errors = await begin(page, "trial", "crisis-1");
  const dialog = await callCouncil(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // The farmhouse stays open behind the meeting; the playtest button sits behind it.
  await page.locator("#close-service").click();
  const coins = await page.locator("#coin-count").textContent();
  await page.getByRole("button", { name: "Crisis test" }).click();
  const trial = page.locator("#crisis-trial");
  await expect(trial).toContainText("the farm is not changed");
  await trial
    .locator(".crisis-card")
    .filter({ hasText: "Tom Brennan" })
    .click();
  await expect(trial).toContainText("Tom Brennan · ");
  await trial.getByRole("button", { name: "Close crisis test" }).click();
  await expect(page.locator("#coin-count")).toHaveText(coins!);
  // The farm's own crisis still waits, unanswered, with its hand of five.
  await page.getByRole("button", { name: "Council meeting" }).click();
  await expect(dialog.locator("h2")).toHaveText("Crisis 1 of 8: Drought");
  await expect(dialog.locator(".crisis-card")).toHaveCount(5);
  expect(errors).toEqual([]);
});

/** Whole element inside the viewport. */
async function fits(page: Page, selector: string) {
  const box = (await page.locator(selector).boundingBox())!;
  const view = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1);
}
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
      const dialog = page.locator("#crisis");
      await expect(dialog).toBeVisible();
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

test("the council meeting and its outcome fit a desktop screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await begin(page, "desktop", "crisis-1");
  const dialog = await callCouncil(page);
  await fits(page, "#crisis");
  await expect(dialog.locator(".crisis-card")).toHaveCount(5);
  for (const button of await dialog.locator(".crisis-card").all())
    await expect(button).toBeInViewport();
  await shot(page, "ui-hand-1280x800");
  await card(page, "Walt Finch").click();
  await expect(dialog).toContainText("Walt Finch · What works");
  await fits(page, "#crisis");
  await shot(page, "ui-reveal-1280x800");
  const back = dialog.getByRole("button", { name: "Back to the farm" });
  await back.scrollIntoViewIfNeeded();
  await expect(back).toBeInViewport();
  await expect(dialog.locator(".crisis-outcome")).toBeInViewport();
  await shot(page, "ui-outcome-1280x800");
  await back.click();
  await visitBuilding(page, "home");
  await page.locator("#council-rules").scrollIntoViewIfNeeded();
  await expect(page.locator("#council-rules")).toBeInViewport();
  await shot(page, "ui-council-1280x800");
  expect(errors).toEqual([]);
});

// The council leaning to control on a phone: each outcome, the seed basket under the
// county's crop, and the farmhouse's longest list of rules, which Nora Delgado's card
// picked every time reaches by year 30.
/** Tap End turn on a phone and answer with Nora Delgado's argument; the meeting stays open. */
async function answerOnPhone(page: Page, heading: string, name: string) {
  await visitBuilding(page, "home", 60000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("#next-season").tap();
  const dialog = page.locator("#crisis");
  await expect(dialog.locator("h2")).toHaveText(heading);
  await card(page, nora).tap();
  await expect(dialog.locator(".crisis-outcome")).toBeAttached();
  await fits(page, "#crisis");
  await fits(page, "#crisis-heading");
  await fits(page, '#crisis [aria-label="Close council meeting"]');
  const size = `${page.viewportSize()!.width}x${page.viewportSize()!.height}`;
  await shot(page, `ui-reveal-${name}-${size}`);
  // The outcome scrolls into view under a heading and close control that stay put.
  const outcome = dialog.locator(".crisis-outcome");
  await outcome.scrollIntoViewIfNeeded();
  await expect(outcome).toBeInViewport();
  await fits(page, '#crisis [aria-label="Close council meeting"]');
  await shot(page, `ui-outcome-${name}-${size}`);
  const back = dialog.getByRole("button", { name: "Back to the farm" });
  await back.scrollIntoViewIfNeeded();
  await expect(back).toBeInViewport();
  await back.tap();
  await expect(dialog).toBeHidden();
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
  test("the seed basket under the county's crop fits the phone", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors = await begin(page, "phone-county-crop", "crisis-7-control");
    await answerOnPhone(
      page,
      "Crisis 7 of 8: Eminent domain",
      "eminent-domain-40",
    );
    await visitBuilding(page, "seeds");
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
