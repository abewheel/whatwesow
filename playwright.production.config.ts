import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/production",
  use: { baseURL: "http://127.0.0.1:5182", headless: true },
  webServer: {
    command: "pnpm preview --host 127.0.0.1 --port 5182 --strictPort",
    url: "http://127.0.0.1:5182",
    reuseExistingServer: false,
  },
});
