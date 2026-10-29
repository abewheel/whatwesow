// Meeting flow: End turn calls the council, waiting, focus, deals, reloads and the Crisis test.
import { test, expect } from "./fixtures";
import { visitBuilding, endTurn } from "./helpers";
import { closeActions, openCell } from "./context-helpers";
import {
  personas,
  trigger,
  waiting,
  shot,
  begin,
  callCouncil,
  card,
  occurrences,
  fits,
  content,
  openPlot,
  work,
} from "./crisis-helpers";

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
    "Passed: Farms can buy and sell water.",
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
  await work(page, 7, "tomato", /Tomato, growing/);
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

test("while the council waits, farm actions wait and every popup leads back to it", async ({
  page,
}) => {
  test.setTimeout(90000);
  // A turnip sown in plot 9 ripens as the council meets.
  const errors = await begin(page, "waiting", "crisis-1", (state) => ({
    ...state,
    seeds: { ...state.seeds, tomato: 1 },
    plots: state.plots.map((plot, i) =>
      i === 8 ? { crop: "turnip", growth: 0 } : plot,
    ),
  }));
  const dialog = await callCouncil(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // Popups stay open to read; their actions wait, and they lead back to the council.
  // An empty plot: every crop it offers waits, and so does moving it.
  await openPlot(page, 7);
  const notice = page.locator("#service-panel #council-waiting");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(waiting);
  const tomato = page.locator('#tile-actions [data-crop="tomato"]');
  await expect(tomato).toBeDisabled();
  await expect(tomato).toHaveAccessibleName(/harvest .*coins/);
  const deletePlot = page.locator("#delete-plot");
  await expect(deletePlot).toBeDisabled();
  await expect(page.locator("#move-plot")).toHaveCount(0);
  await shot(page, "ui-waiting-plot-desktop");
  // Open land: preparing a plot and every building plan wait.
  await openCell(page, "22,20");
  await expect(notice).toBeVisible();
  await expect(page.locator("#expand")).toBeDisabled();
  const plans = page.locator("#tile-actions [data-build]");
  expect(await plans.count()).toBeGreaterThan(0);
  for (const plan of await plans.all()) await expect(plan).toBeDisabled();
  // A building: moving it waits too.
  await closeActions(page);
  await page.locator('[data-structure="2"]').press("Enter");
  await expect(page.locator("#service-title")).toHaveText("Seed storehouse");
  await expect(notice).toBeVisible();
  await expect(page.locator("#teardown-building")).toBeDisabled();
  // A ripe crop waits too: the farmer does not set off to harvest it.
  await openPlot(page, 8);
  await expect(notice).toContainText(waiting);
  const harvest = page.getByRole("button", {
    name: "Harvest crop",
    exact: true,
  });
  await expect(harvest).toHaveCount(0);
  await expect(page.locator('[data-plot="8"]')).toHaveAttribute(
    "aria-label",
    "Plot 9: Turnip, ready to harvest",
  );
  await expect(page.locator('[data-plot="7"]')).toHaveAttribute(
    "aria-label",
    "Plot 8: empty",
  );
  await expect(
    page.getByRole("button", { name: "Council meeting" }),
  ).toBeVisible();
  await notice.getByRole("button", { name: "Answer the council" }).click();
  await expect(dialog.locator(".crisis-card")).toHaveCount(5);
  await card(page, "Ada Kessler").click();
  await dialog.getByRole("button", { name: "Back to the farm" }).click();
  await expect(dialog).toBeHidden();
  // Answered: the turnip can be harvested, and the empty plot planted and moved.
  await expect(notice).toBeHidden();
  await closeActions(page);
  await page.locator('[data-plot="8"]').press("Enter");
  await expect(page.locator('[data-plot="8"]')).toHaveAttribute(
    "aria-label",
    /empty/,
  );
  await openPlot(page, 7);
  await expect(tomato).toBeEnabled();
  await expect(deletePlot).toBeEnabled();
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
    "Crisis 3 of 8: Land for a dam",
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
    "Crisis 4 of 8: Too much of one crop",
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

test("inventory hotkeys do not dismiss or replace the council meeting", async ({
  page,
}) => {
  await begin(page, "inventory-hotkeys", "crisis-1");
  const dialog = await callCouncil(page);
  await page.keyboard.press("i");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("e");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#service-title")).not.toHaveText("Inventory");
});
