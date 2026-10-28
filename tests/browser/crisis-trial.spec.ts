import content from "../../crisis-layer/content.json" with { type: "json" };
import { test, expect } from "./fixtures";

const personas = [
  ...content.personas.map((p) => p.id),
  ...content.cards.flatMap((c) => (c.personaLabel ? [c.personaLabel] : [])),
];

test("crisis test plays a crisis, shows the outcome, and moves to the next one", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?instance=validation-crisis-trial");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const coins = await page.locator("#coin-count").textContent();
  await page.getByRole("button", { name: "Crisis test" }).click();
  const dialog = page.locator("#crisis-trial");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("h2")).toHaveText("Crisis 1 of 8: Drought");
  await expect(dialog).toContainText(content.crises[0].trigger);
  const cards = dialog.locator(".crisis-card");
  await expect(cards).toHaveCount(5);
  await expect(cards.locator(".crisis-portrait svg")).toHaveCount(5);
  for (const persona of personas)
    await expect(dialog).not.toContainText(persona);

  await cards.filter({ hasText: "Walt Finch" }).click();
  await expect(dialog).toContainText("Walt Finch · What works");
  await expect(dialog).toContainText("Tom Brennan · The group comes first");
  await expect(dialog).toContainText(
    "You asked for: Every farm can build its own well.",
  );
  for (const persona of personas)
    await expect(dialog).not.toContainText(persona);
  await dialog.getByRole("button", { name: "Next crisis" }).click();
  await expect(dialog.locator("h2")).toHaveText("Crisis 2 of 8: Crop disease");

  // The third crisis passes a deal; the player answers it before moving on.
  await cards.filter({ hasText: "Walt Finch" }).click();
  await dialog.getByRole("button", { name: "Next crisis" }).click();
  await cards.filter({ hasText: "Walt Finch" }).click();
  const next = dialog.getByRole("button", { name: "Next crisis" });
  await expect(next).toBeDisabled();
  await dialog.getByRole("button", { name: "Say no" }).click();
  await expect(dialog).toContainText(content.strings.offerDeclined);
  await expect(next).toBeEnabled();

  // Closing keeps the run; the farm itself is untouched.
  await dialog.getByRole("button", { name: "Close crisis test" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#coin-count")).toHaveText(coins!);
  await page.reload();
  await page.getByRole("button", { name: "Crisis test" }).click();
  await expect(dialog.locator("h2")).toHaveText(
    "Crisis 3 of 8: Land for a dam",
  );
  await dialog.getByRole("button", { name: "Undo pick" }).click();
  await expect(cards).toHaveCount(5);
  await dialog.getByRole("button", { name: "Start over" }).click();
  await expect(dialog.locator("h2")).toHaveText("Crisis 1 of 8: Drought");
  expect(errors).toEqual([]);
});

test("a restored run stops at the first deal it has not answered", async ({
  page,
}) => {
  // Saved picks can land on a deal after content.json changes; play must not skip it.
  await page.addInitScript(() =>
    localStorage.setItem(
      "whatwesow-crisis-trial",
      JSON.stringify({
        picks: ["D-LIB-P", "B-LIB-P", "E-LIB-P", "O-LIB-P"],
        view: "crisis",
      }),
    ),
  );
  await page.goto("/?instance=validation-crisis-restore");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.getByRole("button", { name: "Crisis test" }).click();
  const dialog = page.locator("#crisis-trial");
  await expect(dialog.locator("h2")).toHaveText(
    "Crisis 3 of 8: Land for a dam",
  );
  await expect(
    dialog.getByRole("button", { name: "Next crisis" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Take the deal" }).click();
  await expect(dialog).toContainText(content.strings.offerAccepted);
});
