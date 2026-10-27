import { expect, test } from "./fixtures";
import { clickCamera, setCameraCell } from "./helpers";

test("painted ground survives camera changes, GPU recovery, and seasonal cache reuse", async ({
  page,
}) => {
  await page.goto("/?instance=validation-terrain-stability");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-farmer-motion",
    "idle",
  );
  await setCameraCell(page, "row", "32");
  await setCameraCell(page, "column", "32");
  await clickCamera(page, "#go-to-cell");
  await page.locator("#camera-controls summary").click();
  await page.mouse.move(100, 200);
  const sample = async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    return page.screenshot({
      clip: { x: 400, y: 250, width: 180, height: 100 },
    });
  };
  const spring = await sample();
  await page.locator("#farm").evaluate((el) => {
    el.scrollLeft += 128;
  });
  await sample();
  await page.locator("#farm").evaluate((el) => {
    el.scrollLeft -= 128;
  });
  expect((await sample()).equals(spring)).toBe(true);
  await clickCamera(page, "#zoom-in");
  await clickCamera(page, "#zoom-reset");
  await page.locator("#camera-controls summary").click();
  expect((await sample()).equals(spring)).toBe(true);
  await page.locator("canvas").evaluate(async (element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const recovery = gl?.getExtension("WEBGL_lose_context");
    if (!recovery)
      throw new Error("WebGL context recovery is required for this test");
    await new Promise<void>((resolve) => {
      canvas.addEventListener("webglcontextrestored", () => resolve(), {
        once: true,
      });
      canvas.addEventListener(
        "webglcontextlost",
        () => {
          setTimeout(() => recovery.restoreContext(), 50);
        },
        { once: true },
      );
      recovery.loseContext();
    });
  });
  expect((await sample()).equals(spring)).toBe(true);
  await page.getByLabel("Work on").selectOption("macro");
  for (const season of ["summer", "fall", "winter", "spring"]) {
    await page
      .getByLabel("Game state JSON")
      .fill(JSON.stringify({ year: 1, season }));
    await page
      .getByRole("button", { name: "Apply state", exact: true })
      .click();
    await expect(page.locator("#dev-status")).toHaveText(
      "State applied and saved.",
    );
    const pixels = await sample();
    if (season === "spring") expect(pixels.equals(spring)).toBe(true);
    else expect(pixels.equals(spring)).toBe(false);
  }
});
