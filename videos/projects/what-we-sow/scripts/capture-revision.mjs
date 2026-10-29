import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
const project = fileURLToPath(new URL("..", import.meta.url));
const out = `${project}/assets/local/v2`;
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
  await locator.waitFor({ state: "visible", timeout: 60000 });
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
  const setup = await open("setup", undefined, false);
  const states = await setup.page.evaluate(async () => {
    const { initialState, homesteadState, parseState } =
      await import("/src/game/state.ts");
    const { presetState } = await import("/src/dev/presets.ts");
    const { crops } = await import("/src/micro/state.ts");
    const { endTurn, answerCrisis } = await import("/src/game/crisis.ts");
    const dirty = initialState();
    dirty.farmerVariant = "male";
    dirty.debris = dirty.debris.filter(
      (d) => !(d.row >= 14 && d.row <= 22 && d.col >= 11 && d.col <= 22),
    );
    dirty.debris.push(
      { kind: "weeds", row: 16, col: 15 },
      { kind: "stones", row: 17, col: 17 },
      { kind: "boulder", row: 19, col: 14 },
      { kind: "log", row: 15, col: 18 },
    );
    function farm(stage) {
      const s = homesteadState();
      s.selfBuilt = true;
      s.farmerVariant = "male";
      s.debris = [];
      s.year = stage === "small" ? 2 : stage === "medium" ? 6 : 9;
      s.season = "summer";
      s.coins = stage === "small" ? 180 : stage === "medium" ? 2500 : 12000;
      s.seeds.turnip = 10;
      s.structures = [{ id: 1, kind: "home", row: 11, col: 14, level: 1 }];
      const cells = [];
      const block = (r, c, h, w) => {
        for (let y = r; y < r + h; y++)
          for (let x = c; x < c + w; x++) cells.push({ row: y, col: x });
      };
      if (stage === "small") block(16, 15, 3, 3);
      else {
        block(16, 12, 3, 9);
        s.structures.push(
          { id: 2, kind: "shed", row: 10, col: 7, level: 1 },
          { id: 3, kind: "coop", row: 10, col: 22, level: 1 },
          { id: 4, kind: "beehive", row: 20, col: 7, level: 1 },
        );
      }
      if (stage === "big") {
        block(22, 12, 3, 9);
        block(16, 28, 3, 3);
        block(16, 4, 3, 3);
        block(22, 4, 3, 3);
        s.structures.push(
          { id: 5, kind: "dairy", row: 20, col: 23, level: 1 },
          { id: 6, kind: "sheepfold", row: 26, col: 15, level: 1 },
          { id: 7, kind: "mill", row: 5, col: 15, level: 1 },
          { id: 8, kind: "greenhouse", row: 5, col: 23, level: 1 },
          { id: 9, kind: "market", row: 5, col: 7, level: 1 },
        );
      }
      s.plotCells = cells;
      s.plotIds = cells.map((_, i) => i + 1);
      s.nextPlotId = cells.length + 1;
      s.plots = cells.map((_, i) => {
        const crop = ["turnip", "carrot", "corn", "tomato", "pumpkin"][i % 5];
        return stage === "small" && [0, 8].includes(i)
          ? null
          : { crop, growth: stage === "small" ? 0 : crops[crop].steps };
      });
      s.nextStructureId = stage === "small" ? 2 : stage === "medium" ? 5 : 10;
      try {
        return parseState(s);
      } catch (e) {
        throw new Error(stage + ": " + e.message, { cause: e });
      }
    }
    const small = farm("small"),
      medium = farm("medium"),
      big = farm("big");
    const start = JSON.parse(JSON.stringify(big));
    const p = presetState("crisis-3");
    start.crises = p.crises;
    start.crises[0].pick = "D-LIB-P";
    start.crises[1].pick = "B-LIB-P";
    start.year = 9;
    start.season = "winter";
    start.plots = start.plots.map(() => null);
    const pending = endTurn(start).state;
    const taking = answerCrisis(pending, "E-PRO-M").state;
    const compensation =
      taking.coins - answerCrisis(pending, "E-OBJ").state.coins;
    const cells = taking.crises.at(-1).cells;
    return {
      dirty: parseState(dirty),
      small,
      medium,
      big,
      start: parseState(start),
      taken: cells,
      compensation,
      focus: {
        row: Math.round(cells.reduce((a, c) => a + c.row, 0) / cells.length),
        col: Math.round(cells.reduce((a, c) => a + c.col, 0) / cells.length),
      },
    };
  });
  await writeFile(
    `${out}/starting-saves.json`,
    JSON.stringify(states, null, 2),
  );
  await setup.finish();
  for (const [id, zoom] of [
    ["dirty", "200%"],
    ["small", "200%"],
    ["medium", "150%"],
  ]) {
    if (process.env.CAPTURE_FROM === "branches") continue;
    if (
      process.env.CAPTURE_FROM &&
      ["dirty", "small", "medium", "big"].indexOf(id) <
        ["dirty", "small", "medium", "big"].indexOf(process.env.CAPTURE_FROM)
    )
      continue;
    const t = await open(id);
    const p = t.page;
    await apply(p, states[id]);
    await frame(p, zoom, id === "big" ? 18 : 16, id === "big" ? 17 : 16);
    await p.screenshot({ path: `${out}/${id}.png` });
    t.mark("action");
    if (id === "dirty") {
      await click(p, p.locator('[data-cell="16,15"]'));
      await click(
        p,
        p.getByRole("button", { name: "Clear · Free", exact: true }),
      );
      await expect(p.locator("#farm-message")).toContainText("cleared", {
        timeout: 60000,
      });
      await p.keyboard.press("Escape");
      await click(p, p.locator('[data-cell="17,17"]'));
      await click(
        p,
        p.getByRole("button", { name: "Clear · 4 coins", exact: true }),
      );
      await expect(p.locator('[data-cell="17,17"]')).not.toHaveAttribute(
        "aria-label",
        /Loose stones/,
        { timeout: 60000 },
      );
      await p.keyboard.press("Escape");
    } else if (id === "small") {
      for (const i of [0, 8]) {
        await click(p, p.locator(`[data-plot="${i}"]`));
        await click(p, p.locator('[data-crop="turnip"]'));
        await expect(p.locator(`[data-plot="${i}"]`)).toHaveAttribute(
          "aria-label",
          /Turnip, growing/,
          { timeout: 60000 },
        );
        await p.keyboard.press("Escape");
      }
    } else {
      await harvest(p, id === "big" ? 57 : 0);
      await harvest(p, id === "big" ? 62 : 8);
    }
    t.mark("worked");
    await p.mouse.move(35, 1000, { steps: 5 });
    await p.waitForTimeout(500);
    t.mark("end");
    await t.finish();
  }
  for (const [id, pick, count] of [["rights", "E-OBJ", 81]]) {
    const t = await open(id);
    const p = t.page;
    await apply(p, states.start);
    await frame(p, "200%", states.focus.row, states.focus.col);
    t.mark("before");
    await click(p, home(p));
    await click(p, p.locator("#next-season"));
    await expect(p.locator("#crisis")).toBeVisible({ timeout: 60000 });
    t.mark("council");
    await p.mouse.move(35, 1000);
    await p.screenshot({ path: `${out}/${id}-council.png` });
    await p.waitForTimeout(1600);
    t.mark("choice-start");
    await click(p, p.locator(`#crisis [data-pick="${pick}"]`));
    t.mark("choice-done");
    await expect(
      p.getByRole("button", { name: "Back to the farm", exact: true }),
    ).toBeVisible();
    t.mark("result");
    await p.waitForTimeout(1800);
    await p.screenshot({ path: `${out}/${id}-policy.png` });
    t.mark("policy");
    await click(
      p,
      p.getByRole("button", { name: "Back to the farm", exact: true }),
    );
    await p.keyboard.press("Escape");
    await expect(p.locator("[data-plot]")).toHaveCount(count);
    await frame(p, "200%", states.focus.row, states.focus.col);
    await p.mouse.move(35, 1000);
    t.mark("after");
    await p.waitForTimeout(6500);
    await p.screenshot({ path: `${out}/${id}-after.png` });
    t.mark("end");
    await t.finish();
  }
  await writeFile(
    `${out}/capture.json`,
    JSON.stringify({ takes, diagnostics }, null, 2),
  );
  if (diagnostics.length) throw Error(JSON.stringify(diagnostics));
} finally {
  await browser.close();
}
