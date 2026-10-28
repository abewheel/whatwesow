import { choosePlotWork } from "./helpers";
import { expect, test } from "./fixtures";
import { clickCamera } from "./helpers";

test("the HUD stays compact and menus do not order a walk", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(r.url()));
  await page.goto("/?instance=validation-navigation");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await expect(page.locator("[data-visit]")).toHaveCount(0);
  await expect(page.locator("#view-row")).toBeHidden();
  await expect(page.locator("#zoom-in")).toBeHidden();
  await expect(page.locator("#farm-mode")).toBeHidden();
  await page.locator("[data-cell='20,20']").click();
  await page.getByRole("button", { name: "Walk here", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-farmer-motion", "walk");
  await expect(canvas).toHaveAttribute("data-farmer-target", "20,20");
  await expect(canvas).toHaveAttribute("data-farmer-cell", "20,20", {
    // Keep real travel covered on software-rendered CI browsers.
    timeout: 30000,
  });
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await page.locator("[data-service=seeds]").click();
  await expect(page.locator("#service-panel")).toBeVisible();
  await expect(canvas).toHaveAttribute("data-farmer-cell", "20,20");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await clickCamera(page, "#zoom-out");
  await expect(page.locator("#zoom-level")).toHaveText("75%");
  await page.locator("#camera-controls summary").click();
  await expect(page.locator("#zoom-out")).toBeHidden();
  await expect(page.locator("#season")).toContainText("100 coins");
  expect(errors).toEqual([]);
});

test("a new ground click replaces the current walk and a drag does not give a destination", async ({
  page,
}) => {
  await page.goto("/?instance=validation-redirect-walk");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await page.locator("[data-cell='22,20']").click();
  await page.getByRole("button", { name: "Walk here", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-farmer-motion", "walk");
  await page.locator("[data-cell='18,17']").click();
  await page.getByRole("button", { name: "Walk here", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-farmer-target", "18,17");
  await expect(canvas).toHaveAttribute("data-farmer-cell", "18,17", {
    timeout: 30000,
  });
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  const bounds = (await page.locator("#farm").boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 - 110,
    bounds.y + bounds.height / 2 - 60,
    { steps: 6 },
  );
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-farmer-cell", "18,17");
  await expect(canvas).toHaveAttribute("data-farmer-target", "");
  await expect(page.locator("#season")).toContainText("100 coins");
});

test("redirecting before planting leaves the plot empty even with slow saves", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(
      IDBTransaction.prototype,
      "oncomplete",
    )!;
    Object.defineProperty(IDBTransaction.prototype, "oncomplete", {
      configurable: true,
      get: descriptor.get,
      set(callback: ((event: Event) => void) | null) {
        descriptor.set!.call(
          this,
          callback
            ? function (this: IDBTransaction, event: Event) {
                setTimeout(() => callback.call(this, event), 250);
              }
            : null,
        );
      },
    });
  });
  await page.goto("/?instance=validation-walk-during-save");
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await page.locator("[data-plot='0']").click();
  await choosePlotWork(page);
  await page.locator("[data-cell='20,19']").click();
  await page.getByRole("button", { name: "Walk here", exact: true }).click();
  await expect(page.locator("#season")).toContainText("100 coins");
  await expect(canvas).toHaveAttribute("data-farmer-cell", "20,19", {
    timeout: 30000,
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
      ),
  );
  await expect(canvas).toHaveAttribute("data-farmer-motion", "idle");
  await expect(canvas).toHaveAttribute("data-farmer-cell", "20,19");
  await expect(page.locator("[data-plot='0']")).toHaveAttribute(
    "aria-label",
    /empty/,
  );
});
