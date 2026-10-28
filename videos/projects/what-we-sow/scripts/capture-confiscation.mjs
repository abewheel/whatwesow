import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, copyFile, readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
const project = fileURLToPath(new URL("..", import.meta.url));
const out = `${project}/assets/local/v3`;
const base = process.env.FILM_URL ?? "http://127.0.0.1:5174/";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const diagnostics = [];
const takes = {};
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
  await page.goto(`${base}?instance=validation-film-v2-${id}`);
  await page.getByRole("button", { name: "Male farmer", exact: true }).click();
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
async function frame(page, zoom, row = 16, col = 16) {
  await camera(page, zoom);
  await page.evaluate(
    ({ row, col }) => {
      const farm = globalThis.document.querySelector("#farm"),
        c = globalThis.document.querySelector(`[data-cell="${row},${col}"]`),
        r = c.getBoundingClientRect(),
        f = farm.getBoundingClientRect();
      farm.scrollBy(
        r.x + r.width / 2 - (f.x + f.width * 0.5),
        r.y + r.height / 2 - (f.y + f.height * 0.63),
      );
    },
    { row, col },
  );
}
async function harvest(page, index) {
  await page.keyboard.press("Escape");
  await click(page, page.locator(`[data-plot="${index}"]`));
  await click(
    page,
    page.getByRole("button", { name: "Harvest crop", exact: true }),
  );
  await expect(page.locator(`[data-plot="${index}"]`)).toHaveAttribute(
    "aria-label",
    /empty/,
    { timeout: 60000 },
  );
  await page.keyboard.press("Escape");
}
try {
  const t = await open("confiscation", undefined, false),
    p = t.page;
  const saves = JSON.parse(
    await readFile(`${project}/fixtures/confiscation-seed.json`, "utf8"),
  );
  const states = await p.evaluate(async (base) => {
    const { parseState } = await import("/src/game/state.ts");
    const { crops } = await import("/src/micro/state.ts");
    const { endTurn, answerCrisis } = await import("/src/game/crisis.ts");
    const s = globalThis.structuredClone(base);
    s.structures = [{ id: 1, kind: "home", row: 7, col: 8, level: 1 }];
    s.nextStructureId = 2;
    const cells = [];
    for (let row = 0; row < 64; row++)
      for (let col = 24; col < 64; col++) cells.push({ row, col });
    s.plotCells = cells;
    s.plotIds = cells.map((_, i) => i + 1);
    s.nextPlotId = 2561;
    s.plots = cells.map((_, i) => {
      const crop = ["turnip", "carrot", "corn", "tomato", "pumpkin"][i % 5];
      return { crop, growth: crops[crop].steps };
    });
    const pending = endTurn(parseState(s)).state;
    const before = answerCrisis(pending, "E-OBJ").state;
    // Explicit cinematic fixture requested for the film. No production rule changes.
    const after = globalThis.structuredClone(before);
    const taken = cells.filter((c) => c.row >= 12 && c.row < 32 && c.col >= 44);
    const key = (c) => `${c.row},${c.col}`,
      set = new Set(taken.map(key));
    const keep = before.plotCells
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !set.has(key(c)));
    after.plotCells = keep.map((x) => x.c);
    after.plotIds = keep.map((x) => before.plotIds[x.i]);
    after.plots = keep.map((x) => before.plots[x.i]);
    after.crises.at(-1).pick = "E-PRO-M";
    after.crises.at(-1).cells = taken;
    return {
      before: parseState(before),
      after: parseState(after),
      taken,
      fixture:
        "Cinematic scale demonstration: 2560 fields, 400-field square at the property boundary removed; live crisis still takes four.",
    };
  }, saves);
  await writeFile(
    `${out}/confiscation-saves.json`,
    JSON.stringify(states, null, 2),
  );
  for (const id of ["before", "after"]) {
    await apply(p, states[id]);
    await frame(p, "100%", 30, 47);
    await p.mouse.move(5, 1050);
    await p.waitForTimeout(700);
    await expect(p.locator("[data-plot]")).toHaveCount(
      id === "before" ? 2560 : 2160,
    );
    await p.screenshot({ path: `${out}/confiscation-${id}.png` });
  }
  // Keep the farmer's working animation available for the next footage capture.
  await apply(p, states.before);
  await frame(p, "100%", 30, 47);
  await harvest(p, 300);
  await click(p, home(p));
  await t.context.close();
  await writeFile(
    `${out}/capture.json`,
    JSON.stringify({ diagnostics, fixture: states.fixture }, null, 2),
  );
  if (diagnostics.length) throw Error(JSON.stringify(diagnostics));
} finally {
  await browser.close();
}
