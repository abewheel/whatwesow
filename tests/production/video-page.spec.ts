import { test, expect } from "@playwright/test";

test("production /video serves the demo with a playable home link", async ({
  page,
  request,
}) => {
  const response = await page.goto("/video");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Watch What We Sow");
  const video = page.locator("video");
  await expect
    .poll(() =>
      video.evaluate(
        (element: HTMLVideoElement) =>
          element.muted && !element.paused && element.currentTime > 0,
      ),
    )
    .toBe(true);
  const media = await request.get("/media/what-we-sow-demo.mp4", {
    headers: { Range: "bytes=0-1023" },
  });
  expect(media.status()).toBe(206);
  expect(media.headers()["content-type"]).toContain("video/mp4");
  await page.getByRole("link", { name: "Play", exact: true }).click();
  await expect(page).toHaveTitle("What We Sow");
});
