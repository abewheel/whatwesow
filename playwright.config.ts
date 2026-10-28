import { defineConfig } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 5181);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PLAYWRIGHT_PORT must be 1024–65535.");
const workers =
  process.env.PLAYWRIGHT_WORKERS === undefined
    ? undefined
    : Number(process.env.PLAYWRIGHT_WORKERS);
if (workers !== undefined && (!Number.isInteger(workers) || workers < 1))
  throw new Error("PLAYWRIGHT_WORKERS must be a positive integer.");
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  // A path can include several real walks, seasonal saves, and asset reloads.
  timeout: 120000,
  expect: { timeout: 15000 },
  workers,
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
