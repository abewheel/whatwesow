import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { execFileSync } from "node:child_process";
const project = fileURLToPath(new URL("..", import.meta.url));
const out = `${project}/assets/local`;
const base = process.env.FILM_URL ?? "http://127.0.0.1:5174/";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const diagnostics = [];
const takes = {};
const structures = [
  { id: 1, kind: "home", row: 11, col: 14, level: 1 },
  { id: 2, kind: "shed", row: 12, col: 10, level: 1 },
  { id: 3, kind: "coop", row: 10, col: 20, level: 1 },
  { id: 4, kind: "apple", row: 19, col: 14, level: 1 },
];
async function open(
  id,
  viewport = { width: 1920, height: 1080 },
  record = true,
) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    ...(record ? { recordVideo: { dir: `${out}/raw`, size: viewport } } : {}),
  });
  if (record)
    await context.addInitScript(() => {
      globalThis.addEventListener("DOMContentLoaded", () => {
        const el = globalThis.document.createElement("div");
        el.id = "film-pointer";
        el.style.cssText =
          "position:fixed;left:0;top:0;width:36px;height:44px;pointer-events:none;z-index:2147483647;opacity:0";
        el.innerHTML =
          '<svg viewBox="0 0 30 38"><path d="M3 2L3 31L11 23L17 35L23 32L17 20L28 20Z" fill="#fff7da" stroke="#362819" stroke-width="2.4"/></svg>';
        globalThis.document.body.append(el);
        globalThis.addEventListener("pointermove", (e) => {
          el.style.opacity = "1";
          el.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`;
        });
      });
    });
  const page = await context.newPage();
  const epoch = Date.now();
  const events = [];
  const mark = (name) => events.push({ name, t: (Date.now() - epoch) / 1000 });
  page.on("pageerror", (e) => diagnostics.push(`${id}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") diagnostics.push(`${id}: ${m.text()}`);
  });
  page.on("requestfailed", (r) =>
    diagnostics.push(`${id}: ${r.url()} ${r.failure()?.errorText}`),
  );
  page.on("response", (r) => {
    if (r.status() >= 400) diagnostics.push(`${id}: ${r.status()} ${r.url()}`);
  });
  await page.goto(`${base}?instance=validation-film-${id}`);
  await page
    .getByRole("button", { name: "Female farmer", exact: true })
    .click();
  await page.locator("#begin-farm").click();
  await expect(page.locator("#startup")).toBeHidden();
  return {
    page,
    context,
    mark,
    events,
    async finish() {
      const video = page.video();
      await context.close();
      if (video) await copyFile(await video.path(), `${out}/${id}.webm`);
      takes[id] = { events, viewport };
      await writeFile(
        `${out}/${id}-timing.json`,
        JSON.stringify(takes[id], null, 2),
      );
      console.log(id, events);
    },
  };
}
async function apply(page, state) {
  await page.reload();
  await expect(page.locator("#startup")).toBeHidden();
  await page.keyboard.press("Escape");
  if (!(await page.getByLabel("Work on").isVisible()))
    await page.getByText("Playtest tools", { exact: true }).click();
  await page.getByLabel("Work on").selectOption("full");
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  await page.locator("#dev-status").evaluate((el) => (el.textContent = ""));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
  await page.reload();
  await expect(page.locator("#startup")).toBeHidden();
  await page.addStyleTag({
    content: ".dev-panel, #crisis-test {display:none!important}",
  });
  await page.evaluate(() => globalThis.scrollTo(0, 0));
}
async function camera(page, zoom = "200%") {
  await page.locator("#camera-controls summary").click();
  while ((await page.locator("#zoom-level").textContent()) !== zoom)
    await page.locator("#zoom-in").click();
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const farm = globalThis.document.querySelector("#farm");
    const cell = globalThis.document.querySelector('[data-cell="16,16"]');
    const r = cell.getBoundingClientRect(),
      f = farm.getBoundingClientRect();
    farm.scrollBy(
      r.x + r.width / 2 - (f.x + f.width * 0.46),
      r.y + r.height / 2 - (f.y + f.height * 0.67),
    );
    globalThis.scrollTo(0, 0);
  });
  await page.mouse.move(35, 1000);
  await page.evaluate(
    () =>
      new Promise((r) =>
        globalThis.requestAnimationFrame(() =>
          globalThis.requestAnimationFrame(r),
        ),
      ),
  );
}
async function click(page, locator) {
  const r = await locator.boundingBox();
  if (!r) throw Error("Missing target");
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 18 });
  await page.waitForTimeout(300);
  await locator.click();
}
const home = (p) =>
  p.getByRole("button", { name: /^Farmhouse \d+, level/ }).first();
try {
  const setup = await open("setup", undefined, false);
  const hero = await setup.page.evaluate(async (structures) => {
    const { presetState } = await import("/src/dev/presets.ts");
    const { crops } = await import("/src/micro/state.ts");
    const s = presetState("harvesting");
    s.year = 7;
    s.season = "summer";
    s.farmerVariant = "female";
    s.selfBuilt = true;
    s.structures = structures;
    s.nextStructureId = 5;
    s.seeds.turnip = 2;
    s.debris = [];
    s.plots = s.plots.map((_, i) => {
      const crop = ["turnip", "carrot", "corn"][i % 3];
      return { crop, growth: crops[crop].steps };
    });
    return s;
  }, structures);
  const start = await setup.page.evaluate(async (structures) => {
    const { presetState } = await import("/src/dev/presets.ts");
    const s = presetState("crisis-3");
    s.selfBuilt = true;
    s.farmerVariant = "female";
    s.structures = structures;
    s.nextStructureId = 5;
    s.debris = [];
    s.crises[0].pick = "D-LIB-P";
    s.crises[1].pick = "B-LIB-P";
    return s;
  }, structures);
  await setup.finish();
  await writeFile(
    `${out}/starting-saves.json`,
    JSON.stringify({ hero, start }, null, 2),
  );
  if (!process.env.FILM_ONLY) {
    const readme = await open("readme", { width: 1280, height: 800 }, false);
    await apply(readme.page, hero);
    await camera(readme.page, "150%");
    await readme.page.screenshot({
      path: fileURLToPath(
        new URL("../../../../docs/images/gameplay-farm.png", import.meta.url),
      ),
    });
    await readme.finish();
    const farm = await open("farming");
    const p = farm.page;
    await apply(p, hero);
    await camera(p);
    farm.mark("hero");
    await p.screenshot({ path: `${out}/hero.png` });
    await p.waitForTimeout(3_000);
    farm.mark("harvest-start");
    await click(p, p.locator('[data-plot="0"]'));
    await click(
      p,
      p.getByRole("button", { name: "Harvest crop", exact: true }),
    );
    await expect(p.locator('[data-plot="0"]')).toHaveAttribute(
      "aria-label",
      /empty/,
      { timeout: 60000 },
    );
    await p.keyboard.press("Escape");
    farm.mark("harvest-done");
    await p.waitForTimeout(1500);
    farm.mark("plant-start");
    await click(p, p.locator('[data-plot="0"]'));
    await click(p, p.locator('[data-crop="turnip"]'));
    await expect(p.locator('[data-plot="0"]')).toHaveAttribute(
      "aria-label",
      /Turnip, growing/,
      { timeout: 60000 },
    );
    await p.keyboard.press("Escape");
    farm.mark("plant-done");
    await p.waitForTimeout(1800);
    farm.mark("season-start");
    await click(p, home(p));
    await click(p, p.locator("#next-season"));
    await expect(p.locator("#season")).toContainText("fall", {
      timeout: 60000,
    });
    await expect(p.locator(".season-transition")).toHaveCount(0);
    await p.keyboard.press("Escape");
    farm.mark("fall");
    await p.waitForTimeout(1800);
    farm.mark("second-harvest");
    await click(p, p.locator('[data-plot="0"]'));
    await click(
      p,
      p.getByRole("button", { name: "Harvest crop", exact: true }),
    );
    await expect(p.locator('[data-plot="0"]')).toHaveAttribute(
      "aria-label",
      /empty/,
      { timeout: 60000 },
    );
    await p.keyboard.press("Escape");
    await p.waitForTimeout(900);
    farm.mark("expand-start");
    await click(p, p.locator('[data-cell="16,18"]'));
    await click(p, p.locator("#expand"));
    await expect(p.locator("[data-plot]")).toHaveCount(10);
    await p.keyboard.press("Escape");
    farm.mark("expanded");
    await p.mouse.move(35, 1000, { steps: 12 });
    await p.waitForTimeout(2000);
    farm.mark("end");
    await farm.finish();
  }
  for (const [id, pick, count] of process.env.FILM_ONLY
    ? []
    : [
        ["rights", "E-OBJ", 9],
        ["taking", "E-PRO-M", 5],
      ]) {
    const take = await open(id);
    const p = take.page;
    await apply(p, start);
    await camera(p);
    take.mark("before");
    await p.screenshot({ path: `${out}/${id}-before.png` });
    await p.waitForTimeout(1200);
    await click(p, home(p));
    await click(p, p.locator("#next-season"));
    await expect(p.locator("#crisis")).toBeVisible({ timeout: 60000 });
    take.mark("council");
    await p.mouse.move(35, 1000, { steps: 8 });
    await p.screenshot({ path: `${out}/${id}-council.png` });
    await writeFile(
      `${out}/${id}-card-boxes.json`,
      JSON.stringify(
        await p.locator("#crisis [data-pick]").evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect();
            return {
              id: e.dataset.pick,
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
            };
          }),
        ),
        null,
        2,
      ),
    );
    await p.waitForTimeout(id === "rights" ? 9000 : 3500);
    take.mark("choice-start");
    await click(p, p.locator(`#crisis [data-pick="${pick}"]`));
    take.mark("choice-done");
    await p.waitForTimeout(2600);
    await p.screenshot({ path: `${out}/${id}-policy.png` });
    take.mark("policy");
    await click(
      p,
      p.getByRole("button", { name: "Back to the farm", exact: true }),
    );
    await p.keyboard.press("Escape");
    await expect(p.locator("[data-plot]")).toHaveCount(count);
    await p.mouse.move(35, 1000, { steps: 10 });
    take.mark("after");
    await p.waitForTimeout(6500);
    await p.screenshot({ path: `${out}/${id}-after.png` });
    take.mark("end");
    await take.finish();
  }
  // Seasonal world views are separate labelled dates, not simulated growth.
  const seasonTake = await open("seasons");
  for (const season of ["spring", "summer", "fall", "winter"]) {
    const s = JSON.parse(JSON.stringify(hero));
    s.season = season;
    if (season === "winter") s.plots = s.plots.map(() => null);
    await apply(seasonTake.page, s);
    await camera(seasonTake.page);
    seasonTake.mark(season);
    await seasonTake.page.mouse.move(35, 1000);
    await seasonTake.page.waitForTimeout(2500);
    seasonTake.mark(`${season}-end`);
    await seasonTake.page.screenshot({ path: `${out}/${season}.png` });
  }
  await seasonTake.finish();
  await writeFile(
    `${out}/capture.json`,
    JSON.stringify(
      {
        commit: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        takes,
        diagnostics,
      },
      null,
      2,
    ),
  );
  if (diagnostics.length) throw Error(JSON.stringify(diagnostics));
} finally {
  await browser.close();
}
