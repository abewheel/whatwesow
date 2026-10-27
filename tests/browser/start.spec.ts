import { test, expect } from "@playwright/test";
import { visitBuilding } from "./helpers";
test("loads behind a cover, starts bare, builds fields and completes a home next season", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(r.url()));
  await page.route("**/art/farm-atlas.png", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.goto("/?instance=validation-first-season");
  await expect(page.locator("#startup")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inherit your farm" }),
  ).toBeVisible();
  await expect(page.locator("main")).toBeHidden();
  await page.locator("#begin-farm").click();
  await expect(page.locator("[data-plot]")).toHaveCount(0);
  await expect(page.locator("[data-structure]")).toHaveCount(0);
  await expect(page.locator("[data-service]")).toHaveCount(1);
  await visitBuilding(page, "home");
  await page
    .getByRole("button", { name: "Prepare fields", exact: true })
    .click();
  await page.locator("#expand").click();
  await page.locator('[data-cell="16,16"]').click();
  await expect(page.locator("[data-plot]")).toHaveCount(1);
  await page.locator("#farm-mode").click();
  await visitBuilding(page, "home");
  await page
    .getByRole("button", { name: "Build your house", exact: true })
    .click();
  await expect(page.locator('[data-build="oak"]')).toBeHidden();
  await page.locator('[data-build="home"]').click();
  await page.locator('[data-cell="12,18"]').click();
  await expect(page.locator("#farm-message")).toContainText(
    "construction started",
  );
  await page.locator("#farm-mode").click();
  await expect(page.locator('[data-service="home"]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator("#startup")).toBeHidden();
  await visitBuilding(page, "home");
  await page.locator("#next-season").click();
  await expect(page.locator("#season")).toContainText("summer");
  await expect(page.locator("[data-service]")).toHaveCount(0);
  await expect(page.locator('[data-structure="1"]')).toHaveAttribute(
    "aria-label",
    /level 1/,
  );
  await page.locator("#close-service").click();
  await visitBuilding(page, "home");
  await expect(
    page.getByRole("button", { name: "Prepare fields", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("the tent can end turn one before a house is commissioned", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/?instance=validation-tent-only");
  await page.locator("#begin-farm").click();
  await visitBuilding(page, "home");
  await page.locator("#next-season").click();
  await expect(page.locator("#season")).toContainText("summer");
  await expect(page.locator("[data-structure]")).toHaveCount(0);
  await expect(page.locator('[data-service="home"]')).toHaveCount(1);
  await expect(page.locator("#next-season")).toBeEnabled();
});

test("the starter title waits for the pixel font instead of flashing fallback text", async ({
  page,
}) => {
  let releaseFont!: () => void;
  const fontGate = new Promise<void>((resolve) => {
    releaseFont = resolve;
  });
  await page.route("**/fonts/pixelify-sans.ttf", async (route) => {
    await fontGate;
    await route.continue();
  });
  await page.goto("/?instance=validation-font-loading", {
    waitUntil: "commit",
  });
  await expect(page.locator("#startup")).toBeVisible();
  await expect(page.locator(".arrival")).toBeHidden();
  releaseFont();
  await expect(page.locator("#startup-title")).toBeVisible();
  await expect(page.locator("#begin-farm")).toBeVisible();
});

for (const saved of [false, true]) {
  test(`artwork failure keeps ${saved ? "a saved" : "a new"} farm behind a retry screen`, async ({
    page,
  }) => {
    const url = `/?instance=validation-artwork-failure-${saved}`;
    if (saved) {
      await page.goto(url);
      await page.locator("#begin-farm").click();
      await visitBuilding(page, "home");
      await page.locator("#next-season").click();
      await expect(page.locator("#season")).toContainText("summer");
    }
    await page.route("**/art/farm-atlas-fall.png", (route) => route.abort());
    await page.goto(url);
    await expect(page.locator("#startup-copy")).toContainText(
      "artwork could not load",
    );
    await expect(
      page.getByRole("button", { name: "Reload farm", exact: true }),
    ).toBeVisible();
    await expect(page.locator("main")).toBeHidden();
    // All other artwork has finished loading; it must not dismiss the error.
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    await expect(page.locator("#startup")).toBeVisible();
    await page.unroute("**/art/farm-atlas-fall.png");
    await page
      .getByRole("button", { name: "Reload farm", exact: true })
      .click();
    if (saved) {
      await expect(page.locator("#startup")).toBeHidden();
      await expect(page.locator("#season")).toContainText("summer");
    } else {
      await expect(
        page.getByRole("button", { name: "Inherit your farm", exact: true }),
      ).toBeVisible();
    }
  });
}
