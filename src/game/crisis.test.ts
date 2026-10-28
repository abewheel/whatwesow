import { afterEach, describe, expect, it, vi } from "vitest";
import { mix } from "../contracts/world";
import { content, engine } from "../crisis/engine";
import { maxCrises, seasons, turnNumber } from "../macro/state";
import { plantQuote, saleQuote } from "../micro/money";
import { actOnFarm, type FarmAction } from "../micro/rules";
import { crops, harvestValue, type CropId, type Plot } from "../micro/state";
import { buildingLevel } from "../micro/world";
import {
  answerCrisis,
  answerOffer,
  blightCrop,
  crisisDue,
  crisisYears,
  crisisPolicy,
  crisisRules,
  crisisTiming,
  endTurn,
  fireCrisis,
  mergePolicy,
  selectPlots,
  tileWorth,
  topCrop,
} from "./crisis";
import {
  assignedCrop,
  boardQuota,
  councilLedger,
  loanPayment,
  recoveryUntil,
  seasonCharges,
  waterInput,
  waterSupply,
} from "./crisis-rules";
import {
  actOnGame,
  advanceSeason,
  farmContext,
  homesteadState,
  parseState,
  replaceDomain,
  type GameState,
} from "./state";

const order = content.params.runOrder;
/** A homestead farm at a turn (9 empty plots, ids 1–9, 100 coins). */
function farmAt(turn: number, fields: Partial<GameState> = {}): GameState {
  return parseState({
    ...homesteadState(),
    year: Math.ceil(turn / 4),
    season: seasons[(turn - 1) % 4],
    ...fields,
  });
}
/** Plots with these crops first, empty after. */
const sown = (...list: [CropId, number][]): Plot[] =>
  Array.from({ length: 9 }, (_, i) =>
    list[i] ? { crop: list[i][0], growth: list[i][1] } : null,
  );
const card = (crisisId: string, key: string) =>
  content.cards.find((c) => c.crisis === crisisId && c.key === key)!.id;
// A schedule the timing table allows, one turn per crisis in run order.
// Fire turns for rule tests; fireCrisis and the rules do not check the schedule.
const fired = [6, 10, 14, 19, 26, 30, 34, 39];
/**
 * The council at crisis number n (0-based), just fired and unanswered. Earlier
 * crises were answered with "your rights" arguments, which pass each +80 policy.
 */
function councilAt(n: number, fields: Partial<GameState> = {}, crop = "corn") {
  return farmAt(fired[n], {
    ...fields,
    crises: order.slice(0, n + 1).map((id, k) => ({
      id,
      turn: fired[k],
      ...(k < n ? { pick: card(id, "OBJ") } : {}),
      ...(id === "Blight" || id === "Overproduction" ? { crop } : {}),
    })),
  });
}
const replay = engine.replay;
/** Make the council pass the policy at `pos` for crisis number k, whatever its window allows. */
function enact(forced: Record<number, number>) {
  vi.spyOn(engine, "replay").mockImplementation((picks, config) => {
    const state = replay(picks, config);
    state.ledger = state.ledger.map((r, k) => {
      if (forced[k] === undefined) return r;
      const policy = engine.policyAt(engine.crisisById[r.crisisId], forced[k]);
      const { decision } = engine.parsePick(picks[k]);
      return {
        ...r,
        enactedPos: forced[k],
        enactedName: policy.name,
        offer: policy.offer,
        accepted: policy.offer && decision ? decision === "accept" : null,
      };
    });
    return state;
  });
}
/** Answer crisis number n, passing the policy at `pos`. */
function pass(n: number, pos: number, fields: Partial<GameState> = {}) {
  enact({ [n]: pos });
  const state = councilAt(n, fields);
  return answerCrisis(state, card(order[n], "OBJ"));
}
const act = (state: GameState, action: FarmAction) =>
  replaceDomain(
    state,
    "micro",
    actOnFarm(state, action, farmContext(state)).state,
  );
afterEach(() => {
  vi.restoreAllMocks();
});

describe("when crises fire", () => {
  it("keeps the timing table as data", () => {
    expect(Object.keys(crisisTiming).sort()).toEqual(
      [...new Set(order)].sort(),
    );
    expect(crisisTiming.Drought).toEqual({
      seasons: ["summer"],
      drained: ["spring"],
    });
    expect(crisisTiming.Blight.seasons).toEqual(["summer"]);
    expect(crisisTiming["Eminent domain"].seasons).toEqual([
      "spring",
      "summer",
    ]);
    expect(crisisTiming.Overproduction.seasons).toEqual(["fall"]);
    expect(crisisTiming["Price crash"].seasons).toEqual(["summer"]);
    expect(maxCrises).toBe(order.length);
  });
  it("schedules one crisis every four years, from year 2 to year 30", () => {
    expect(crisisYears).toEqual([2, 6, 10, 14, 18, 22, 26, 30]);
    expect(crisisDue(farmAt(2))).toBeNull();
    expect(crisisDue(farmAt(5))).toBeNull();
    expect(crisisDue(farmAt(6))).toBe("Drought");
    expect(crisisDue(farmAt(7))).toBeNull();
    const after = (turn: number, last = 6) =>
      farmAt(turn, {
        crises: [{ id: "Drought", turn: last, pick: card("Drought", "OBJ") }],
      });
    // Blight is due in year 6, in summer: turn 22.
    expect(crisisDue(after(10))).toBeNull();
    expect(crisisDue(after(21))).toBeNull();
    expect(crisisDue(after(22))).toBe("Blight");
  });
  it("catches up one year apart when a save is behind schedule", () => {
    // A farm with no crises yet in year 25 gets the first at once, the next a year later.
    expect(crisisDue(farmAt(98))).toBe("Drought");
    const after = (turn: number) =>
      farmAt(turn, {
        crises: [{ id: "Drought", turn: 98, pick: card("Drought", "OBJ") }],
      });
    expect(crisisDue(after(98 + 2))).toBeNull();
    expect(crisisDue(after(98 + 4))).toBe("Blight");
  });
  it("lets the farm condition delay a crisis within its year, never past it", () => {
    const answered = order.slice(0, 2).map((id, k) => ({
      id,
      turn: [6, 22][k],
      pick: card(id, "OBJ"),
      ...(id === "Blight" ? { crop: "corn" } : {}),
    }));
    // Eminent domain is due in year 10 (spring 37, summer 38) and wants 6 plots.
    const small = (turn: number, plots = 5) =>
      farmAt(turn, {
        crises: answered,
        plots: Array(plots).fill(null),
        plotCells: homesteadState().plotCells.slice(0, plots),
        plotIds: homesteadState().plotIds.slice(0, plots),
      });
    expect(crisisDue(small(36, 6))).toBeNull();
    expect(crisisDue(small(37, 6))).toBe("Eminent domain");
    expect(crisisDue(small(37))).toBeNull();
    expect(crisisDue(small(38))).toBe("Eminent domain");
    // Overproduction is due in year 14, in fall: turn 55.
    const glut = (turn: number) =>
      farmAt(turn, {
        crises: order.slice(0, 3).map((id, k) => ({
          id,
          turn: [6, 22, 37][k],
          pick: card(id, "OBJ"),
          ...(id === "Blight" ? { crop: "corn" } : {}),
        })),
      });
    expect(crisisDue(glut(54))).toBeNull();
    expect(crisisDue(glut(55))).toBe("Overproduction");
  });
  it("fires nothing after year 30 or while a crisis waits for an answer", () => {
    const seven = order.slice(0, 7).map((id, k) => ({
      id,
      turn: [6, 22, 37, 55, 70, 86, 101][k],
      pick: card(id, "OBJ"),
      ...(id === "Blight" || id === "Overproduction" ? { crop: "corn" } : {}),
    }));
    // The last crisis is due in year 30, in fall: turn 119.
    expect(crisisDue(farmAt(119, { crises: seven }))).toBe("Overproduction");
    expect(crisisDue(farmAt(123, { crises: seven }))).toBeNull();
    expect(crisisDue(farmAt(121))).toBeNull();
    expect(crisisDue(councilAt(0, { year: 3 }))).toBeNull();
  });
  it("fires on End turn, blocks the next season until answered, then continues", () => {
    const spring = farmAt(5);
    expect(advanceSeason(spring).state.crises).toBeUndefined();
    const result = endTurn(spring);
    expect(turnNumber(result.state)).toBe(6);
    expect(result.state.crises).toEqual([{ id: "Drought", turn: 6 }]);
    expect(result.message).toMatch(/Crisis 1 of 8: Drought\.$/);
    expect(() => advanceSeason(result.state)).toThrow(
      "The council is waiting for your answer.",
    );
    expect(() => endTurn(result.state)).toThrow(/waiting/);
    expect(() => fireCrisis(result.state)).toThrow(/No crisis is due/);
    const answered = answerCrisis(
      result.state,
      engine.hand("Drought", 0)[0].id,
    ).state;
    expect(answered.crises![0].pick).toBe(engine.hand("Drought", 0)[0].id);
    const next = endTurn(answered);
    expect(turnNumber(next.state)).toBe(7);
    expect(next.state.crises).toHaveLength(1);
  });
  it("refuses farm actions while the council waits, and allows them once answered", () => {
    const waiting = councilAt(0, {
      coins: 1000,
      plots: sown(["turnip", 1], ["tomato", 0]),
      opportunities: ["shed"],
    });
    const actions: FarmAction[] = [
      { type: "plant", plot: 2, crop: "turnip" },
      { type: "harvest", plot: 0 },
      { type: "build", kind: "shed", cell: { row: 0, col: 0 } },
      { type: "expand" },
      { type: "buyWater" },
      { type: "sellWater" },
      { type: "filePermit" },
      { type: "lockPrice" },
      { type: "work" },
      { type: "upgrade", id: 1 },
      { type: "movePlot", id: 1, cell: { row: 0, col: 0 } },
      { type: "improve" },
    ];
    for (const action of actions)
      expect(() => actOnGame(waiting, action)).toThrow(
        "The council is waiting for your answer.",
      );
    const answered = answerCrisis(waiting, card("Drought", "OBJ")).state;
    const harvested = actOnGame(answered, { type: "harvest", plot: 0 });
    expect(harvested.message).toBe("Turnip harvested! +9 coins.");
    expect(harvested.state.crises).toEqual(answered.crises);
    expect(
      actOnGame(answered, { type: "plant", plot: 2, crop: "turnip" }).state
        .plots[2],
    ).toEqual({ crop: "turnip", growth: 0 });
  });
  it("plays all eight crises across a lifetime, the last in year 30", () => {
    let state = homesteadState();
    for (let turn = 1; turn < 160; turn++) {
      state = endTurn(state).state;
      const record = state.crises?.at(-1);
      if (record && !record.pick) {
        const n = state.crises!.length - 1;
        state = answerCrisis(state, engine.hand(record.id, n)[0].id).state;
        const entry = engine.replay(state.crises!.map((r) => r.pick!)).ledger;
        if (entry.at(-1)!.offer) state = answerOffer(state, false).state;
      }
    }
    expect(turnNumber(state)).toBe(160);
    expect(state.crises!.map((r) => r.id)).toEqual(order);
    // One every four years. The first card passes Drought +40, which drains the valley:
    // the second drought comes in spring.
    expect(state.crises!.map((r) => r.turn)).toEqual([
      6, 22, 37, 55, 69, 86, 101, 119,
    ]);
    expect(seasons[(69 - 1) % 4]).toBe("spring");
    expect(parseState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
});

describe("crisis triggers", () => {
  it("makes the fire turn a drought: unprotected thirsty crops dry to half yield", () => {
    const state = councilAt(0, {
      plots: sown(["tomato", 0], ["pumpkin", 0], ["turnip", 0]),
    });
    expect(farmContext(state).drought).toBe(true);
    expect(crisisPolicy(state, 6)).toEqual({});
    const after = advanceSeason(
      answerCrisis(state, card("Drought", "OBJ")).state,
    );
    expect(after.state.plots.slice(0, 3)).toEqual([
      { crop: "tomato", growth: 1, dry: true },
      { crop: "pumpkin", growth: 1, dry: true },
      { crop: "turnip", growth: 1 },
    ]);
    expect(after.message).toContain("Drought: 2 thirsty crops dried");
    expect(farmContext(after.state).drought).toBe(false);
  });
  it("comes in spring and lasts two seasons after an earlier policy drained the aquifer", () => {
    const before = (pos: number, turn: number) => {
      enact({ 0: pos });
      const state = councilAt(3, {}, "pumpkin");
      return farmAt(turn, {
        crises: state.crises!.map((r) => ({ ...r, pick: card(r.id, "OBJ") })),
      });
    };
    // Crisis 5 is due in year 18: spring is turn 69, summer 70.
    expect(crisisDue(before(80, 69))).toBeNull();
    expect(crisisDue(before(80, 70))).toBe("Drought");
    expect(crisisDue(before(40, 69))).toBe("Drought");
    expect(crisisDue(before(40, 70))).toBeNull();
    vi.restoreAllMocks();
    // Spring corn dries at the first season change, summer tomatoes at the second.
    enact({ 0: 40, 4: 80 });
    let state = fireCrisis({
      ...before(40, 69),
      coins: 1000,
      harvests: { ...homesteadState().harvests, turnip: 1, carrot: 1 },
    });
    expect(state.crises!.at(-1)).toEqual({ id: "Drought", turn: 69 });
    state = answerCrisis(state, card("Drought", "OBJ")).state;
    expect([69, 70, 71].map((t) => crisisRules(state, t).drought)).toEqual([
      true,
      true,
      false,
    ]);
    state = act(state, { type: "plant", plot: 0, crop: "corn" });
    let next = advanceSeason(state);
    expect(next.message).toContain("Drought: 1 thirsty crop dried");
    state = act(next.state, { type: "plant", plot: 1, crop: "tomato" });
    next = advanceSeason(state);
    expect(next.message).toContain("Drought: 1 thirsty crop dried");
    expect(next.state.plots.slice(0, 2)).toEqual([
      { crop: "corn", growth: 2, dry: true },
      { crop: "tomato", growth: 1, dry: true },
    ]);
    // The fall change into winter waters nothing.
    expect(farmContext(next.state).drought).toBe(false);
  });
  it("kills every plot of the most planted crop at a summer blight, keeping the plots", () => {
    const state = farmAt(22, {
      crises: [{ id: "Drought", turn: 6, pick: card("Drought", "OBJ") }],
      plots: sown(["turnip", 1], ["tomato", 0], ["tomato", 0]),
    });
    expect(crisisDue(state)).toBe("Blight");
    expect(blightCrop(state)).toBe("tomato");
    const next = fireCrisis(state);
    expect(next.crises![1]).toEqual({ id: "Blight", turn: 22, crop: "tomato" });
    expect(next.plots).toEqual(sown(["turnip", 1]));
    expect(next.plotIds).toEqual(state.plotIds);
    // Recovering through its next two planting seasons until answered otherwise:
    // this summer and next summer.
    expect(
      [22, 23, 25, 26, 27].map((t) => crisisPolicy(next, t).recoveringCrops),
    ).toEqual([["tomato"], ["tomato"], ["tomato"], ["tomato"], undefined]);
    expect(() =>
      actOnFarm(
        next,
        { type: "plant", plot: 1, crop: "tomato" },
        farmContext(next),
      ),
    ).toThrow("Tomato is still recovering from blight.");
  });
  it("counts blight recovery in the crop's own planting seasons", () => {
    // Fired in summer (turn 10): the blocked turns run through this many planting seasons.
    const until = (crop: CropId) =>
      [0, 1, 2].map((n) => recoveryUntil(crop, 10, n));
    // Corn is planted only in spring: the next two springs are turns 13 and 17.
    expect(until("corn")).toEqual([9, 13, 17]);
    // Tomato is planted in summer, so the fire season counts: this summer, then turn 14.
    expect(until("tomato")).toEqual([9, 10, 14]);
    // Turnip is planted in spring and summer: this summer, then spring 13.
    expect(until("turnip")).toEqual([9, 10, 13]);
    expect(recoveryUntil("corn", 13, 1)).toBe(13);
  });
  it("crashes every crop and fruit price to 60% for the summer and fall harvests", () => {
    const state = councilAt(5);
    expect(seasons[(30 - 1) % 4]).toBe("summer");
    const prices = crisisPolicy(state, 30).cropPrices!;
    for (const id of [...Object.keys(crops), "apple", "oak"])
      expect(prices[id]).toBe(0.6);
    expect(crisisPolicy(state, 31).cropPrices).toEqual(prices);
    expect(crisisPolicy(state, 32).cropPrices).toBeUndefined();
  });
  it("drops the top crop's price 25% for two seasons at overproduction", () => {
    const state = councilAt(3);
    expect(crisisPolicy(state, 19).cropPrices).toEqual({ corn: 0.75 });
    expect(crisisPolicy(state, 20).cropPrices).toEqual({ corn: 0.75 });
    expect(crisisPolicy(state, 21)).toEqual({
      waterTrade: { buy: 12, sell: 6 },
      premiumSeed: { seed: 1.5, yield: 1.3, failOneIn: 8 },
    });
  });
  it("chooses the top crop by planted value, then harvests, then turnip", () => {
    const turnips = (n: number): [CropId, number][] =>
      Array(n).fill(["turnip", 1]);
    const top = (...list: [CropId, number][]) =>
      topCrop(farmAt(23, { plots: sown(...list) }));
    // 3 × 9 beats 1 × 18; 2 × 9 ties it, and the higher harvest value wins.
    expect(top(...turnips(3), ["carrot", 0])).toBe("turnip");
    expect(top(...turnips(2), ["carrot", 0])).toBe("carrot");
    expect(
      blightCrop(farmAt(23, { plots: sown(...turnips(2), ["carrot", 0]) })),
    ).toBe("turnip");
    const harvests = { ...homesteadState().harvests, radish: 3, carrot: 3 };
    expect(topCrop(farmAt(23, { harvests }))).toBe("carrot");
    expect(blightCrop(farmAt(23, { harvests }))).toBe("carrot");
    expect(topCrop(farmAt(23))).toBe("turnip");
    expect(blightCrop(farmAt(23))).toBe("turnip");
  });
  it("leaves the farm alone at eminent domain until the council decides", () => {
    const state = councilAt(2);
    expect(crisisPolicy(state, 14)).toEqual(
      crisisPolicy({ ...state, crises: state.crises!.slice(0, 2) }, 14),
    );
    expect(state.plots).toHaveLength(9);
  });
});

describe("drought policies", () => {
  const thirsty = sown(["tomato", 0], ["pumpkin", 0]);
  it("+80 lets the player buy water to protect thirsty crops, or sell it", () => {
    const { state } = pass(0, 80, { plots: thirsty });
    expect(farmContext(state).policy.waterTrade).toEqual({ buy: 12, sell: 6 });
    const bought = act(state, { type: "buyWater" });
    expect(bought.coins).toBe(76);
    expect(advanceSeason(bought).state.plots[0]).toEqual({
      crop: "tomato",
      growth: 1,
    });
    const sold = act(state, { type: "sellWater" });
    expect(sold.coins).toBe(112);
    expect(advanceSeason(sold).state.plots[0]?.dry).toBe(true);
  });
  it("+80 water reaches only the crops growing when it is bought", () => {
    const { state } = pass(0, 80, { plots: sown(["tomato", 0]) });
    const bought = act(state, { type: "buyWater" });
    expect(bought.coins).toBe(88);
    expect(bought.water).toEqual({ turn: 6, choice: "bought", plots: [1] });
    expect(farmContext(bought).water).toMatchObject({
      bought: [1],
      thirsty: 1,
      drying: 0,
    });
    let later = bought;
    for (const plot of [1, 2, 3])
      later = act(later, { type: "plant", plot, crop: "pumpkin" });
    expect(farmContext(later).water).toMatchObject({ thirsty: 4, drying: 3 });
    const next = advanceSeason(later);
    expect(next.message).toContain("Drought: 3 thirsty crops dried");
    expect(next.state.plots[0]).toEqual({ crop: "tomato", growth: 1 });
    expect(next.state.plots.slice(1, 4).every((p) => p?.dry)).toBe(true);
    // Buying again pays only for the crops still without water.
    const topped = act(later, { type: "buyWater" });
    expect(later.coins - topped.coins).toBe(36);
    expect(topped.water).toEqual({
      turn: 6,
      choice: "bought",
      plots: [1, 2, 3, 4],
    });
    expect(advanceSeason(topped).message).not.toContain("Drought");
    expect(() => act(topped, { type: "sellWater" })).toThrow(
      /bought water this season/,
    );
  });
  it("selling water rights in a drought gives up a working well's water too", () => {
    enact({ 0: 80, 4: 40 });
    const thirsty = sown(["tomato", 0], ["pumpkin", 0]);
    const council = councilAt(4, {
      plots: thirsty,
      structures: [
        ...homesteadState().structures,
        { id: 2, kind: "well", row: 20, col: 20, level: 1 },
      ],
      nextStructureId: 3,
    });
    const state = answerCrisis(council, card("Drought", "OBJ")).state;
    expect(farmContext(state).water).toEqual({
      bought: [],
      sold: false,
      atCost: false,
      well: true,
      thirsty: 2,
      drying: 0,
      withering: 0,
    });
    expect(advanceSeason(state).message).not.toContain("Drought");
    const sold = act(state, { type: "sellWater" });
    expect(sold.coins).toBe(112);
    expect(farmContext(sold).water).toMatchObject({ sold: true, drying: 2 });
    const next = advanceSeason(sold);
    expect(next.message).toContain("Drought: 2 thirsty crops dried");
    expect(() => act(sold, { type: "sellWater" })).toThrow(/already sold/);
    expect(() => act(sold, { type: "buyWater" })).toThrow(/already sold/);
  });
  it("0 takes back the water rights, so water at cost cannot be sold away", () => {
    enact({ 0: 80, 4: 0 });
    const council = councilAt(4, { plots: thirsty });
    expect(farmContext(council).policy.waterTrade).toEqual({
      buy: 12,
      sell: 6,
    });
    const state = answerCrisis(council, card("Drought", "OBJ")).state;
    expect(farmContext(state).policy.waterTrade).toBeUndefined();
    expect(farmContext(state).water).toMatchObject({ atCost: true, drying: 0 });
    expect(() => act(state, { type: "sellWater" })).toThrow();
    const next = advanceSeason(state);
    expect(next.message).toContain("Water at cost: −2 coins.");
    expect(next.message).toContain("Water bill: −9 coins.");
    // Sold rights would give up water at cost and its charge.
    const rules = crisisRules(state, 26);
    expect(seasonCharges(state, rules, 0, true)).toEqual([["Water bill", 9]]);
    expect(
      waterInput(true, {
        ...waterSupply(state, rules, rules.policy, 26),
        sold: true,
      }).protectedFromDrought,
    ).toBe(false);
  });
  it("+40 unlocks wells, which water thirsty crops in a later drought", () => {
    const { state } = pass(0, 40, { coins: 1000 });
    expect(farmContext(state).policy).toMatchObject({
      unlockedBuildings: ["well"],
      droughtWells: true,
    });
    const built = act(state, {
      type: "build",
      kind: "well",
      cell: { row: 20, col: 20 },
    });
    expect(built.structures.at(-1)?.kind).toBe("well");
    // The second drought, with the well complete.
    enact({ 0: 40 });
    const later = councilAt(4, {
      structures: built.structures.map((s) => ({
        ...s,
        pendingConstruction: undefined,
      })),
      nextStructureId: built.nextStructureId,
      plots: thirsty,
    });
    const next = advanceSeason(
      answerCrisis(later, card("Drought", "OBJ")).state,
    ).state;
    expect(next.plots[0]?.dry).toBeUndefined();
  });
  it("0 sells water at cost this drought, sends a water bill every season and seals wells", () => {
    const { state } = pass(0, 0, { plots: thirsty });
    expect(farmContext(state).policy).toMatchObject({
      sealedBuildings: ["well"],
      blockedBuildings: ["well"],
    });
    expect(farmContext(state).policy.waterTrade).toBeUndefined();
    const first = advanceSeason(state);
    expect(first.state.plots[0]).toEqual({ crop: "tomato", growth: 1 });
    expect(first.state.coins).toBe(100 - 9 - 2);
    expect(first.message).toContain("Water bill: −9 coins.");
    expect(first.message).toContain("Water at cost: −2 coins.");
    const second = advanceSeason(first.state);
    expect(second.state.coins).toBe(89 - 9);
    expect(second.message).not.toContain("Water at cost");
  });
  it("−40 waters 60% of thirsty crops, taxes each one more, and the rest wither", () => {
    const plots = sown(
      ["tomato", 0],
      ["tomato", 0],
      ["tomato", 0],
      ["tomato", 0],
      ["tomato", 0],
      ["turnip", 0],
    );
    const { state } = pass(4, -40, { plots });
    expect(crisisRules(state, 26).irrigationCap).toBe(0.6);
    const next = advanceSeason(state);
    expect(next.state.plots.slice(0, 6)).toEqual([
      { crop: "tomato", growth: 1, dry: true },
      { crop: "tomato", growth: 1, dry: true },
      { crop: "tomato", growth: 1, dry: true },
      { crop: "tomato", growth: 0, withered: true },
      { crop: "tomato", growth: 0, withered: true },
      { crop: "turnip", growth: 1 },
    ]);
    expect(next.message).toContain("Water tax: −6 coins.");
    expect(next.state.coins).toBe(94);
    // About 60%, rounded: a lone thirsty crop still gets water.
    const lone = pass(4, -40, { plots: sown(["tomato", 0]) }).state;
    expect(farmContext(lone).water).toMatchObject({
      irrigationCap: 0.6,
      thirsty: 1,
      drying: 1,
      withering: 0,
    });
    expect(advanceSeason(lone).state.plots[0]).toEqual({
      crop: "tomato",
      growth: 1,
      dry: true,
    });
  });
  it("−80 caps water at 40%, seals the well and takes back water trading and wells", () => {
    const { state } = pass(4, -80);
    const policy = farmContext(state).policy;
    expect(crisisRules(state, 26).irrigationCap).toBe(0.4);
    expect(policy.waterTrade).toBeUndefined();
    expect(policy).toMatchObject({
      blockedBuildings: ["well"],
      sealedBuildings: ["well"],
    });
    enact({ 0: 40, 4: -80 });
    const wells = councilAt(4);
    const locked = answerCrisis(wells, card("Drought", "OBJ")).state;
    expect(farmContext(wells).policy.unlockedBuildings).toEqual(["well"]);
    expect(farmContext(locked).policy.unlockedBuildings).toBeUndefined();
    expect(farmContext(locked).policy.droughtWells).toBeUndefined();
  });
});

describe("blight policies", () => {
  // Corn blighted in summer (turn 10) waits for the springs at turns 13 and 17.
  const recovering = (state: GameState) =>
    [10, 13, 14, 17, 18].map(
      (turn) => crisisPolicy(state, turn).recoveringCrops,
    );
  it("+80 offers premium seed", () => {
    const { state } = pass(1, 80);
    expect(farmContext(state).policy.premiumSeed).toEqual({
      seed: 1.5,
      yield: 1.3,
      failOneIn: 8,
    });
    expect(recovering(state)).toEqual([
      ["corn"],
      ["corn"],
      ["corn"],
      ["corn"],
      undefined,
    ]);
  });
  it("+40 makes seed cost a quarter more, and nothing else", () => {
    const { state } = pass(1, 40);
    expect(crisisPolicy(state, 10)).toEqual({
      ...crisisPolicy(councilAt(1), 10),
      seedMultiplier: 1.25,
    });
    // Tomato seed: 9 coins, a quarter more, rounded up.
    expect(act(state, { type: "plant", plot: 0, crop: "tomato" }).coins).toBe(
      100 - 12,
    );
  });
  it("0 shortens recovery to one planting season and charges a planting fee", () => {
    const { state } = pass(1, 0);
    expect(recovering(state)).toEqual([
      ["corn"],
      ["corn"],
      undefined,
      undefined,
      undefined,
    ]);
    expect(crisisPolicy(state, 40)).toMatchObject({
      plantingFee: 2,
      seedMultiplier: 1.25,
      rotation: true,
      yieldMultiplier: 0.9,
      plantingFine: 3,
    });
    expect(crisisPolicy(state, 40).permitsRequired).toBeUndefined();
  });
  it("−40 lets you replant now but needs permits, rotation and fines after", () => {
    const { state } = pass(1, -40, { coins: 1000 });
    expect(recovering(state)).toEqual(Array(5).fill(undefined));
    expect(crisisPolicy(state, 10)).toMatchObject({
      plantingFee: 2,
      permitsRequired: true,
      rotation: true,
      seedMultiplier: 1.25,
      yieldMultiplier: 0.9,
      plantingFine: 3,
    });
    expect(state.permits).toEqual([10]);
    // Never cheaper than 0: 5 coins of seed and the 2-coin fee.
    const planted = act(state, { type: "plant", plot: 0, crop: "turnip" });
    expect(planted.coins).toBe(993);
    const fall = advanceSeason(planted).state;
    expect(fall.permits).toBeUndefined();
    const harvested = act(fall, { type: "harvest", plot: 0 });
    const spring = advanceSeason(advanceSeason(harvested).state).state;
    const fined = actOnFarm(
      spring,
      { type: "plant", plot: 0, crop: "turnip" },
      farmContext(spring),
    );
    expect(fined.message).toContain("Turnip grew here last");
    expect(fined.message).toContain("no planting permit this season");
    expect(fined.message).toContain("Fine −27 coins.");
  });
  it("−80 gives free seed for the assigned crop, with lower yields and fines", () => {
    const { state } = pass(1, -80);
    expect(crisisPolicy(state, 10)).toMatchObject({
      seedMultiplier: 0,
      assignedCrops: ["pumpkin"],
      yieldMultiplier: 0.8,
      plantingFine: 3,
    });
    expect(crisisPolicy(state, 11).assignedCrops).toBeUndefined();
    // Corn recovers through turn 17, so it is never the crop named.
    expect(assignedCrop(13)).toBe("corn");
    expect(crisisPolicy(state, 13).assignedCrops).toEqual(["radish"]);
    expect(crisisPolicy(state, 14).assignedCrops).toEqual(["turnip"]);
    // Year 5 names radish, which no rule blocks, so corn's recovery changes nothing.
    expect(crisisPolicy(state, 17).assignedCrops).toEqual(["radish"]);
    expect(crisisPolicy(state, 21).assignedCrops).toEqual(["turnip"]);
  });
});

describe("price crash policies", () => {
  it("+80 leaves the crash alone", () => {
    const { state } = pass(5, 80);
    expect(crisisPolicy(state, 30)).toEqual(crisisPolicy(councilAt(5), 30));
  });
  it("+40 offers a forward contract only while prices are down", () => {
    const { state } = pass(5, 40);
    expect(crisisPolicy(state, 30).forwardContract).toEqual({
      mult: 0.85,
      seasons: 4,
    });
    expect(crisisPolicy(state, 31).forwardContract).toBeDefined();
    expect(crisisPolicy(state, 32).forwardContract).toBeUndefined();
    expect(act(state, { type: "lockPrice" }).contract).toEqual({
      from: 30,
      until: 33,
      mult: 0.85,
    });
  });
  it("0 lends max(100, 20 × plots) and takes it back over four season changes", () => {
    const result = pass(5, 0);
    expect(result.state.crises![5].loan).toBe(180);
    expect(result.state.coins).toBe(280);
    expect(result.message).toContain("Loan: +180 coins");
    let state = result.state;
    const paid: number[] = [];
    for (let i = 0; i < 5; i++) {
      const before = state.coins;
      state = advanceSeason(state).state;
      paid.push(before - state.coins);
    }
    expect(paid).toEqual([45, 45, 45, 45, 0]);
  });
  it("−40 softens the crash to 90% and taxes every harvest after", () => {
    const { state } = pass(5, -40);
    expect(crisisPolicy(state, 30).cropPrices?.corn).toBe(0.9);
    expect(crisisPolicy(state, 32).cropPrices).toBeUndefined();
    expect(crisisPolicy(state, 80).harvestTax).toBe(0.1);
  });
  it("−80 freezes pre-crash prices, sells through a varying quota and raises seed prices", () => {
    const { state } = pass(5, -80, { soilLevel: 1 });
    const prices = state.crises![5].prices!;
    expect(prices).toEqual(
      Object.fromEntries(
        Object.entries(crops).map(([id, c]) => [id, c.sale + 3]),
      ),
    );
    const policy = crisisPolicy(state, 30);
    expect(policy).toMatchObject({
      fixedPrices: prices,
      priceCeiling: 1,
      seedMultiplier: 1.5,
      quota: boardQuota(state, 30),
    });
    expect(policy.cropPrices).toBeUndefined();
    expect(crisisPolicy(state, 31).quota).toBe(boardQuota(state, 31));
  });
});

describe("eminent domain policies", () => {
  const corn = sown(["corn", 1], ["corn", 1], ["corn", 1], ["corn", 1]);
  it("+80 takes nothing", () => {
    const { state } = pass(2, 80);
    expect(state.plots).toHaveLength(9);
    expect(state.crises![2].cells).toBeUndefined();
  });
  it("+40 offers to buy 4 edge plots at 120%, and waits for the answer", () => {
    const { state } = pass(2, 40);
    expect(state.plots).toHaveLength(9);
    expect(() => advanceSeason(state)).toThrow(/waiting/);
    enact({ 2: 40 });
    const declined = answerOffer(state, false);
    expect(declined.message).toBe("You said no to the deal.");
    expect(declined.state.plots).toHaveLength(9);
    expect(() => answerOffer(declined.state, true)).toThrow(/No deal/);
    const accepted = answerOffer(state, true);
    expect(accepted.state.plotIds).toEqual([1, 5, 7, 8, 9]);
    expect(accepted.state.coins).toBe(100 + 4 * Math.floor(1.2 * 30));
    expect(accepted.state.crises![2].pick).toBe("E-OBJ:accept");
    expect(crisisPolicy(accepted.state, 14).takenCells).toHaveLength(4);
    expect(() => advanceSeason(accepted.state)).not.toThrow();
  });
  it("0 takes 4 edge plots, crops included, at full worth", () => {
    const { state, message } = pass(2, 0, { plots: corn });
    expect(state.plotIds).toEqual([1, 5, 7, 8, 9]);
    expect(state.coins).toBe(100 + 64 + 64 + 30 + 64);
    expect(message).toContain("The county took 4 plots: +222 coins.");
    expect(state.crises![2].cells).toEqual([
      { row: 15, col: 17 },
      { row: 15, col: 16 },
      { row: 16, col: 17 },
      { row: 15, col: 15 },
    ]);
    expect(() =>
      act(state, { type: "expand", cell: { row: 15, col: 17 } }),
    ).toThrow(/unoccupied/);
  });
  it("−40 takes 6 random plots at half worth, delays building and plans planting", () => {
    const { state } = pass(2, -40, {
      coins: 1000,
      opportunities: ["shed"],
    });
    const taken = [...Array(9).keys()]
      .map((i) => i + 1)
      .sort((a, b) => mix(a, 14) - mix(b, 14))
      .slice(0, 6);
    expect(state.plotIds).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((id) => !taken.includes(id)),
    );
    expect(state.coins).toBe(1000 + 6 * 15);
    expect(crisisPolicy(state, 14)).toMatchObject({
      buildDelay: 1,
      permitsRequired: true,
      assignedCrops: ["turnip"],
      seedMultiplier: 0,
      plantingFine: 3,
    });
    // This season's permit comes with the policy.
    expect(state.permits).toEqual([14]);
    const built = act(state, {
      type: "build",
      kind: "shed",
      cell: { row: 0, col: 0 },
    });
    const once = advanceSeason(built).state;
    expect(once.structures.at(-1)?.pendingConstruction).toBe(true);
    expect(
      advanceSeason(once).state.structures.at(-1)?.pendingConstruction,
    ).toBeUndefined();
  });
  it("−80 takes the 8 best plots for nothing, caps buildings and plans planting", () => {
    const { state } = pass(2, -80, {
      plots: sown(["turnip", 1], ["corn", 1]),
      opportunities: ["shed"],
      coins: 1000,
    });
    expect(state.plotIds).toEqual([9]);
    expect(state.coins).toBe(1000);
    expect(crisisPolicy(state, 14)).toMatchObject({
      permitsRequired: true,
      assignedCrops: ["turnip"],
      seedMultiplier: 0,
      plantingFine: 3,
    });
    expect(state.permits).toEqual([14]);
    expect(state.crises![2].limits).toEqual({
      home: 1,
      shed: 0,
      well: 0,
      barn: 0,
      mill: 0,
      greenhouse: 0,
      market: 0,
      hall: 0,
    });
    expect(() =>
      act(state, { type: "build", kind: "shed", cell: { row: 0, col: 0 } }),
    ).toThrow(/limits this building/);
  });
});

describe("overproduction policies", () => {
  const glut = sown(
    ["corn", 2],
    ["corn", 2],
    ["corn", 2],
    ["corn", 2],
    ["corn", 2],
    ["corn", 2],
    ["corn", 2],
  );
  it("+80 leaves the glut price for two seasons", () => {
    const { state } = pass(3, 80);
    expect(crisisPolicy(state, 20).cropPrices).toEqual({ corn: 0.75 });
    expect(crisisPolicy(state, 21).cropPrices).toBeUndefined();
  });
  it("+40 offers a deal: taken, it lifts the price 15% and limits the crop to 5 plots", () => {
    const { state } = pass(3, 40);
    enact({ 3: 40 });
    const accepted = answerOffer(state, true).state;
    expect(crisisPolicy(accepted, 19)).toMatchObject({
      cropPrices: { corn: 1.15 },
      agreedCropLimits: { corn: 5 },
    });
    expect(crisisPolicy(accepted, 60).cropPrices).toEqual({ corn: 1.15 });
    const declined = answerOffer(state, false).state;
    expect(crisisPolicy(declined, 19).cropPrices).toEqual({ corn: 0.75 });
    expect(crisisPolicy(declined, 19).agreedCropLimits).toBeUndefined();
    expect(crisisPolicy(declined, 21).cropPrices).toBeUndefined();
  });
  it("0 charges a fee for each plot above 5 and holds back the excess sales", () => {
    const { state } = pass(3, 0, { plots: glut });
    expect(crisisPolicy(state, 19).sellDelay).toEqual({ corn: 5 });
    const held = act(state, { type: "harvest", plot: 0 });
    expect(held.coins).toBe(100);
    expect(held.held).toBe(Math.floor(34 * 0.75));
    const next = advanceSeason(held);
    expect(next.message).toContain("Fee on extra corn: −5 coins.");
    expect(next.state.coins).toBe(100 + 25 - 5);
  });
  it("−40 plows the top crop under past 5 plots, then limits it, keeps a fallow share, fixes prices and limits sales", () => {
    const { state, message } = pass(3, -40, { plots: glut });
    expect(state.plots.filter((p) => p?.crop === "corn")).toHaveLength(5);
    expect(state.plots[5]).toBeNull();
    expect(message).toContain("2 corn plots plowed under.");
    const prices = state.crises![3].prices!;
    expect(prices).toEqual(
      Object.fromEntries(Object.entries(crops).map(([id, c]) => [id, c.sale])),
    );
    expect(crisisPolicy(state, 19)).toMatchObject({
      cropLimits: { corn: 5 },
      fallowShare: 0.2,
      plantingFine: 3,
      quota: 5,
      fixedPrices: prices,
      priceCeiling: 1,
    });
    // A steady sales allowance; the glut still runs its two seasons.
    expect([19, 20, 21, 22].map((t) => crisisPolicy(state, t).quota)).toEqual([
      5, 5, 5, 5,
    ]);
    expect(crisisPolicy(state, 20).cropPrices).toEqual({ corn: 0.75 });
    expect(crisisPolicy(state, 21).cropPrices).toBeUndefined();
  });
  it("−80 destroys and bans the top crop, caps sales at the average, freezes upgrades and prices, and limits sales", () => {
    const { state } = pass(3, -80, { plots: glut });
    expect(state.plots.every((p) => p === null)).toBe(true);
    expect(crisisPolicy(state, 19)).toMatchObject({
      bannedCrops: ["corn"],
      averageCap: true,
      frozenUpgrades: true,
      plantingFine: 3,
      fixedPrices: state.crises![3].prices,
      priceCeiling: 1,
      cropPrices: { corn: 0.75 },
    });
    // The allowance changes every season.
    for (const turn of [19, 20, 21, 22])
      expect(crisisPolicy(state, turn).quota).toBe(boardQuota(state, turn));
  });
});

describe("policies passed twice", () => {
  /** Every crisis answered with these picks, both Overproductions on the given crops. */
  const answered = (picks: string[], crops: [string, string]) =>
    farmAt(39, {
      crises: order.map((id, k) => ({
        id,
        turn: fired[k],
        pick: picks[k],
        ...(id === "Blight" ? { crop: "corn" } : {}),
        ...(id === "Overproduction" ? { crop: crops[k === 3 ? 0 : 1] } : {}),
      })),
    });
  it("binds a deal taken at the second crisis after it was refused at the first", () => {
    const picks =
      "D-SOC B-OBJ E-LIB-M:decline O-OBJ:decline D-OBJ P-OBJ E-SOC:decline O-OBJ:accept".split(
        " ",
      );
    const ledger = engine.replay(picks).ledger;
    expect(
      [ledger[3], ledger[7]].map((r) => [r.enactedPos, r.accepted]),
    ).toEqual([
      [40, false],
      [40, true],
    ]);
    const state = answered(picks, ["corn", "corn"]);
    for (const turn of [39, 60])
      expect(crisisPolicy(state, turn)).toMatchObject({
        cropPrices: { corn: 1.15 },
        agreedCropLimits: { corn: 5 },
      });
  });
  it("applies a standing policy passed twice for the same crop once", () => {
    const picks =
      "D-LIB-P B-LIB-P E-LIB-P:accept O-PRO-M D-LIB-P P-LIB-P E-LIB-P:accept O-PRO-M".split(
        " ",
      );
    const ledger = engine.replay(picks).ledger;
    expect([ledger[3], ledger[7]].map((r) => r.enactedPos)).toEqual([0, 0]);
    const same = crisisRules(answered(picks, ["corn", "corn"]), 39);
    expect(same.cropFees).toEqual([{ crop: "corn", cap: 5 }]);
    expect(same.policy.sellDelay).toEqual({ corn: 5 });
    // A second crop gets its own fee and its own held sales.
    const two = crisisRules(answered(picks, ["corn", "pumpkin"]), 39);
    expect(two.cropFees).toEqual([
      { crop: "corn", cap: 5 },
      { crop: "pumpkin", cap: 5 },
    ]);
    expect(two.policy.sellDelay).toEqual({ corn: 5, pumpkin: 5 });
  });
});

describe("harms on policies that pass, with real answers", () => {
  // The real schedule. Every card here passes Drought +40 at crisis 1, which drains the
  // valley's water, so the second drought comes in spring.
  const schedule = [6, 22, 37, 55, 69, 86, 101, 119];
  /**
   * A farm at `turn` with the first `n` crises answered by the same neighbor (`key`), or
   * by `picks`, and no policy forced. Blight took corn; both overproductions, pumpkin.
   */
  const lived = (
    n: number,
    turn: number,
    picks: string | string[],
    fields: Partial<GameState> = {},
  ) =>
    farmAt(turn, {
      ...fields,
      crises: order.slice(0, n).map((id, k) => ({
        id,
        turn: schedule[k],
        pick: typeof picks === "string" ? card(id, picks) : picks[k],
        ...(id === "Blight"
          ? { crop: "corn" }
          : id === "Overproduction"
            ? { crop: "pumpkin" }
            : {}),
      })),
    });
  /** Crisis number n at its fire turn, earlier ones answered by `key`; then `key` answers it. */
  const steady = (n: number, key: string, fields: Partial<GameState> = {}) => {
    const waiting = lived(n, schedule[n], key, fields);
    const council = parseState({
      ...waiting,
      crises: [
        ...waiting.crises!,
        {
          id: order[n],
          turn: schedule[n],
          ...(order[n] === "Blight"
            ? { crop: "corn" }
            : order[n] === "Overproduction"
              ? { crop: "pumpkin" }
              : {}),
        },
      ],
    });
    return { council, ...answerCrisis(council, card(order[n], key)) };
  };
  const passed = (state: GameState) => councilLedger(state.crises).at(-1)!;
  const withWell: Partial<GameState> = {
    structures: [
      ...homesteadState().structures,
      { id: 2, kind: "well", row: 20, col: 20, level: 1 },
    ],
    nextStructureId: 3,
    plots: sown(["corn", 0], ["carrot", 0]),
  };

  it("Drought 0 seals a built well, takes back wells and water trading, and waters through a drained drought", () => {
    const { council, state, message } = steady(4, "PRO-M", withWell);
    expect(message).toBe("Passed: Public water company.");
    expect(passed(state).enactedPos).toBe(0);
    expect(farmContext(council).policy).toMatchObject({
      unlockedBuildings: ["well"],
      droughtWells: true,
    });
    const { policy } = farmContext(state);
    expect(policy).toMatchObject({
      sealedBuildings: ["well"],
      blockedBuildings: ["well"],
    });
    expect(policy.droughtWells).toBeUndefined();
    expect(policy.unlockedBuildings).toBeUndefined();
    expect(policy.waterTrade).toBeUndefined();
    expect(buildingLevel(state, "well", policy)).toBe(0);
    expect(harvestValue(state, "corn", policy)).toBe(
      harvestValue(state, "corn", farmContext(council).policy) - 1,
    );
    expect(() =>
      act(
        { ...state, coins: 1000 },
        { type: "build", kind: "well", cell: { row: 0, col: 0 } },
      ),
    ).toThrow();
    // Water at cost lasts both seasons of the drained drought.
    expect(
      [69, 70, 71].map((t) => {
        const rules = crisisRules(state, t);
        return [rules.drought, rules.waterAtCost];
      }),
    ).toEqual([
      [true, true],
      [true, true],
      [false, false],
    ]);
    const spring = advanceSeason(state);
    expect(spring.message).toContain("Water at cost: −1 coin.");
    const summer = advanceSeason(spring.state);
    expect(summer.message).toContain("Water at cost: −1 coin.");
    expect(summer.message).not.toContain("Drought:");
    // The sealed well no longer speeds the corn: it ripens a season later, never dried.
    expect(spring.state.plots[0]).toEqual({ crop: "corn", growth: 1 });
    expect(summer.state.plots[0]).toEqual({ crop: "corn", growth: 2 });
  });
  it("Drought −40 seals a built well and takes back wells and water trading", () => {
    const { state, message } = steady(4, "SOC", withWell);
    expect(message).toBe("Passed: Water board with a rising pumping tax.");
    const { policy } = farmContext(state);
    expect(policy).toMatchObject({
      sealedBuildings: ["well"],
      blockedBuildings: ["well"],
    });
    expect(policy.droughtWells).toBeUndefined();
    expect(policy.unlockedBuildings).toBeUndefined();
    expect(crisisRules(state, 69).irrigationCap).toBe(0.6);
  });
  it("Blight +40 makes seed cost a quarter more", () => {
    const { state, message } = steady(1, "LIB-P");
    expect(message).toBe(
      "Passed: Optional 'checked safe' label from seed sellers.",
    );
    expect(crisisPolicy(state, 22).seedMultiplier).toBe(1.25);
    expect(crisisPolicy(state, 140).seedMultiplier).toBe(1.25);
  });
  it("Blight 0 adds dearer, treated seed, crop rotation and its fine to the planting fee", () => {
    const { state, message } = steady(1, "PRO-M");
    expect(message).toBe("Passed: County seed checks, for a fee.");
    expect(crisisPolicy(state, 22)).toMatchObject({
      plantingFee: 2,
      seedMultiplier: 1.25,
      rotation: true,
      yieldMultiplier: 0.9,
      plantingFine: 3,
      recoveringCrops: ["corn"],
    });
    // Turnip: 5 coins of seed and the fee; it sells for 10% less.
    const planted = act(state, { type: "plant", plot: 0, crop: "turnip" });
    expect(planted.coins).toBe(100 - 7);
    const fall = advanceSeason(planted).state;
    const sold = actOnGame(fall, { type: "harvest", plot: 0 });
    expect(sold.message).toBe("Turnip harvested! +8 coins.");
    // Turnip again in the same plot next spring breaks rotation, for a fine.
    const spring = advanceSeason(advanceSeason(sold.state).state).state;
    expect(crisisPolicy(spring, 25).recoveringCrops).toEqual(["corn"]);
    const again = actOnFarm(
      spring,
      { type: "plant", plot: 0, crop: "turnip" },
      farmContext(spring),
    );
    expect(again.message).toBe(
      "Turnip planted. −7 coins, including a 2-coin planting fee. Planted against the rules (Turnip grew here last). Fine −27 coins.",
    );
    expect(act(spring, { type: "plant", plot: 1, crop: "turnip" }).coins).toBe(
      spring.coins - 7,
    );
  });
  it("Eminent domain −40 brings permits, the council office and the assigned crop with free seed", () => {
    const { state, message } = steady(6, "PRO-M");
    expect(message).toMatch(
      /^Passed: Take the land, pay a set price\. The county took 6 plots/,
    );
    expect(state.plots).toHaveLength(3);
    // The council office stands while permits are required; this season's comes with the policy.
    expect(crisisPolicy(state, 101)).toMatchObject({
      buildDelay: 1,
      permitsRequired: true,
      assignedCrops: ["turnip"],
      seedMultiplier: 0,
      plantingFine: 3,
    });
    expect(state.permits).toEqual([101]);
    // Free seed for the assigned crop; Blight 0's fee still applies.
    const turnip = actOnGame(state, { type: "plant", plot: 0, crop: "turnip" });
    expect(turnip.message).toBe(
      "Turnip planted. −2 coins, including a 2-coin planting fee.",
    );
    const radish = actOnGame(state, { type: "plant", plot: 0, crop: "radish" });
    expect(radish.message).toContain("only turnip may be planted");
    expect(radish.message).toContain("Fine −21 coins.");
    // Next season names another crop, and no permit was filed for it.
    const summer = advanceSeason(turnip.state).state;
    const { policy } = farmContext(summer);
    expect(policy.assignedCrops).toEqual(["tomato"]);
    expect(plantQuote(summer, "tomato", policy, 102, false, 1).reasons).toEqual(
      ["no planting permit this season"],
    );
  });
  it("Eminent domain −80 brings permits and the assigned crop with free seed", () => {
    const { state, message } = steady(6, "SOC");
    expect(message).toMatch(
      /^Passed: Take the best land for the common good, pay nothing\./,
    );
    expect(state.plots).toHaveLength(1);
    expect(crisisPolicy(state, 101)).toMatchObject({
      permitsRequired: true,
      assignedCrops: ["turnip"],
      seedMultiplier: 0,
      plantingFine: 3,
    });
    expect(state.permits).toEqual([101]);
  });
  it("Overproduction −40 fixes prices and sets a steady sales allowance, after the glut", () => {
    const fields = {
      plots: sown(
        ["pumpkin", 1],
        ["pumpkin", 1],
        ["pumpkin", 1],
        ["pumpkin", 1],
        ["pumpkin", 1],
        ["pumpkin", 1],
        ["pumpkin", 1],
        ["tomato", 1],
        ["tomato", 1],
      ),
    };
    const { state, message } = steady(7, "PRO-M", fields);
    expect(message).toBe(
      "Passed: Limits on how much you can plant. 2 pumpkin plots plowed under.",
    );
    const prices = state.crises![7].prices!;
    expect(prices).toEqual(
      Object.fromEntries(Object.entries(crops).map(([id, c]) => [id, c.sale])),
    );
    expect(crisisPolicy(state, 119)).toMatchObject({
      cropLimits: { pumpkin: 5 },
      fallowShare: 0.2,
      quota: 5,
      fixedPrices: prices,
      priceCeiling: 1,
      cropPrices: { pumpkin: 0.75 },
    });
    expect(crisisPolicy(state, 120).cropPrices).toEqual({ pumpkin: 0.75 });
    expect(crisisPolicy(state, 121).cropPrices).toBeUndefined();
    expect(
      [119, 120, 121, 122].map((t) => crisisPolicy(state, t).quota),
    ).toEqual([5, 5, 5, 5]);
    // Five sales count; the rest are taken for nothing.
    let farm = state;
    const messages: string[] = [];
    for (const plot of [0, 1, 2, 3, 4, 7, 8]) {
      const result = actOnGame(farm, { type: "harvest", plot });
      farm = result.state;
      messages.push(result.message);
    }
    expect(messages.slice(5)).toEqual([
      "Tomato harvested. Over this season's sales limit: taken for nothing.",
      "Tomato harvested. Over this season's sales limit: taken for nothing.",
    ]);
    expect(farm.harvests.tomato).toBe(state.harvests.tomato);
    // Once the glut passes, a better farm earns no more.
    const policy = crisisPolicy(state, 121);
    expect(
      saleQuote({ ...state, soilLevel: 2 }, "pumpkin", policy, 121).value,
    ).toBe(saleQuote(state, "pumpkin", policy, 121).value);
  });
  it("Overproduction −80 fixes prices and sets a sales allowance that changes every season", () => {
    const { state, message } = steady(7, "SOC");
    expect(message).toMatch(/^Passed: Ban the crop and even things out\./);
    expect(crisisPolicy(state, 119)).toMatchObject({
      bannedCrops: ["pumpkin"],
      fixedPrices: state.crises![7].prices,
      priceCeiling: 1,
    });
    for (const turn of [119, 120, 121, 122])
      expect(crisisPolicy(state, turn).quota).toBe(boardQuota(state, turn));
  });
  it("never names a banned or capped crop as the one to plant", () => {
    // Year 33 summer would name pumpkin, banned (SOC) or capped at 5 plots (PRO-M).
    expect(assignedCrop(130)).toBe("pumpkin");
    for (const key of ["SOC", "PRO-M"]) {
      const policy = crisisPolicy(lived(8, 130, key), 130);
      expect(policy.assignedCrops).toEqual(["turnip"]);
      expect([
        ...(policy.bannedCrops ?? []),
        ...Object.keys(policy.cropLimits ?? {}),
      ]).toEqual(["pumpkin"]);
    }
  });
  it("lets the assigned crop follow itself in a plot without breaking rotation", () => {
    // Nora Delgado every time, then Ada Kessler at the last crisis: Overproduction 0.
    const picks = [
      ...order.slice(0, 7).map((id) => card(id, "PRO-M")),
      card("Overproduction", "OBJ"),
    ];
    // Turnip is named in spring and summer of year 34.
    const spring = lived(8, 133, picks, { permits: [133, 134] });
    expect(
      councilLedger(spring.crises).map((entry) => entry.enactedPos),
    ).toEqual([40, 0, 0, 0, 0, -40, -40, 0]);
    expect(crisisPolicy(spring, 133).assignedCrops).toEqual(["turnip"]);
    expect(crisisPolicy(spring, 134)).toMatchObject({
      assignedCrops: ["turnip"],
      rotation: true,
    });
    const planted = act(spring, { type: "plant", plot: 0, crop: "turnip" });
    const summer = advanceSeason(planted).state;
    const harvested = act(summer, { type: "harvest", plot: 0 });
    const again = actOnFarm(
      harvested,
      { type: "plant", plot: 0, crop: "turnip" },
      farmContext(harvested),
    );
    expect(again.message).toBe(
      "Turnip planted. −2 coins, including a 2-coin planting fee.",
    );
    // Any other crop that grew there last still breaks rotation.
    expect(
      plantQuote(
        { ...harvested, lastCrops: { [harvested.plotIds[0]]: "tomato" } },
        "tomato",
        farmContext(harvested).policy,
        134,
        false,
        0,
      ).reasons,
    ).toEqual(["only turnip may be planted", "Tomato grew here last"]);
  });
});

describe("council money and land", () => {
  it("owes what a seasonal charge cannot cover and pays it from the next income", () => {
    const { state } = pass(0, 0, { coins: 3 });
    const short = advanceSeason(state);
    expect(short.state).toMatchObject({ coins: 0, owed: 6 });
    expect(short.message).toContain("6 added to what you owe.");
    const repaid = advanceSeason({ ...short.state, held: 20 });
    expect(repaid.state.owed).toBeUndefined();
    expect(repaid.state.coins).toBe(14 - 9);
    expect(repaid.message).toContain("6 paid toward what you owe.");
  });
  it("splits a loan into equal payments with the remainder last", () => {
    expect([0, 1, 2, 3, 4].map((k) => loanPayment(180, 4, k))).toEqual([
      45, 45, 45, 45, 0,
    ]);
    expect([0, 1, 2, 3].map((k) => loanPayment(101, 4, k))).toEqual([
      26, 26, 26, 23,
    ]);
    expect(loanPayment(101, 4, -1)).toBe(0);
  });
  it("varies the sales allowance deterministically by turn", () => {
    const farm = farmAt(37);
    const quotas = Array.from({ length: 40 }, (_, t) =>
      boardQuota(farm, t + 1),
    );
    expect(
      Array.from({ length: 40 }, (_, t) => boardQuota(farm, t + 1)),
    ).toEqual(quotas);
    expect(new Set(quotas)).toEqual(new Set([2, 3, 5, 6]));
    expect(quotas[0]).toBe(Math.floor(5 * [0.5, 0.75, 1, 1.25][mix(1, 7) % 4]));
    expect(boardQuota({ ...farm, plots: [] }, 1, false)).toBe(3);
    const empty = { ...farm, plots: [] };
    expect(Math.min(...quotas.map((_, t) => boardQuota(empty, t + 1)))).toBe(1);
  });
  it("assigns a crop by base sale, one further each year, skipping crops it must not name", () => {
    expect(assignedCrop(1)).toBe("radish");
    expect(assignedCrop(5)).toBe("turnip");
    expect(assignedCrop(2)).toBe("turnip");
    expect(assignedCrop(6)).toBe("tomato");
    expect(assignedCrop(3)).toBeUndefined();
    expect(assignedCrop(2, ["turnip"])).toBe("tomato");
    expect(assignedCrop(6, ["tomato"])).toBe("pumpkin");
    // Skipping every crop of the season names one anyway.
    expect(assignedCrop(2, ["turnip", "tomato", "pumpkin"])).toBe("turnip");
    expect(assignedCrop(3, ["turnip"])).toBeUndefined();
  });
  it("orders land by edge, by deterministic hash, and by productivity", () => {
    const farm = farmAt(17, {
      plots: sown(["corn", 1], ["turnip", 1], ["turnip", 0], ["carrot", 1]),
    });
    expect(selectPlots(farm, "edge", 4, 17)).toEqual([4, 3, 6, 2]);
    expect(selectPlots(farm, "random", 9, 17)).toEqual(
      [...farm.plotIds].sort((a, b) => mix(a, 17) - mix(b, 17)),
    );
    expect(selectPlots(farm, "random", 9, 18)).not.toEqual(
      selectPlots(farm, "random", 9, 17),
    );
    expect(selectPlots(farm, "mostProductive", 6, 17)).toEqual([
      1, 4, 2, 3, 5, 6,
    ]);
    expect(selectPlots(farm, "edge", 20, 17)).toHaveLength(9);
    expect(tileWorth(farm, 0)).toBe(30 + 34);
    expect(tileWorth(farm, 8)).toBe(30);
    expect(() => selectPlots(farm, "nearest", 1, 17)).toThrow(/selection/);
  });
  it("merges policies so every restriction holds", () => {
    expect(
      mergePolicy(
        {
          seedMultiplier: 2,
          cropPrices: { corn: 0.5 },
          cropLimits: { corn: 5 },
          bannedCrops: ["corn"],
          fixedPrices: { corn: 30 },
          takenCells: [{ row: 1, col: 1 }],
          rotation: false,
          allowWork: false,
          sellDelay: { corn: 5 },
        },
        {
          seedMultiplier: 1.5,
          cropPrices: { corn: 0.5, turnip: 2 },
          cropLimits: { corn: 3, turnip: 4 },
          bannedCrops: ["corn", "turnip"],
          fixedPrices: { corn: 40, carrot: 20 },
          takenCells: [
            { row: 1, col: 1 },
            { row: 2, col: 2 },
          ],
          rotation: true,
          allowWork: true,
          sellDelay: { corn: 3, pumpkin: 5 },
        },
      ),
    ).toEqual({
      seedMultiplier: 3,
      cropPrices: { corn: 0.25, turnip: 2 },
      cropLimits: { corn: 3, turnip: 4 },
      bannedCrops: ["corn", "turnip"],
      fixedPrices: { corn: 30, carrot: 20 },
      takenCells: [
        { row: 1, col: 1 },
        { row: 2, col: 2 },
      ],
      rotation: true,
      allowWork: false,
      sellDelay: { corn: 3, pumpkin: 5 },
    });
    expect(mergePolicy({ maxPlots: 12 }, {})).toEqual({ maxPlots: 12 });
  });
  it("only accepts cards from the hand, and only while the crisis waits", () => {
    const state = councilAt(0);
    expect(() => answerCrisis(state, card("Drought", "PRO-P"))).toThrow(
      /in your hand/,
    );
    expect(() => answerCrisis(state, card("Blight", "OBJ"))).toThrow(
      /in your hand/,
    );
    const answered = answerCrisis(state, card("Drought", "OBJ")).state;
    expect(() => answerCrisis(answered, card("Drought", "OBJ"))).toThrow(
      /No crisis/,
    );
    expect(() => answerOffer(answered, true)).toThrow(/No deal/);
  });
});
