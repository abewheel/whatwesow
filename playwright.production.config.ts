import { defineConfig } from "@playwright/test";
export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  testDir: "./tests/production",
  use: {
    baseURL: "http://127.0.0.1:5182",
    headless: true,
    // The estate has 4,096 DOM targets. Snapshotting that tree at every
    // action dominates these tests; retain call/network/timing evidence instead.
    trace: { mode: "retain-on-failure", snapshots: false, screenshots: false },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm preview --host 127.0.0.1 --port 5182 --strictPort",
    url: "http://127.0.0.1:5182",
    reuseExistingServer: false,
  },
});
