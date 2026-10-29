import { test, expect } from "./fixtures";
import { loadPreset, openCell, readFarm, setFarm } from "./context-helpers";

for (const [kind, category, title] of [
  ["shed", "farm", "Seed storehouse"],
  ["beehive", "farm", "Wooden beehive"],
  ["apple", "trees", "Apple tree"],
  ["coop", "animals", "Chicken coop"],
]) {
  test(`${kind} starts beside the selected lot without returning to spawn`, async ({
    page,
  }) => {
    await page.routeWebSocket("**", (socket) => socket.close());
    await page.goto(`/?instance=validation-build-arrival-${kind}`);
    await loadPreset(page, "community");
    if (kind === "coop") {
      const state = await readFarm(page);
      for (const cell of [
        ...Array.from({ length: 4 }, (_, i) => ({ row: 29, col: 30 + i })),
        ...Array.from({ length: 4 }, (_, i) => ({ row: 30 + i, col: 29 })),
      ])
        state.structures.push({
          ...cell,
          id: state.nextStructureId++,
          kind: "oak",
          level: 1,
        });
      await setFarm(page, state);
    }
    await openCell(page, "30,30");
    await page.locator(`[data-category="${category}"]`).click();
    const canvas = page.locator("canvas");
    await expect(canvas).toHaveAttribute("data-farmer-cell", "30,30");
    await canvas.evaluate((el) => {
      const trace: string[] = [el.dataset.farmerCell!];
      Object.assign(el, { constructionTrace: trace });
      new MutationObserver(() => trace.push(el.dataset.farmerCell!)).observe(
        el,
        { attributes: true, attributeFilter: ["data-farmer-cell"] },
      );
    });
    await page.locator(`[data-build="${kind}"]`).click();
    await page.locator('[data-cell="30,30"]').press("Enter");
    if (kind === "coop") {
      const bounds = (await page.locator("#farm").boundingBox())!;
      await page.mouse.move(bounds.x + 40, bounds.y + bounds.height * 0.7);
      await page.mouse.down();
      await page.mouse.move(bounds.x + 100, bounds.y + bounds.height * 0.7, {
        steps: 3,
      });
      await page.mouse.up();
    }
    await expect(page.locator("#service-title")).toHaveText(title);
    await expect(page.locator("#service-panel")).toBeVisible();
    await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
    const trace = await canvas.evaluate(
      (el) =>
        (el as HTMLCanvasElement & { constructionTrace: string[] })
          .constructionTrace,
    );
    for (const cell of trace) {
      const [row, col] = cell.split(",").map(Number);
      expect(Math.abs(row - 30) + Math.abs(col - 30)).toBeLessThanOrEqual(
        kind === "coop" ? 5 : 2,
      );
    }
    expect(await canvas.getAttribute("data-farmer-cell")).not.toBe("30,30");
    await page.screenshot({ path: `/tmp/construction-arrival-${kind}.png` });
  });
}

for (const redirect of [false, true])
  test(`${redirect ? "Redirecting" : "Closing"} an unfinished construction approach cancels the purchase`, async ({
    page,
  }) => {
    await page.routeWebSocket("**", (socket) => socket.close());
    await page.goto("/?instance=validation-build-approach-cancel");
    await loadPreset(page, "community");
    const state = await readFarm(page);
    const blockers = [
      ...Array.from({ length: 5 }, (_, i) => ({ row: 29, col: 30 + i })),
      ...Array.from({ length: 5 }, (_, i) => ({ row: 30 + i, col: 29 })),
    ];
    for (const cell of blockers)
      state.structures.push({
        ...cell,
        id: state.nextStructureId++,
        kind: "oak",
        level: 1,
      });
    await setFarm(page, state);
    await openCell(page, "30,30");
    await page.locator('[data-category="animals"]').click();
    await page.locator('[data-build="dairy"]').click();
    await page.locator('[data-cell="30,30"]').press("Enter");
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-farmer-motion",
      "walk",
    );
    await page.keyboard.press("Escape");
    if (redirect) {
      await page.locator('[data-cell="36,36"]').press("Enter");
      await page.keyboard.press("e");
      await expect(page.locator("#service-title")).toHaveText("Open land");
    } else {
      await expect(page.locator("canvas")).toHaveAttribute(
        "data-farmer-motion",
        "idle",
      );
      await expect(page.locator("#service-panel")).toBeHidden();
    }
    const after = await readFarm(page);
    expect(after.coins).toBe(state.coins);
    expect(after.structures).toHaveLength(state.structures.length);
  });
