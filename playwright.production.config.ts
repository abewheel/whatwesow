import { defineConfig } from "@playwright/test";
export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  testDir: "./tests/production",
  use: {
    baseURL: "http://127.0.0.1:5182",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm preview --host 127.0.0.1 --port 5182 --strictPort",
    url: "http://127.0.0.1:5182",
    reuseExistingServer: false,
  },
});
