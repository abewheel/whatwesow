import content from "../../crisis-layer/content.json" with { type: "json" };
import { expect, type Page } from "./fixtures";
import { closeActions } from "./context-helpers";
import { buySeeds, visitBuilding } from "./helpers";
import { homesteadState, type GameState } from "../../src/game/state";
import { seasons, type CrisisRecord } from "../../src/macro/state";
import { crops, type CropId, type Plot } from "../../src/micro/state";

// Shared by the crisis specs: presets, saves, the council meeting and the farm's popups.
export { content };
export const personas = [
  ...content.personas.map((p) => p.id),
  ...content.cards.flatMap((c) => (c.personaLabel ? [c.personaLabel] : [])),
];
export const trigger = (id: string) =>
  content.crises.find((c) => c.id === id)!.trigger;
export const waiting = "The council is waiting for your answer.";

// Set CRISIS_SCREENSHOTS_DIR to keep pictures of the council meeting and council rules.
export async function shot(page: Page, name: string) {
  const dir = process.env.CRISIS_SCREENSHOTS_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}
/** Open the farm on a crisis preset; `edit` may change the preset's save before it applies. */
export async function begin(
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
export async function applyState(page: Page, state: GameState) {
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
export async function callCouncil(page: Page) {
  await visitBuilding(page, "home", 60000);
  await page.locator("#next-season").click();
  // The farmer walks home before the season ends and the council meets.
  const dialog = page.locator("#crisis");
  await expect(dialog).toBeVisible({ timeout: 60000 });
  return dialog;
}
export const card = (page: Page, speaker: string) =>
  page.locator("#crisis .crisis-card").filter({ hasText: speaker });
/** How often a sentence appears in an element's text. */
export const occurrences = async (page: Page, selector: string, text: string) =>
  ((await page.locator(selector).textContent()) ?? "").split(text).length - 1;

/** A homestead save at a turn: 9 plots sown with these crops, then empty. */
export const farmAt = (
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
export const records = (picks: string[], turns: number[]): CrisisRecord[] =>
  picks.map((pick, k) => ({
    id: content.params.runOrder[k],
    turn: turns[k],
    pick,
    ...(k === 1 ? { crop: "corn" } : k === 3 ? { crop: "pumpkin" } : {}),
  }));
// The council leaning to control: Nora Delgado's card, picked every time, passes 0 at
// crises 1–4 and −40 at crises 5–8. Each check reads a harm her answer passed on the
// farm, so each fails if the answer were ignored.
export const nora = "Nora Delgado";
export const cropIds = Object.keys(crops) as CropId[];
/** End the turn and answer the meeting with one speaker's argument, then go back to the farm. */
export async function answerWith(
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
/** Open a plot's popup of actions. */
export async function openPlot(page: Page, plot: number) {
  await closeActions(page);
  await page.locator(`[data-plot="${plot}"]`).press("Enter");
  await expect(page.locator("#service-panel")).toBeVisible();
}
/** Shop seed price plus the plot's separate planting fee, for seasonal crops. */
export async function seedPrices(page: Page, plot: number) {
  await openPlot(page, plot);
  const fees: Partial<Record<CropId, number>> = {};
  for (const button of await page.locator("#tile-actions [data-crop]").all()) {
    const crop = (await button.getAttribute("data-crop")) as CropId;
    const description =
      (await button.getAttribute("aria-label")) ??
      (await button.textContent()) ??
      "";
    fees[crop] = Number(
      /includes a (\d+)-coin fee/.exec(description)?.[1] ?? 0,
    );
  }
  await closeActions(page);
  await page.locator("#open-inventory").click();
  await page.locator("#open-seed-shop").click();
  await expect(page.locator("#service-panel")).toBeVisible();
  await expect(page.locator("#service-title")).toHaveText("Seed shop");
  const regular = page.locator('[data-seed-quality="regular"]');
  if (await regular.count()) await regular.click();
  const prices: Partial<Record<CropId, number>> = {};
  for (const crop of Object.keys(fees) as CropId[]) {
    const button = page.locator(`[data-buy-seed="${crop}"]`);
    prices[crop] =
      Number(await button.getAttribute("data-unit-price")) + fees[crop]!;
  }
  await openPlot(page, plot);
  return prices;
}
/** What an empty plot's popup says a harvest of the crop earns now. */
export async function earns(page: Page, crop: CropId, plot: number) {
  await openPlot(page, plot);
  const text = await page
    .locator(`[data-crop="${crop}"]`)
    .getAttribute("aria-label");
  return Number(/harvest (\d+) coins/.exec(text!)![1]);
}
/**
 * Plant a crop on a plot, or harvest or clear it, from the plot's popup; resolves once
 * the farmer has walked there and the plot shows the result.
 */
export async function work(
  page: Page,
  plot: number,
  action: CropId | "harvest",
  after: RegExp,
) {
  if (action !== "harvest") await buySeeds(page, action);
  await openPlot(page, plot);
  const actions = page.locator("#tile-actions");
  await (
    action === "harvest"
      ? actions.getByRole("button", {
          name: /^(Harvest crop|Clear withered crop)$/,
        })
      : actions.locator(`[data-crop="${action}"]`)
  ).click();
  await expect(page.locator(`[data-plot="${plot}"]`)).toHaveAttribute(
    "aria-label",
    after,
    { timeout: 60000 },
  );
}
/** The coins saved, read before the coin counter finishes counting up a sale. */
export async function purse(page: Page) {
  const status = await page.locator("#season .sr-only").textContent();
  return Number(/([\d,]+) coins/.exec(status!)![1].replaceAll(",", ""));
}
export const policyText = (crisis: string, pos: number) =>
  content.crises
    .find((c) => c.id === crisis)!
    .policies.find((p) => p.pos === pos)!;

/** Whole element inside the viewport. */
export async function fits(page: Page, selector: string) {
  const box = (await page.locator(selector).boundingBox())!;
  const view = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1);
}
// The council leaning to control on a phone: each outcome, an empty plot's crops under the
// county's crop, and the farmhouse's longest list of rules, which Nora Delgado's card
// picked every time reaches by year 30.
/** Tap End turn on a phone and answer with Nora Delgado's argument; the meeting stays open. */
export async function answerOnPhone(page: Page, heading: string, name: string) {
  await visitBuilding(page, "home", 60000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("#next-season").tap();
  // The farmer walks home before the season ends and the council meets.
  const dialog = page.locator("#crisis");
  await expect(dialog).toBeVisible({ timeout: 60000 });
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
