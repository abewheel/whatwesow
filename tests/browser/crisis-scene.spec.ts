import { test, expect, type Page } from "./fixtures";
import { clickCamera } from "./helpers";
import { answerCrisis, endTurn } from "../../src/game/crisis";
import { engine } from "../../src/crisis/engine";
import { presetState } from "../../src/dev/presets";
import { homesteadState, type GameState } from "../../src/game/state";
import { homesteadMicroState, type Plot } from "../../src/micro/state";
import { councilOffice } from "../../src/micro/world";

const homestead = (fields: Partial<GameState>): GameState => ({
  ...homesteadState(),
  ...fields,
});

// Set SCENE_SCREENSHOTS_DIR to keep a close picture of each crisis mark.
async function capture(page: Page, name: string, cells: string[]) {
  const dir = process.env.SCENE_SCREENSHOTS_DIR;
  if (!dir) return;
  while ((await page.locator("#zoom-level").textContent()) !== "200%")
    await clickCamera(page, "#zoom-in");
  await page.locator("#camera-controls summary").click();
  await page.locator(`[data-cell="${cells[0]}"]`).scrollIntoViewIfNeeded();
  // The playtest tools sit below the farm.
  await page.evaluate(() => window.scrollTo(0, 0));
  const boxes = await Promise.all(
    cells.map((cell) => page.locator(`[data-cell="${cell}"]`).boundingBox()),
  );
  const tile = boxes[0]!.width,
    left = Math.min(...boxes.map((b) => b!.x)) - tile / 3,
    top = Math.min(...boxes.map((b) => b!.y)) - tile * 1.2,
    right = Math.max(...boxes.map((b) => b!.x + b!.width)) + tile / 3,
    bottom = Math.max(...boxes.map((b) => b!.y + b!.height)) + tile / 2;
  await page.screenshot({
    path: `${dir}/scene-${name}.png`,
    clip: { x: left, y: top, width: right - left, height: bottom - top },
  });
  await clickCamera(page, "#zoom-reset");
  await page.locator("#camera-controls summary").click();
}
// Sample the rendered ground to compare ruined and untouched cells.
async function groundColor(page: Page, cell: string) {
  await page.locator(`[data-cell="${cell}"]`).scrollIntoViewIfNeeded();
  // The playtest tools sit below the farm.
  await page.evaluate(() => window.scrollTo(0, 0));
  // The scene draws only what is in view, so let it redraw after scrolling.
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  const box = (await page.locator(`[data-cell="${cell}"]`).boundingBox())!;
  const png = await page.screenshot({
    clip: {
      x: box.x + box.width / 2 - 8,
      y: box.y + box.height / 2 - 4,
      width: 16,
      height: 8,
    },
  });
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < pixels.length; i += 4)
      for (let c = 0; c < 3; c++) sum[c] += pixels[i + c];
    return sum.map((value) => value / (pixels.length / 4));
  }, png.toString("base64"));
}
async function applyGame(page: Page, state: GameState) {
  await page.getByLabel("Work on").selectOption("full");
  await page.getByLabel("Game state JSON").fill(JSON.stringify(state));
  // The status keeps its text between applies: clear it so the wait sees this one.
  await page.locator("#dev-status").evaluate((el) => (el.textContent = ""));
  await page.getByRole("button", { name: "Apply state", exact: true }).click();
  await expect(page.locator("#dev-status")).toHaveText(
    "State applied and saved.",
  );
}
async function open(page: Page, instance: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/?instance=validation-${instance}`);
  await expect(page.locator("#save-status")).toHaveText(
    "Saved on this browser",
  );
  return errors;
}
// The four corner cells of a council office lot standing at this cell, to frame it.
const lot = ({ row, col }: { row: number; col: number }) =>
  [0, councilOffice.height - 1].flatMap((dr) =>
    [0, councilOffice.width - 1].map((dc) => `${row + dr},${col + dc}`),
  );
// A summer drought answered with the first argument, as it is played.
const drought = { id: "Drought", turn: 6, pick: "D-LIB-P" };
const field = ["15,15", "15,17", "17,15", "17,17"];

test("dry crops turn yellow-brown and withered crops shrink after a drought", async ({
  page,
}) => {
  const errors = await open(page, "crisis-scene-crops");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-scene-dry", "0");
  const plots: Plot[] = [
    { crop: "corn", growth: 1 },
    { crop: "corn", growth: 1, dry: true },
    { crop: "corn", growth: 1, withered: true },
    { crop: "tomato", growth: 1, dry: true },
    { crop: "pumpkin", growth: 1, withered: true },
    { crop: "tomato", growth: 1 },
    { crop: "pumpkin", growth: 1 },
    null,
    { crop: "turnip", growth: 1 },
  ];
  await applyGame(
    page,
    homestead({ year: 2, season: "fall", plots, crises: [drought] }),
  );
  await expect(canvas).toHaveAttribute("data-scene-dry", "2");
  await expect(canvas).toHaveAttribute("data-scene-withered", "2");
  await expect(canvas).toHaveAttribute("data-scene-taken", "0");
  await capture(page, "crops", field);
  expect(errors).toEqual([]);
});

// Eminent domain at year 5 spring, answered so the county takes 4 edge plots at full price.
const takenFarm = () => {
  const fired = homestead({
    year: 5,
    season: "spring",
    plots: Array.from({ length: 9 }, (_, i) =>
      i % 2 ? null : { crop: "turnip", growth: 0 },
    ),
    crises: [
      drought,
      { id: "Blight", turn: 10, pick: "B-LIB-P", crop: "turnip" },
      { id: "Eminent domain", turn: 17 },
    ],
  });
  return answerCrisis(fired, "E-SOC").state;
};

test("seized land shows barren ruins in every season", async ({ page }) => {
  const errors = await open(page, "crisis-scene-taken");
  const state = takenFarm();
  const taken = state.crises!.at(-1)!.cells!;
  expect(taken).toHaveLength(4);
  const cells = [...field, ...taken.map((c) => `${c.row},${c.col}`)];
  for (const season of ["spring", "summer", "fall", "winter"] as const) {
    // Winter frost clears the field crops; the ruins stay.
    await applyGame(page, {
      ...state,
      season,
      plots: season === "winter" ? state.plots.map(() => null) : state.plots,
    });
    await expect(page.locator("[data-plot]")).toHaveCount(5);
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-scene-taken",
      "4",
    );
    for (const c of taken)
      await expect(
        page.locator(`[data-cell="${c.row},${c.col}"]`),
      ).toHaveAttribute("aria-label", /taken by the county$/);
    // Compare the ruined artwork with the same cell before seizure.
    const cell = `${taken[0].row},${taken[0].col}`;
    const ruined = await groundColor(page, cell);
    await capture(page, `taken-${season}`, cells);
    await applyGame(page, {
      ...state,
      season,
      crises: [],
      plots: season === "winter" ? state.plots.map(() => null) : state.plots,
    });
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-scene-taken",
      "0",
    );
    const untouched = await groundColor(page, cell);
    expect(
      Math.hypot(...ruined.map((value, c) => value - untouched[c])),
    ).toBeGreaterThan(8);
  }
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
])
  test.describe(`touch phone ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true });
    test("seized land shows ruins on a phone", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("requestfailed", (request) => errors.push(request.url()));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto("/?instance=validation-crisis-scene-taken-phone");
      await expect(page.locator("#save-status")).toHaveText(
        "Saved on this browser",
      );
      const state = takenFarm();
      await applyGame(page, state);
      await expect(page.locator("canvas")).toHaveAttribute(
        "data-scene-taken",
        "4",
      );
      const [first] = state.crises!.at(-1)!.cells!;
      await page
        .locator(`[data-cell="${first.row},${first.col}"]`)
        .scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(
        page.locator(`[data-cell="${first.row},${first.col}"]`),
      ).toBeInViewport();
      const dir = process.env.SCENE_SCREENSHOTS_DIR;
      if (dir)
        await page.screenshot({
          path: `${dir}/scene-taken-${viewport.width}x${viewport.height}.png`,
        });
      expect(errors).toEqual([]);
    });
  });

test("a sealed well fades to grey and the council office stands while permits are required", async ({
  page,
}) => {
  const errors = await open(page, "crisis-scene-council");
  const canvas = page.locator("canvas");
  // A farm policy stands in for the council here; the next test plays the answers.
  const state = (season: GameState["season"], permitsRequired: boolean) =>
    homestead({
      year: 4,
      season,
      structures: [
        ...homesteadMicroState().structures,
        { id: 2, kind: "well", level: 1, row: 15, col: 19 },
      ],
      nextStructureId: 3,
      farmPolicy: { sealedBuildings: ["well"], permitsRequired },
    });
  await applyGame(page, state("spring", false));
  await expect(canvas).toHaveAttribute("data-scene-sealed", "1");
  await expect(canvas).toHaveAttribute("data-scene-council", "");
  await expect(page.locator('[data-service="council"]')).toHaveCount(0);
  await capture(page, "sealed", ["15,19", "16,20", "17,17"]);
  await applyGame(page, state("spring", true));
  const office = lot(councilOffice);
  await page.locator(`[data-cell="${office[3]}"]`).scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute("data-scene-council", "7,9");
  await expect(page.locator('[data-service="council"]')).toHaveAttribute(
    "data-cell",
    "7,9",
  );
  await capture(page, "council", office);
  await applyGame(page, state("winter", true));
  await expect(canvas).toHaveAttribute("data-scene-council", "7,9");
  await capture(page, "council-winter", office);
  expect(errors).toEqual([]);
});

/** A control preset's crisis, fired at End turn and answered with Nora Delgado's argument. */
const answered = (preset: string, edit = (s: GameState) => s) => {
  const fired = endTurn(edit(presetState(preset))).state;
  const records = fired.crises!;
  const card = engine
    .hand(records.at(-1)!.id, records.length - 1)
    .find((c) => c.key === "PRO-M")!;
  return answerCrisis(fired, card.id).state;
};

test("the council's answers seal the farm's well and raise the council office", async ({
  page,
}) => {
  const errors = await open(page, "crisis-scene-answers");
  const canvas = page.locator("canvas");
  // Ada Kessler's first answer leaves the well open; the public water company Nora Delgado's
  // answer passes at the second drought seals it.
  await applyGame(
    page,
    answered("crisis-5-control", (s) => ({
      ...s,
      crises: s.crises!.map((r, i) => (i === 0 ? { ...r, pick: "D-OBJ" } : r)),
    })),
  );
  await expect(canvas).toHaveAttribute("data-scene-sealed", "1");
  await expect(page.locator('[data-cell="20,20"]')).toHaveAttribute(
    "aria-label",
    /sealed by the council$/,
  );
  await capture(page, "sealed-answer", ["20,20", "21,21", "17,17"]);
  // The county's set price brings planting permits, filed at the council office.
  await applyGame(page, answered("crisis-7-control"));
  const office = page.locator('[data-service="council"]');
  await expect(office).toHaveCount(1);
  const [row, col] = (await office.getAttribute("data-cell"))!
    .split(",")
    .map(Number);
  await expect(canvas).toHaveAttribute("data-scene-council", `${row},${col}`);
  await expect(canvas).toHaveAttribute("data-scene-taken", "6");
  await capture(page, "council-answer", lot({ row, col }));
  expect(errors).toEqual([]);
});
