import { test as base, expect } from "@playwright/test";
import { homesteadState, type GameState } from "../../src/game/state";

// Most regression paths exercise an established farm. Startup has its own suite.
export const test = base.extend<{ farmState: GameState }>({
  farmState: [homesteadState(), { option: true }],
  page: async ({ page, farmState }, use) => {
    await page.route(
      (url) => url.pathname === "/src/main.ts",
      async (route) => {
        await page.evaluate(async (seed) => {
          const instance =
            new URLSearchParams(location.search).get("instance") ?? "default";
          await new Promise<void>((resolve, reject) => {
            const request = indexedDB.open(`whatwesow-dev-${instance}`, 1);
            request.onupgradeneeded = () =>
              request.result.createObjectStore("saves");
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction("saves", "readwrite");
              const saves = transaction.objectStore("saves");
              const read = saves.get("current");
              read.onsuccess = () => {
                if (read.result === undefined) saves.put(seed, "current");
              };
              transaction.oncomplete = () => {
                db.close();
                resolve();
              };
              transaction.onerror = () => reject(transaction.error);
            };
          });
        }, farmState);
        await route.continue();
      },
    );
    await use(page);
  },
});
export { expect };

export type { Page } from "@playwright/test";
