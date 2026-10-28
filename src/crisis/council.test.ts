import { describe, expect, it } from "vitest";
import { councilFacts } from "./council";
import { content } from "./engine";
import { homesteadMicroState, type CropId, type Plot } from "../micro/state";
import { seasons, type CrisisRecord } from "../macro/state";
import {
  advanceSeason,
  farmContext,
  homesteadState,
  parseState,
  type GameState,
} from "../game/state";

const sown = (...crops: CropId[]): Plot[] =>
  Array.from({ length: 9 }, (_, i) =>
    crops[i] ? { crop: crops[i], growth: 0 } : null,
  );
const card = (crisisId: string, key: string) =>
  content.cards.find((c) => c.crisis === crisisId && c.key === key)!.id;

/** A homestead farm at a turn: plots 1–9 sown with these crops, then empty. */
const farmAt = (
  turn: number,
  crises: CrisisRecord[],
  plots: Plot[],
  fields: Partial<GameState> = {},
) =>
  parseState({
    ...homesteadState(),
    year: Math.ceil(turn / 4),
    season: seasons[(turn - 1) % 4],
    crises,
    plots,
    ...fields,
  });
/** The farmhouse facts under the rules now, and what End turn then does. */
const outlook = (state: GameState) => ({
  council: councilFacts(state, farmContext(state)),
  next: advanceSeason(state),
});
const drySown = (...list: [CropId, number, boolean?][]): Plot[] =>
  Array.from({ length: 9 }, (_, i) =>
    list[i]
      ? {
          crop: list[i][0],
          growth: list[i][1],
          ...(list[i][2] ? { dry: true as const } : {}),
        }
      : null,
  );
// Real answers, replayed by the engine: no policy is forced.
const records = (picks: string[], turns: number[]): CrisisRecord[] =>
  picks.map((pick, k) => ({
    id: content.params.runOrder[k],
    turn: turns[k],
    pick,
    ...(k === 1 ? { crop: "corn" } : k === 3 ? { crop: "pumpkin" } : {}),
  }));
/** Crisis 1 passes the wells (+40) or the water trade (+80). */
const wells = records(["D-LIB-P"], [6]),
  trade = records(["D-OBJ"], [6]);
/** Crisis 5 passes the wells again (+40), the public water company (0) or the water board (−40). */
const pumping = (turn: number) =>
  records(
    ["D-LIB-P", "B-LIB-P", "E-LIB-P:accept", "O-LIB-P:accept", "D-LIB-P"],
    [6, 10, 14, 19, turn],
  );
const atCost = (turn: number) =>
  records(
    ["D-LIB-P", "B-LIB-P", "E-LIB-P:accept", "O-LIB-P:accept", "D-PRO-M"],
    [6, 10, 14, 19, turn],
  );
const board = records(
  ["D-LIB-P", "B-SOC", "E-SOC", "O-SOC", "D-PRO-M"],
  [6, 10, 14, 19, 26],
);
const three = drySown(["tomato", 0], ["pumpkin", 0], ["corn", 1]);

describe("council rules in the farmhouse", () => {
  it("prices the drought water trade by the thirsty crops bought water does not reach", () => {
    const farm = {
      ...homesteadMicroState(),
      plots: sown("corn", "corn", "tomato", "turnip"),
    };
    const council = councilFacts(farm, {
      turn: 6,
      drought: true,
      policy: { waterTrade: { buy: 12, sell: 6 } },
    });
    expect(council.water).toEqual({
      thirsty: 3,
      unwatered: 3,
      buy: 36,
      sell: 18,
      traded: undefined,
      covered: false,
    });
    // Without the season's water outlook, no drought fact is guessed.
    expect(council.facts).toEqual([]);
    // Outside a drought the trade is a standing right, not a button.
    const later = councilFacts(farm, {
      turn: 7,
      policy: { waterTrade: { buy: 12, sell: 6 } },
    });
    expect(later.water).toBeUndefined();
    expect(later.facts).toContain(
      "In a drought you can buy water at 12 coins or sell your rights at 6 per thirsty crop.",
    );
    const partly = councilFacts(
      { ...farm, water: { turn: 6, choice: "bought", plots: [1] } },
      { turn: 6, drought: true, policy: { waterTrade: { buy: 12, sell: 6 } } },
    );
    expect(partly.water).toMatchObject({ unwatered: 2, buy: 24, sell: 18 });
    expect(partly.water?.traded).toBe("bought");
    const traded = councilFacts(
      { ...farm, water: { turn: 6, choice: "sold" } },
      { turn: 6, drought: true, policy: { waterTrade: { buy: 12, sell: 6 } } },
    );
    expect(traded.water?.traded).toBe("sold");
  });
  it("states what a drought does to unprotected crops, and what End turn then does", () => {
    const plain = outlook(farmAt(6, wells, three));
    expect(plain.council.facts[0]).toBe(
      "Drought this season: 3 thirsty crops will dry to half yield.",
    );
    expect(plain.next.message).toContain("Drought: 3 thirsty crops dried");
    const none = outlook(farmAt(6, wells, drySown(["turnip", 0])));
    expect(none.council.facts[0]).toBe(
      "Drought this season: no thirsty crops are growing.",
    );
    // The second season of a long drought: the corn that dried in spring stays dry.
    const long = outlook(
      farmAt(26, pumping(25), drySown(["corn", 1, true], ["tomato", 0])),
    );
    expect(long.council.facts[0]).toBe(
      "Drought this season: 1 thirsty crop will dry to half yield; 1 other already dried.",
    );
    expect(long.next.message).toContain("Drought: 1 thirsty crop dried");
    // Water at cost lasts the whole drought, its second season too.
    const covered = outlook(
      farmAt(26, atCost(25), drySown(["corn", 1, true], ["tomato", 0])),
    );
    expect(covered.council.facts[0]).toBe(
      "Drought this season: your 2 thirsty crops are watered, 1 coin each at End turn.",
    );
    expect(covered.next.message).not.toContain("Drought:");
    expect(covered.next.message).toContain("Water at cost: −2 coins.");
  });
  it("states bought, partly bought and sold water truthfully", () => {
    const unwatered = outlook(farmAt(6, trade, three));
    expect(unwatered.council.facts[0]).toBe(
      "Drought this season: 3 thirsty crops will dry to half yield unless you buy water.",
    );
    const some = farmAt(6, trade, three, {
      water: { turn: 6, choice: "bought", plots: [1, 2] },
    });
    const partly = outlook(some);
    expect(partly.council.facts[0]).toBe(
      "Drought this season: the water you bought keeps 2 thirsty crops from drying; 1 other will dry to half yield unless you buy water.",
    );
    expect(partly.council.water).toMatchObject({ unwatered: 1, buy: 12 });
    expect(partly.next.message).toContain("Drought: 1 thirsty crop dried");
    const all = outlook(
      farmAt(6, trade, three, {
        water: { turn: 6, choice: "bought", plots: [1, 2, 3] },
      }),
    );
    expect(all.council.facts[0]).toBe(
      "Drought this season: the water you bought keeps 3 thirsty crops from drying.",
    );
    expect(all.council.water).toMatchObject({ unwatered: 0, buy: 0 });
    expect(all.next.message).not.toContain("Drought");
    const sold = outlook(
      farmAt(6, trade, three, { water: { turn: 6, choice: "sold" } }),
    );
    expect(sold.council.facts[0]).toBe(
      "Drought this season: you sold your water, so 3 thirsty crops will dry to half yield.",
    );
    expect(sold.next.message).toContain("Drought: 3 thirsty crops dried");
  });
  it("states a working well and water at cost as watering every thirsty crop", () => {
    const well = outlook(
      farmAt(6, wells, three, {
        structures: [
          ...homesteadState().structures,
          { id: 2, kind: "well", row: 20, col: 20, level: 1 },
        ],
        nextStructureId: 3,
      }),
    );
    expect(well.council.facts[0]).toBe(
      "Drought this season: your well waters your 3 thirsty crops.",
    );
    expect(well.next.message).not.toContain("Drought");
    expect(well.council.facts).toContain(
      "A working well waters your thirsty crops in a drought.",
    );
    // With water rights too, selling them gives up the well's water.
    expect(
      councilFacts(farmAt(6, wells, three), {
        ...farmContext(farmAt(6, wells, three)),
        policy: { droughtWells: true, waterTrade: { buy: 12, sell: 6 } },
      }).facts,
    ).toContain(
      "A working well waters your thirsty crops in a drought, unless you sell your water rights.",
    );
    const company = outlook(farmAt(26, atCost(26), three));
    expect(company.council.facts[0]).toBe(
      "Drought this season: your 3 thirsty crops are watered, 1 coin each at End turn.",
    );
    expect(company.council.water).toBeUndefined();
    expect(company.next.message).not.toContain("Drought:");
    expect(company.next.message).toContain("Water at cost: −3 coins.");
  });
  it("states the water board's limit in its real numbers, in a drought and after", () => {
    const five = drySown(
      ["tomato", 0],
      ["tomato", 0],
      ["tomato", 0],
      ["tomato", 0],
      ["tomato", 0],
    );
    const drought = outlook(farmAt(26, board, five));
    expect(drought.council.facts[0]).toBe(
      "Drought this season: 3 of your 5 thirsty crops get water, but only enough to survive at half yield; the other 2 wither.",
    );
    expect(drought.next.message).toContain("Drought: 3 thirsty crops dried");
    expect(drought.next.message).toContain("2 thirsty crops withered");
    // The limit stands after the drought: the next spring's corn.
    const corn = drySown(
      ["corn", 0],
      ["corn", 0],
      ["corn", 0],
      ["corn", 0],
      ["corn", 0],
    );
    const spring = outlook(farmAt(29, board, corn));
    expect(spring.council.facts[0]).toBe(
      "Water limit: only 3 of your 5 thirsty crops get water at End turn; the other 2 wither.",
    );
    expect(spring.next.message).not.toContain("Drought");
    expect(spring.next.message).toContain("2 thirsty crops withered");
    const lone = outlook(farmAt(29, board, drySown(["corn", 0], ["corn", 0])));
    expect(lone.council.facts[0]).toBe(
      "Water limit: only 1 of your 2 thirsty crops gets water at End turn; the other one withers.",
    );
  });
  it("offers a price lock until one is signed, then states its term", () => {
    const farm = homesteadMicroState();
    const policy = { forwardContract: { mult: 0.85, seasons: 4 } };
    expect(councilFacts(farm, { turn: 37, policy }).lock).toEqual({
      label: "Lock in 85% for 4 seasons",
    });
    // The game ends at turn 160, so the lock cannot outlast it.
    expect(councilFacts(farm, { turn: 159, policy }).lock?.label).toBe(
      "Lock in 85% for 2 seasons",
    );
    const locked = councilFacts(
      { ...farm, contract: { from: 37, until: 40, mult: 0.85 } },
      { turn: 38, policy },
    );
    expect(locked.lock).toBeUndefined();
    expect(locked.facts).toContain(
      "Price locked at 85% through year 10 winter.",
    );
  });
  it("states debts, held sales, the sales limit, permits and the crop you may plant", () => {
    const farm = {
      ...homesteadMicroState(),
      owed: 25,
      held: 40,
      permits: [12],
      seasonSales: { turn: 11, count: 2 },
    };
    const { facts } = councilFacts(farm, {
      turn: 11,
      policy: {
        quota: 4,
        permitsRequired: true,
        assignedCrops: ["tomato"],
        recoveringCrops: ["corn"],
        cropPrices: { pumpkin: 0.75 },
      },
    });
    expect(facts).toEqual([
      "You owe 25 coins. Income pays it first.",
      "Held sales: 40 coins, paid next season.",
      "Sales allowed: 2 of 4 this season.",
      "Planting permit: none this season; next season's is filed.",
      "Crop you may plant this season: Tomato.",
      "Recovering from blight: Corn. It cannot be planted yet.",
      "Sale prices: Pumpkin 75%.",
    ]);
    const crash = Object.fromEntries(
      ["turnip", "carrot", "corn", "radish", "tomato", "pumpkin", "apple"].map(
        (id) => [id, 0.6],
      ),
    );
    expect(
      councilFacts(homesteadMicroState(), {
        turn: 37,
        policy: { cropPrices: crash },
      }).facts,
    ).toEqual(["Sale prices: everything at 60%."]);
    // Fixed prices cap a deal's price at 100%, so the farmhouse does not list it.
    expect(
      councilFacts(homesteadMicroState(), {
        turn: 122,
        policy: {
          cropPrices: { pumpkin: 1.15, corn: 0.75 },
          fixedPrices: { pumpkin: 32, corn: 34 },
          priceCeiling: 1,
        },
      }).facts,
    ).toEqual(["Sale prices: Corn 75%."]);
    // A signed lock replaces those prices while it runs.
    expect(
      councilFacts(
        {
          ...homesteadMicroState(),
          contract: { from: 37, until: 40, mult: 0.85 },
        },
        { turn: 38, policy: { cropPrices: crash } },
      ).facts,
    ).toEqual(["Price locked at 85% through year 10 winter."]);
  });
  it("lists the standing rules of every answered crisis in the council's words", () => {
    const answered: CrisisRecord[] = [
      { id: "Drought", turn: 6, pick: card("Drought", "SOC") },
      { id: "Blight", turn: 13, crop: "corn", pick: card("Blight", "SOC") },
    ];
    const rules = (crises: CrisisRecord[]) =>
      councilFacts(
        { ...homesteadMicroState(), crises },
        { turn: 13, policy: {} },
      ).standing.map((rule) => `${rule.policy}: ${rule.text}`);
    expect(rules(answered)).toEqual([
      "You pay the county to check seed: You pay a fee every time you plant. Checked seed costs about a quarter more. It is treated to stop the disease, so you harvest 10% less. To keep the disease out of the soil, you can't plant the same crop twice in a row on one plot. If you break that rule, you pay a fine.",
    ]);
    // A crisis still waiting for its answer has passed no rule yet.
    expect(rules([answered[0], { ...answered[1], pick: undefined }])).toEqual(
      [],
    );
    expect(
      councilFacts(homesteadMicroState(), { turn: 1, policy: {} }),
    ).toEqual({ facts: [], standing: [], water: undefined, lock: undefined });
  });
});
