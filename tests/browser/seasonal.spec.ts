import { test, expect } from "./fixtures";
import { visitBuilding, endTurn } from "./helpers";
import { homesteadMicroState, crops } from "../../src/micro/state";

test("seasonal seeds, new crop harvests, and winter frost preserve trees", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  const capture = async (name: string) => {
    if (process.env.CROP_SCREENSHOTS_DIR)
      await page.screenshot({
        path: `${process.env.CROP_SCREENSHOTS_DIR}/${name}.png`,
      });
  };
  page.on("console", (entry) => {
    if (entry.type() === "error") errors.push(entry.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(request.url()));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/?instance=validation-seasonal-crops");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const edit = async (scope: string, state: unknown) => {
    await page.getByLabel("Work on").selectOption(scope);
    await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
    await page
      .getByRole("button", { name: "Apply state", exact: true })
      .click();
    await expect(page.locator("#dev-status")).toHaveText(
      "State applied and saved.",
    );
  };
  for (const crop of ["radish", "tomato", "pumpkin"] as const) {
    await edit("micro", homesteadMicroState());
    await edit("macro", {
      year: 1,
      season: crop === "radish" ? "spring" : "summer",
    });
    await visitBuilding(page, "seeds");
    await expect(page.locator("[data-crop]")).toHaveCount(6);
    await expect(page.locator('[data-crop="carrot"]')).toBeEnabled({
      enabled: crop === "radish",
    });
    if (crop === "pumpkin") {
      await page.locator('[data-crop="pumpkin"]').scrollIntoViewIfNeeded();
      await capture("seasonal-seeds");
    }
    await page.locator(`[data-crop="${crop}"]`).click();
    await page.locator('[data-plot="0"]').click();
    await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
      "aria-label",
      new RegExp(`${crops[crop].name}, growing`),
    );
    await endTurn(page);
    await expect(page.locator('[data-plot="0"]')).toHaveAttribute(
      "aria-label",
      /ready to harvest/,
    );
    await page.locator('[data-plot="0"]').click();
    await expect(page.locator("#season")).toContainText(
      `${100 - crops[crop].seed + crops[crop].sale} coins`,
    );
  }
  const farm = homesteadMicroState();
  for (const [index, crop] of (
    ["radish", "tomato", "pumpkin", "carrot", "turnip", "corn"] as const
  ).entries())
    farm.plots[index] = { crop, growth: index < 3 ? crops[crop].steps : 0 };
  farm.structures.push({
    id: 2,
    kind: "apple",
    row: 12,
    col: 19,
    level: 1,
    age: 12,
    fruitReady: true,
  });
  farm.nextStructureId = 3;
  await edit("micro", farm);
  await edit("macro", { year: 1, season: "fall" });
  await visitBuilding(page, "home");
  await expect(page.locator("#frost-warning")).toContainText(
    "all 6 field crops will die",
  );
  await capture("seasonal-fall");
  await page.locator("#next-season").click();
  await expect(page.locator("#season")).toContainText("winter");
  await expect(
    page.getByRole("button", { name: /Plot \d+: empty/ }),
  ).toHaveCount(9);
  await expect(page.locator("#farm-message")).toContainText(
    "Winter frost cleared all field crops",
  );
  await page.locator("#close-service").click();
  await capture("seasonal-winter");
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Plot \d+: empty/ }),
  ).toHaveCount(9);
  await page.getByLabel("Work on").selectOption("micro");
  await page.getByRole("button", { name: "Read current state" }).click();
  const saved = JSON.parse(
    await page.getByLabel("Game state JSON").inputValue(),
  ) as typeof farm;
  expect(saved.structures.some((s) => s.kind === "apple")).toBe(true);
  expect(errors).toEqual([]);
});
