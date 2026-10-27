import { visitBuilding, endTurn, clickCamera } from "./helpers";
import { test, expect } from "./fixtures";
import { homesteadMicroState as initialMicroState } from "../../src/micro/state";

test("farmer stands adjacent to actual plots, follows relocated plots, and keeps alignment when zoomed", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(r.url()));
  await page.goto("/?instance=validation-farmer-adjacency");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const canvas = page.locator("canvas");
  await page
    .getByRole("button", { name: "Plot 1: empty", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-farmer-motion", "plant");
  await expect(canvas).toHaveAttribute("data-farmer-target", "16,16");
  const stance = (await canvas.getAttribute("data-farmer-cell"))!
    .split(",")
    .map(Number);
  expect(Math.abs(stance[0] - 16) + Math.abs(stance[1] - 16)).toBe(1);
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await endTurn(page);
  await expect(page.locator("#season")).toContainText("summer");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await page.getByRole("button", { name: /Plot 1: Turnip, ready/ }).click();
  await expect(canvas).toHaveAttribute("data-farmer-motion", "harvest");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");

  await visitBuilding(page, "seeds");
  await page.locator('[data-crop="carrot"]').click();
  const farm = initialMicroState();
  farm.plotCells[0] = { row: 18, col: 16 };
  await page.getByLabel("Work on").selectOption("micro");
  await page.getByLabel("Game state JSON").fill(JSON.stringify(farm));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await page
    .getByRole("button", { name: "Plot 1: empty", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-farmer-motion", "plant");
  await expect(canvas).toHaveAttribute("data-farmer-target", "18,16");
  const relocated = (await canvas.getAttribute("data-farmer-cell"))!
    .split(",")
    .map(Number);
  expect(Math.abs(relocated[0] - 18) + Math.abs(relocated[1] - 16)).toBe(1);

  await clickCamera(page, "#zoom-out");
  await expect(canvas).toHaveAttribute("data-farmer-cell", relocated.join(","));
  expect(errors).toEqual([]);
});

test("farmer recovers on permitted land and waters only a crop that grew", async ({
  page,
}) => {
  await page.goto("/?instance=validation-farmer-policy");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.getByLabel("Work on").selectOption("full");
  const state = JSON.parse(
    await page.getByLabel("Game state JSON").inputValue(),
  );
  state.plots[0] = { crop: "turnip", growth: 0 };
  state.plots[1] = { crop: "turnip", growth: 0 };
  state.farmPolicy = { land: [{ row: 14, col: 14, width: 2, height: 2 }] };
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await endTurn(page);
  await expect(
    page.getByRole("button", { name: /Plot 1: Turnip, growing 0/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /Plot 2: Turnip, ready/ }),
  ).toHaveCount(1);
});
