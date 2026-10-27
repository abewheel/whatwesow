import { test, expect } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`integrated farm controls and keyboard menu at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/?instance=validation-hud-${width}`);
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    const farm = await page.locator(".farm-card").boundingBox();
    for (const selector of [".hud-top", ".farm-tools", ".field-note"]) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(farm!.x);
      expect(box.x + box.width).toBeLessThanOrEqual(farm!.x + farm!.width);
      expect(box.y + box.height).toBeLessThanOrEqual(farm!.y + farm!.height);
    }
    await expect(page.locator("#panel-build")).toBeHidden();
    await expect(page.locator("#panel-upgrade")).toBeHidden();
    const carrot = page.locator('[data-crop="carrot"]');
    await carrot.focus();
    await expect(carrot.locator(".control-detail")).toBeVisible();
    await expect(carrot.locator(".control-detail")).toContainText(
      "2 seasons to grow",
    );
    await carrot.click();
    await expect(page.locator("#farm-message")).toContainText(
      "2 seasons to grow",
    );
    await expect(page.locator('[data-crop="carrot"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page
      .getByRole("button", { name: "Plot 1: empty", exact: true })
      .click();
    await page.getByRole("button", { name: "End turn", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /Plot 1: Carrot, growing 1\/2/ }),
    ).toBeVisible();
    const trigger = page.getByRole("button", { name: "Open farm menu" });
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Back to the farm" }).click();
    await expect(trigger).toBeFocused();
  });
}

for (const width of [1440, 390]) {
  test(`activity dock collapses, preserves seeds, cancels placement and inspects buildings at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/?instance=validation-dock-${width}`);
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    await page.locator('[data-crop="carrot"]').click();
    await page
      .getByRole("button", { name: "Collapse tools", exact: true })
      .click();
    await expect(page.locator("#tool-panels")).toBeHidden();
    await expect(page.locator("#active-tool")).toHaveText("Carrot seeds");
    await page
      .getByRole("button", { name: "Plot 1: empty", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Plot 1: Carrot, growing/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Expand tools", exact: true })
      .click();
    await expect(page.locator('[data-crop="carrot"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.locator("#mode-build").click();
    await expect(page.locator("#panel-plant")).toBeHidden();
    await expect(page.locator("#panel-build")).toBeVisible();
    await page.locator('[data-build="oak"]').click();
    await expect(page.locator("#tool-panels")).toBeHidden();
    await expect(page.locator("#active-tool")).toHaveText("Place Oak tree");
    await page.locator("#mode-upgrade").click();
    await expect(page.locator("#panel-build")).toBeHidden();
    await page.getByRole("button", { name: "Land 14,18", exact: true }).click();
    await expect(page.locator("#season")).toContainText("93 coins");
    await page.locator('[data-structure="1"]').click();
    await expect(page.locator("#panel-upgrade")).toBeVisible();
    await expect(page.locator("#selected-building")).toContainText("Farmhouse");
    await page.locator("#move-building").focus();
    await page.keyboard.press("Escape");
    await expect(page.locator("#tool-panels")).toBeHidden();
    await expect(page.locator("#mode-upgrade")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#panel-upgrade")).toBeVisible();
  });
}

test("startup storage failures remain visible outside the save menu", async ({
  page,
}) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.goto("/?instance=validation-storage-warning");
  await expect(page.locator("#farm-menu")).toBeHidden();
  await expect(page.locator("#farm-message")).toBeVisible();
  await expect(page.locator("#farm-message")).toContainText(
    "Could not load local save",
  );
});

test("selected seed feedback matches the policy-adjusted harvest", async ({
  page,
}) => {
  await page.goto("/?instance=validation-seed-policy");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const download = page.waitForEvent("download");
  await page.locator("#open-menu").click();
  await page.locator("#export").click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const state = JSON.parse(Buffer.concat(chunks).toString());
  state.farmPolicy = { productionMultiplier: 0.5 };
  await page.locator("#import").setInputFiles({
    name: "policy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page.locator("#resume").click();
  await page.locator('[data-crop="carrot"]').click();
  await expect(page.locator("#farm-message")).toContainText("Harvest 9 coins");
  await page.locator('[data-plot="0"]').click();
  await page.locator("#grow").click();
  await page.locator("#grow").click();
  await page.getByRole("button", { name: /Plot 1: Carrot, ready/ }).click();
  await expect(page.locator("#farm-message")).toContainText("+9 coins");
  await expect(page.locator("#season")).toContainText("102 coins");
});

for (const viewport of [
  { width: 601, height: 768 },
  { width: 390, height: 600 },
  { width: 1024, height: 600 },
]) {
  test(`recovery and dock controls stay in view at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/?instance=validation-dock-fit-${viewport.width}`);
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    await page.getByLabel("Work on").selectOption("micro");
    const editor = page.getByLabel("Game state JSON");
    const state = JSON.parse(await editor.inputValue());
    state.coins = 0;
    await editor.fill(JSON.stringify(state));
    await page
      .getByRole("button", { name: "Apply state", exact: true })
      .click();
    await page.locator(".farm-card").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.fonts.ready);
    for (const id of ["grow", "work", "collapse-tools"]) {
      const box = (await page.locator(`#${id}`).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.locator("#work").click();
    await expect(page.locator("#season")).toContainText("4 coins");
    await page.locator("#collapse-tools").click();
    await expect(page.locator("#tool-panels")).toBeHidden();
  });
}

for (const viewport of [
  { width: 601, height: 768 },
  { width: 1024, height: 600 },
]) {
  test(`estate navigation yields to construction at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/?instance=validation-estate-overlap-${viewport.width}`);
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    await page.locator("#estate-toggle").click();
    await expect(page.locator("#estate-controls")).toBeVisible();
    await expect
      .poll(async () => {
        const header = (await page.locator(".hud-top").boundingBox())!;
        const estate = (await page.locator("#estate-controls").boundingBox())!;
        return estate.y - (header.y + header.height);
      })
      .toBeGreaterThanOrEqual(4);
    await expect(page.locator("#tool-panels")).toBeHidden();
    await page.locator("#mode-build").click();
    await expect(page.locator("#estate-controls")).toBeHidden();
    await page.locator("#estate-toggle").click();
    await page
      .getByRole("button", { name: "Expand tools", exact: true })
      .click();
    await expect(page.locator("#estate-controls")).toBeHidden();
    await expect(page.locator("#estate-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    const plot = page.locator('[data-build="plot"]');
    await plot.click();
    await expect(page.locator("#active-tool")).toHaveText("Place plot");
  });
}

test("header menus stay reachable above the phone breakpoint", async ({
  page,
}) => {
  await page.setViewportSize({ width: 601, height: 768 });
  await page.goto("/?instance=validation-header-fit");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  await page.locator("#import").setInputFiles({
    name: "large-balance.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        year: 40,
        season: "winter",
        coins: 999999,
      }),
    ),
  });
  await expect(page.locator("#season")).toContainText("999,999 coins");
  await page.evaluate(() => document.fonts.ready);
  for (const id of ["season", "estate-toggle", "open-menu"]) {
    const box = (await page.locator(`#${id}`).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(601);
  }
  await page.locator("#open-menu").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
