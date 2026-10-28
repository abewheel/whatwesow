import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

// A capture pipeline check, not a selected beat for the final film.
test("first-field", async ({ page }, testInfo) => {
  const diagnostics = [];
  const events = [];
  const started = performance.now();
  const mark = (name) =>
    events.push({ name, atMs: Math.round(performance.now() - started) });
  page.on("pageerror", (error) => diagnostics.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.push(message.text());
  });
  page.on("requestfailed", (request) =>
    diagnostics.push(`${request.url()}: ${request.failure()?.errorText}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400)
      diagnostics.push(`${response.status()}: ${response.url()}`);
  });

  try {
    await page.goto(`/?instance=validation-video-${Date.now()}`);
    await page.getByRole("button", { name: "Inherit your farm" }).click();
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    // Close development controls before the usable footage begins.
    await page.getByText("Playtest tools", { exact: true }).click();
    await page.evaluate(() => globalThis.scrollTo(0, 0));
    await expect(page.locator("[data-plot]")).toHaveCount(0);
    mark("usable-start");
    await page.screenshot({ path: testInfo.outputPath("before.png") });
    await page.locator('[data-cell="16,16"]').click();
    await page.locator("#expand").click();
    await expect(page.locator("[data-plot]")).toHaveCount(1);
    await expect(page.locator("#save-status")).toHaveText(
      "Saved on this browser",
    );
    await page.locator("#close-service").click();
    mark("field-created");
    await page.screenshot({ path: testInfo.outputPath("after.png") });
    // Editorial hold only. Gameplay completion was asserted above.
    await page.waitForTimeout(1500);
    mark("usable-end");
  } finally {
    const metadataPath = testInfo.outputPath("capture-metadata.json");
    await writeFile(
      metadataPath,
      JSON.stringify(
        {
          shot: "first-field",
          purpose: "Infrastructure smoke capture; provisional footage",
          commit: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          dirty: Boolean(
            execFileSync("git", ["status", "--porcelain"], {
              encoding: "utf8",
            }).trim(),
          ),
          viewport: page.viewportSize(),
          timing:
            "Milliseconds since scenario start; not encoded video timecodes",
          events,
          diagnostics,
        },
        null,
        2,
      ),
    );
    await testInfo.attach("capture-metadata", {
      path: metadataPath,
      contentType: "application/json",
    });
  }
  expect(diagnostics).toEqual([]);
});
