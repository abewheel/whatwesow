import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, copyFile, readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
const project = fileURLToPath(new URL("..", import.meta.url));
const out = `${project}/assets/local/v4`;
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
  // Filming presentation only: suppress constant tree nameplates, retain real art and actions.
  await page.route("**/src/game/scene.ts*", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    const anchor = body.indexOf("this.treeViews.set(s.id, tree)");
    const treeAdd = body.indexOf("scenery.add(tree)", anchor);
    const begin = body.indexOf(
      "scenery.add(",
      treeAdd + "scenery.add(tree)".length,
    );
    const end = body.indexOf("continue;", begin);
    if (
      anchor < 0 ||
      treeAdd < 0 ||
      begin < 0 ||
      end < 0 ||
      end - begin > 1500 ||
      !body.slice(begin, end).includes("item.name")
    )
      throw Error("Tree nameplate capture patch no longer matches");
    body = body.slice(0, begin) + body.slice(end);
    await route.fulfill({ response, body });
  });

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
  const t = await open("estate"),
    p = t.page;
  const seed = JSON.parse(
    await readFile(`${project}/fixtures/confiscation-seed.json`, "utf8"),
  );
  const estate = await p.evaluate(async (seed) => {
    const { parseState } = await import("/src/game/state.ts");
    const { crops } = await import("/src/micro/state.ts");
    const s = globalThis.structuredClone(seed);
    s.year = 24;
    s.season = "summer";
    s.crises = [];
    s.farmerVariant = "male";
    s.coins = 28000;
    s.debris = [];
    s.structures = [];
    let id = 1;
    const add = (kind, row, col, level = 1) =>
      s.structures.push({
        id: id++,
        kind,
        row,
        col,
        level,
        ...(kind === "oak" ? { age: 80, product: false } : {}),
      });
    add("home", 10, 17);
    add("market", 3, 8, 2);
    add("mill", 3, 17, 2);
    add("greenhouse", 3, 26, 2);
    add("shed", 10, 8, 2);
    add("greenhouse", 10, 26, 2);
    add("well", 10, 33, 2);
    add("beehive", 16, 34);
    add("beehive", 20, 34);
    add("sheepfold", 26, 7, 2);
    add("dairy", 26, 17, 2);
    add("coop", 26, 27, 2);
    add("barn", 34, 17, 2);
    for (const row of [3, 9, 15, 21, 27]) add("oak", row, 4);
    for (const [row, col] of [
      [3, 34],
      [7, 38],
      [13, 38],
      [19, 38],
      [25, 38],
      [31, 38],
    ])
      add("oak", row, col);
    const cells = [],
      plots = [];
    for (const [r, h] of [
      [16, 3],
      [21, 3],
    ])
      for (const [c, crop] of [
        [8, "turnip"],
        [14, "carrot"],
        [20, "tomato"],
        [26, "corn"],
      ])
        for (let y = r; y < r + h; y++)
          for (let x = c; x < c + 4; x++) {
            cells.push({ row: y, col: x });
            plots.push({ crop, growth: crops[crop].steps });
          }
    s.plotCells = cells;
    s.plots = plots;
    s.plotIds = cells.map((_, i) => i + 1);
    s.nextPlotId = cells.length + 1;
    s.nextStructureId = id;
    return parseState(s);
  }, seed);
  await mkdir(`${project}/fixtures`, { recursive: true });
  await writeFile(
    `${project}/fixtures/estate.json`,
    JSON.stringify(estate, null, 2),
  );
  await apply(p, estate);
  await frame(p, "100%", 20, 20);
  await p.evaluate(() => {
    const f = globalThis.document.querySelector("#farm"),
      c = globalThis.document.querySelector('[data-cell="20,20"]'),
      r = c.getBoundingClientRect(),
      b = f.getBoundingClientRect();
    f.scrollBy(0, r.y + r.height / 2 - (b.y + b.height * 0.65));
  });
  await p.waitForTimeout(650);
  await p.screenshot({ path: `${out}/estate.png` });
  t.mark("action");
  await harvest(p, 24);
  await harvest(p, 46);
  t.mark("worked");
  await p.mouse.move(5, 1050);
  await p.waitForTimeout(600);
  t.mark("end");
  await t.finish();
  await writeFile(
    `${out}/capture.json`,
    JSON.stringify({ diagnostics }, null, 2),
  );
  if (diagnostics.length) throw Error(JSON.stringify(diagnostics));
} finally {
  await browser.close();
}
