import { defineConfig } from "@playwright/test";
import { fileURLToPath, URL } from "node:url";

const port = Number(process.env.VIDEO_PORT ?? 5197);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("VIDEO_PORT must be 1024–65535.");

export default defineConfig({
  testDir: "./shots",
  outputDir: "./output",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    video: { mode: "on", size: { width: 1920, height: 1080 } },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    command: `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
