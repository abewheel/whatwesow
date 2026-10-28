import {
  canBuild,
  canPlant as cropUnlocked,
  hasOpportunity,
  opportunities,
  upgradeHarvests,
  upgradeRemaining,
  upgradeHint,
  type Opportunity,
} from "./progression";
import { WORLD_CELLS, mix } from "../contracts/world";
import { parseFarmPolicy, type FarmPolicy } from "../contracts/farm-policy";
import {
  buildings,
  constructionCost,
  isTree,
  isProducer,
  buildingProducts,
  treeProduct,
  buildingLevel,
  canPlace,
  WORLD_SIZE,
  occupiedCells,
  serviceOptions,
  cellKey,
  upgradeCost,
  cellAllowed,
  policyCost,
  type Cell,
  type BuildingKind,
} from "./world";
import {
  crops,
  canPlant,
  expansionCost,
  parseMicroState,
  soilCost,
  thirstyPlots,
  type CropId,
  type MicroState,
} from "./state";
import {
  canWork,
  credit,
  animalQuote,
  fruitQuote,
  plantQuote,
  seedQuote,
  saleQuote,
  salesThisTurn,
  type SaleQuote,
} from "./money";
export type FarmAction =
  | { type: "buySeeds"; crop: CropId; quantity: number; premium?: true }
  | { type: "plant"; plot: number; crop: CropId; premium?: true }
  | { type: "harvest"; plot: number }
  | { type: "harvestFruit"; id: number }
  | { type: "harvestTree"; id: number }
  | { type: "collectAnimal"; id: number }
  | { type: "collectHive"; id: number }
  | { type: "collectHoney" }
  | { type: "work" }
  | { type: "expand"; cell?: Cell }
  | { type: "build"; kind: BuildingKind; cell: Cell }
  | { type: "upgrade"; id: number }
  | { type: "teardown"; id: number }
  | { type: "deletePlot"; id: number }
  | { type: "move"; id: number; cell: Cell }
  | { type: "movePlot"; id: number; cell: Cell }
  | { type: "buyWater" }
  | { type: "sellWater" }
  | { type: "filePermit" }
  | { type: "lockPrice" }
  | { type: "improve" };
/** `drought` marks a turn when water can be traded. */
export type FarmContext = {
  turn: number;
  policy?: FarmPolicy;
  drought?: boolean;
};
export function actOnFarm(
  current: MicroState,
  action: FarmAction,
  context: number | FarmContext = 1,
): { state: MicroState; message: string } {
  const turn = typeof context === "number" ? context : context.turn;
  const policy = parseFarmPolicy(
    typeof context === "number" ? {} : (context.policy ?? {}),
  );
  const drought = typeof context !== "number" && context.drought === true;
  if (!Number.isInteger(turn) || turn < 1 || turn > 160)
    throw new Error("Use turn 1–160.");
  let state = parseMicroState(current);
  let message: string;
  if (action.type === "harvestFruit")
    return actOnFarm(state, { type: "harvestTree", id: action.id }, context);
  if (action.type === "buySeeds") {
    if (!Object.hasOwn(crops, action.crop)) throw new Error("Unknown crop.");
    if (!cropUnlocked(state, action.crop))
      throw new Error(opportunities.corn.need);
    if (!Number.isSafeInteger(action.quantity) || action.quantity < 1)
      throw new Error("Choose a positive whole seed quantity.");
    if (turn === 160)
      throw new Error("There is no growing season left for new seeds.");
    const premium = action.premium === true;
    if (premium && !policy.premiumSeed)
      throw new Error("Premium seed is not on offer.");
    const inventory = premium ? state.premiumSeeds : state.seeds;
    const price =
      seedQuote(state, action.crop, policy, premium) * action.quantity;
    if (
      !Number.isSafeInteger(price) ||
      !Number.isSafeInteger(inventory[action.crop] + action.quantity)
    )
      throw new Error("That seed quantity is too large.");
    if (state.coins < price)
      throw new Error("Not enough coins for those seeds.");
    state.coins -= price;
    inventory[action.crop] += action.quantity;
    if (premium && policy.premiumSeed) {
      const batches = (state.premiumSeedBatches ??= {});
      const cropBatches = (batches[action.crop] ??= []);
      const terms = policy.premiumSeed;
      const previous = cropBatches.at(-1);
      if (
        previous?.yield === terms.yield &&
        previous.failOneIn === terms.failOneIn
      )
        previous.quantity += action.quantity;
      else
        cropBatches.push({
          quantity: action.quantity,
          yield: terms.yield,
          failOneIn: terms.failOneIn,
        });
    }
    message = `${action.quantity} ${crops[action.crop].name} seeds bought. −${price} coins.`;
  } else if (action.type === "plant" || action.type === "harvest") {
    if (
      !Number.isInteger(action.plot) ||
      action.plot < 0 ||
      action.plot >= state.plots.length
    )
      throw new Error("That plot is not available.");
    if (!cellAllowed(state.plotCells[action.plot], policy))
      throw new Error("This plot is outside the current land grant.");
    const plot = state.plots[action.plot];
    if (action.type === "plant") {
      if (!Object.hasOwn(crops, action.crop)) throw new Error("Unknown crop.");
      if (!cropUnlocked(state, action.crop))
        throw new Error(opportunities.corn.need);
      if (plot) throw new Error("This plot is already planted.");
      const crop = crops[action.crop];
      if (!canPlant(action.crop, turn))
        throw new Error(
          `${crop.name} can be planted in ${crop.plantingSeasons.join(" or ")}.`,
        );
      const premium = action.premium === true;
      const inventory = premium ? state.premiumSeeds : state.seeds;
      if (inventory[action.crop] < 1)
        throw new Error("Buy seeds at the shop first.");
      const premiumTerms = premium
        ? state.premiumSeedBatches?.[action.crop]?.[0]
        : undefined;
      const quote = plantQuote(
        state,
        action.crop,
        policy,
        turn,
        premium,
        action.plot,
      );
      if (quote.blocked) throw new Error(quote.blocked);
      const price = quote.fee;
      if (state.coins < price + quote.fine)
        throw new Error("Not enough coins for those seeds.");
      state.coins -= price + quote.fine;
      inventory[action.crop]--;
      if (premiumTerms) {
        premiumTerms.quantity--;
        if (!premiumTerms.quantity)
          state.premiumSeedBatches![action.crop]!.shift();
      }
      const plotId = state.plotIds[action.plot];
      state.plots[action.plot] = {
        crop: action.crop,
        growth: 0,
        ...(premiumTerms
          ? {
              premiumYield: premiumTerms.yield,
              premium:
                mix(plotId, turn) % premiumTerms.failOneIn === 0
                  ? ("bad" as const)
                  : ("good" as const),
            }
          : {}),
      };
      state.lastCrops = { ...state.lastCrops, [plotId]: action.crop };
      message =
        `${premium ? `Premium ${crop.name.toLowerCase()}` : crop.name} planted. −${price} coins${quote.fee ? `, including a ${quote.fee}-coin planting fee` : ""}.` +
        (quote.reasons.length
          ? ` Planted against the rules (${quote.reasons.join("; ")}). Fine −${quote.fine} coins.`
          : "");
    } else if (plot?.withered) {
      state.plots[action.plot] = null;
      message = `The withered ${crops[plot.crop].name.toLowerCase()} was cleared for nothing.`;
    } else {
      if (!plot || plot.growth < crops[plot.crop].steps)
        throw new Error("This crop is not ready yet.");
      const sale = saleQuote(state, plot.crop, policy, turn, action.plot);
      state.plots[action.plot] = null;
      if (!sale.overQuota) state.harvests[plot.crop]++;
      ({ state, message } = sell(
        state,
        sale,
        policy,
        turn,
        `${crops[plot.crop].name} harvested`,
      ));
    }
  } else if (action.type === "collectAnimal" || action.type === "collectHive") {
    const animal = state.structures.find((s) => s.id === action.id);
    if (
      !animal ||
      !isProducer(animal.kind) ||
      (action.type === "collectHive") !== (animal.kind === "beehive") ||
      animal.pendingConstruction ||
      animal.pendingDemolition ||
      !animal.product
    )
      throw new Error(
        action.type === "collectHive"
          ? "No honey ready. Return next season."
          : "No animal produce ready. Return next season.",
      );
    if (!cellAllowed(animal, policy))
      throw new Error("This building is outside the current land grant.");
    const sale = animalQuote(state, animal, policy, turn);
    animal.product = false;
    ({ state, message } = sell(
      state,
      sale,
      policy,
      turn,
      `${buildingProducts[animal.kind].product} collected`,
    ));
  } else if (action.type === "harvestTree") {
    const tree = state.structures.find((s) => s.id === action.id);
    if (
      !tree ||
      !isTree(tree.kind) ||
      tree.pendingConstruction ||
      tree.pendingDemolition ||
      !tree.product
    )
      throw new Error("This tree has no ripe product yet.");
    if (!cellAllowed(tree, policy))
      throw new Error("This tree is outside the current land grant.");
    const sale = fruitQuote(state, tree, policy, turn);
    tree.product = false;
    ({ state, message } = sell(
      state,
      sale,
      policy,
      turn,
      `${treeProduct(tree.kind)} harvested`,
    ));
  } else if (action.type === "collectHoney") {
    if (state.honeyReady === false)
      throw new Error("Honey collected. Return next season.");
    state.honeyReady = false;
    state.coins += 12;
    message = "Honey collected! +12 coins. More next season.";
  } else if (action.type === "work") {
    if (!canWork(state, policy, turn))
      throw new Error("You already have seeds or crops to keep farming.");
    const paid = credit(state, crops.turnip.seed);
    state = paid.state;
    message = `You helped with a delivery. +4 coins for fresh seeds.${owedNote(paid.toOwed)}`;
  } else if (action.type === "expand") {
    if (state.plots.length >= (policy.maxPlots ?? WORLD_CELLS))
      throw new Error("The current plot limit has been reached.");
    const cost = policyCost(expansionCost(state), policy);
    if (state.coins < cost) throw new Error("Not enough coins to open a plot.");
    const occupied = occupiedCells(state, serviceOptions(policy));
    const cell =
      action.cell ??
      Array.from({ length: WORLD_SIZE * WORLD_SIZE }, (_, i) => ({
        row: Math.floor(i / WORLD_SIZE),
        col: i % WORLD_SIZE,
      }))
        .sort(
          (a, b) =>
            Math.abs(a.row - 16) +
            Math.abs(a.col - 16) -
            Math.abs(b.row - 16) -
            Math.abs(b.col - 16),
        )
        .find((c) => cellAllowed(c, policy) && !occupied.has(cellKey(c)));
    if (!cell || !canPlace(state, cell, 1, 1, policy))
      throw new Error("Choose unoccupied land inside the farm.");
    state.coins -= cost;
    state.plots.push(null);
    state.plotCells.push(cell);
    state.plotIds.push(state.nextPlotId++);
    message = `A new plot is ready! −${cost} coins.`;
  } else if (action.type === "build") {
    if (!Object.hasOwn(buildings, action.kind))
      throw new Error("Unknown building.");
    const item = buildings[action.kind];
    if (turn === 160)
      throw new Error("There is no next season to complete construction.");
    if (policy.blockedBuildings?.includes(action.kind))
      throw new Error("This building is restricted by the current policy.");
    if (
      !canBuild(state, action.kind) &&
      !policy.unlockedBuildings?.includes(action.kind)
    )
      throw new Error(
        opportunities[action.kind as Opportunity]?.need ??
          "Complete your farmhouse first.",
      );
    if (
      action.kind === "home" &&
      state.structures.some((s) => s.kind === "home")
    )
      throw new Error("You already have a farmhouse planned or built.");
    const limit = policy.buildingLimits?.[action.kind];
    if (
      limit !== undefined &&
      state.structures.filter((s) => s.kind === action.kind).length >= limit
    )
      throw new Error("The current policy limits this building.");
    if (!canPlace(state, action.cell, item.width, item.height, policy))
      throw new Error("That footprint is occupied or outside the farm.");
    const cost = policyCost(constructionCost(state, action.kind), policy);
    if (state.coins < cost) throw new Error("Not enough coins to build this.");
    state.coins -= cost;
    const id = state.nextStructureId++;
    // County approval delays buildings, not saplings.
    const wait = isTree(action.kind) ? 0 : (policy.buildDelay ?? 0);
    state.structures.push({
      ...action.cell,
      id,
      kind: action.kind,
      footprint: { width: item.width, height: item.height },
      level: 1,
      pendingConstruction: true,
      ...(wait ? { wait } : {}),
      ...(isTree(action.kind) ? { age: 0, product: false } : {}),
      harvestsAtLevel: upgradeHarvests(state, {
        kind: action.kind,
      }),
    });
    message = `${item.name} ${isTree(action.kind) ? "planted" : "construction started"}. Ready ${readyIn(wait)}. −${cost} coins.`;
  } else if (action.type === "deletePlot") {
    const index = state.plotIds.indexOf(action.id);
    if (index < 0) throw new Error("Choose an existing plot.");
    state.plots.splice(index, 1);
    state.plotCells.splice(index, 1);
    state.plotIds.splice(index, 1);
    message = "Field removed. No coins returned.";
  } else if (action.type === "teardown") {
    const building = state.structures.find((s) => s.id === action.id);
    if (!building) throw new Error("Choose an existing building.");
    if (building.pendingDemolition)
      throw new Error("Teardown is already underway.");
    if (turn === 160)
      throw new Error("There is no next season to complete teardown.");
    delete building.pendingConstruction;
    delete building.pendingUpgrade;
    delete building.wait;
    building.pendingDemolition = true;
    if (isTree(building.kind) || isProducer(building.kind))
      building.product = false;
    message = `${buildings[building.kind].name} teardown started. Land clears next season. No coins returned.`;
  } else if (action.type === "movePlot") {
    const index = state.plotIds.indexOf(action.id);
    if (index < 0) throw new Error("Choose an existing plot.");
    if (
      !canPlace(
        { ...state, plotCells: state.plotCells.filter((_, i) => i !== index) },
        action.cell,
        1,
        1,
        policy,
      )
    )
      throw new Error("Choose unoccupied, permitted land.");
    state.plotCells[index] = { ...action.cell };
    message = "Plot moved with its crop intact. No coins spent.";
  } else if (action.type === "upgrade" || action.type === "move") {
    const building = state.structures.find((s) => s.id === action.id);
    if (!building) throw new Error("Choose an existing building.");
    const item = buildings[building.kind];
    if (building.pendingDemolition)
      throw new Error("Teardown must finish before using this building.");
    if (action.type === "move") {
      if (
        !canPlace(
          {
            ...state,
            structures: state.structures.filter((s) => s.id !== building.id),
          },
          action.cell,
          item.width,
          item.height,
          policy,
        )
      )
        throw new Error("That footprint is occupied or outside the farm.");
      Object.assign(building, action.cell, {
        footprint: { width: item.width, height: item.height },
      });
      message = `${item.name} moved. No coins spent.`;
    } else {
      if (building.pendingConstruction)
        throw new Error("Construction must finish before upgrading.");
      if (building.pendingUpgrade)
        throw new Error("This upgrade is already underway.");
      if (turn === 160)
        throw new Error("There is no next season to complete this upgrade.");
      if (building.level === item.levels)
        throw new Error("This building is fully upgraded.");
      if (policy.frozenUpgrades)
        throw new Error("Upgrades are frozen by the council.");
      if (policy.blockedBuildings?.includes(building.kind))
        throw new Error("Upgrades are restricted by the current policy.");
      if (upgradeRemaining(state, building) > 0)
        throw new Error(upgradeHint(state, building));
      const cost = policyCost(upgradeCost(building), policy);
      if (state.coins < cost)
        throw new Error("Not enough coins to upgrade this.");
      state.coins -= cost;
      building.pendingUpgrade = true;
      if (policy.buildDelay) building.wait = policy.buildDelay;
      message = `${item.name} upgrade started. Level ${building.level + 1} completes ${readyIn(policy.buildDelay ?? 0)}. −${cost} coins.`;
    }
  } else if (action.type === "buyWater" || action.type === "sellWater") {
    const trade = policy.waterTrade;
    if (!trade)
      throw new Error("The council's rules don't allow trading water.");
    if (!drought) throw new Error("Water can be traded only during a drought.");
    const water = state.water?.turn === turn ? state.water : undefined;
    if (water?.choice === "sold")
      throw new Error("You already sold your water rights this season.");
    // A crop that already dried gains nothing from water.
    const thirsty = thirstyPlots(state)
      .filter((i) => !state.plots[i]!.dry)
      .map((i) => state.plotIds[i]);
    if (!thirsty.length)
      throw new Error(
        thirstyPlots(state).length
          ? "Your thirsty crops already dried; water cannot help them now."
          : "You have no thirsty crops growing.",
      );
    const plots = (n: number) => `${n} thirsty crop${n === 1 ? "" : "s"}`;
    if (action.type === "buyWater") {
      // Water reaches the crops growing now; crops planted later need more.
      const bought = water?.plots ?? [];
      const dry = thirsty.filter((id) => !bought.includes(id));
      if (!dry.length)
        throw new Error("Your thirsty crops already have water.");
      const cost = trade.buy * dry.length;
      if (state.coins < cost) throw new Error("Not enough coins to buy water.");
      state.coins -= cost;
      state.water = { turn, choice: "bought", plots: [...bought, ...dry] };
      message = `Water bought for ${plots(dry.length)}. −${cost} coins.`;
    } else {
      if (water)
        throw new Error("You bought water this season, so you cannot sell it.");
      const value = trade.sell * thirsty.length;
      const paid = credit(
        { ...state, water: { turn, choice: "sold" as const } },
        value,
      );
      state = paid.state;
      message = `Water rights sold for ${plots(thirsty.length)}. +${value} coins.${owedNote(paid.toOwed)}`;
    }
  } else if (action.type === "filePermit") {
    if (!policy.permitsRequired)
      throw new Error("Planting permits are not required.");
    if (turn === 160) throw new Error("There is no next season to plant.");
    if (state.permits?.includes(turn + 1))
      throw new Error("Next season's permit is already filed.");
    state.permits = withPermit(state.permits, turn + 1);
    message = "Permit filed. You can plant next season.";
  } else if (action.type === "lockPrice") {
    const offer = policy.forwardContract;
    if (!offer) throw new Error("No price contract is on offer.");
    if (state.contract && state.contract.until >= turn)
      throw new Error("You already have a price contract.");
    const until = Math.min(160, turn + offer.seasons - 1);
    state.contract = { from: turn, until, mult: offer.mult };
    message = `Price locked at ${Math.round(offer.mult * 100)}% for ${until - turn + 1} season${until === turn ? "" : "s"}.`;
  } else {
    if (state.pendingSoilUpgrade)
      throw new Error("Soil improvement is already underway.");
    if (turn === 160)
      throw new Error("There is no next season to complete this improvement.");
    if (state.soilLevel === 3) throw new Error("Soil is fully improved.");
    const offer = `soil${state.soilLevel + 1}` as Opportunity;
    if (!hasOpportunity(state, offer))
      throw new Error(opportunities[offer].need);
    const cost = policyCost(soilCost(state), policy);
    if (state.coins < cost)
      throw new Error("Not enough coins to improve soil.");
    state.coins -= cost;
    state.pendingSoilUpgrade = true;
    message = `Soil improvement started. +3 coins per harvest from next season. −${cost} coins.`;
  }
  const next = parseMicroState(state);
  const news = next.opportunities.filter(
    (id) => !current.opportunities?.includes(id),
  );
  return {
    state: next,
    message:
      message +
      (news.length
        ? ` Farm news: ${[...new Set(news.map((id) => opportunities[id].story.split(":")[0]))].join("; ")} left offers. Read them in Build.`
        : ""),
  };
}

const readyIn = (wait: number) =>
  wait ? `in ${wait + 1} seasons` : "next season";
const owedNote = (toOwed: number) =>
  toOwed ? ` ${toOwed} paid toward what you owe.` : "";
/** Pay one quoted sale: count it toward the quota, then hold it or credit it after debts. */
function sell(
  current: MicroState,
  sale: SaleQuote,
  policy: FarmPolicy,
  turn: number,
  label: string,
): { state: MicroState; message: string } {
  if (sale.overQuota)
    return {
      state: current,
      message: `${label}. Over this season's sales limit: taken for nothing.`,
    };
  const state =
    policy.quota === undefined
      ? current
      : {
          ...current,
          seasonSales: { turn, count: salesThisTurn(current, turn) + 1 },
        };
  const tax = sale.tax ? ` (−${sale.tax} to the relief fund)` : "";
  if (sale.held)
    return {
      state: sale.value
        ? { ...state, held: (state.held ?? 0) + sale.value }
        : state,
      message: `${label}! +${sale.value} coins held until next season${tax}.`,
    };
  const paid = credit(state, sale.value);
  return {
    state: paid.state,
    message: `${label}! +${sale.value} coins${tax}.${owedNote(paid.toOwed)}`,
  };
}
/** Permit turns stay unique, ascending and at most two. */
export const withPermit = (permits: number[] | undefined, turn: number) =>
  [...new Set([...(permits ?? []), turn])].sort((a, b) => a - b).slice(-2);

/** Advance crops once when integration ends a seasonal turn. */
export function growCrops(
  current: MicroState,
  policy: FarmPolicy = {},
  winter = false,
): MicroState {
  const state = parseMicroState(current);
  state.plots = state.plots.map((plot, index) => {
    if (winter) return null;
    if (!cellAllowed(state.plotCells[index], policy)) return plot;
    if (!plot || plot.withered || plot.growth === crops[plot.crop].steps)
      return plot;
    // Diseased premium seed dies the first time it should grow.
    if (plot.premium === "bad") return { ...plot, withered: true };
    return {
      ...plot,
      growth: Math.min(
        crops[plot.crop].steps,
        plot.growth + 1 + buildingLevel(state, "well", policy),
      ),
    };
  });

  return state;
}

export type WaterInput = {
  drought: boolean;
  /** Every thirsty crop is kept from drying. */
  protectedFromDrought: boolean;
  /** Plot IDs kept from drying by bought water. */
  wateredPlots?: number[];
  /** Share of thirsty growing plots that get water, 0–1, rounded; the rest wither. */
  irrigationCap?: number;
};
/** Water thirsty crops at the season change; integration decides drought, protection and caps. */
export function waterCrops(current: MicroState, input: WaterInput) {
  const cap = input.irrigationCap;
  if (cap !== undefined && !(cap >= 0 && cap <= 1))
    throw new Error("Use an irrigation cap from 0 to 1.");
  const state = parseMicroState(current);
  const thirsty = thirstyPlots(state);
  const watered =
    cap === undefined ? thirsty.length : Math.round(cap * thirsty.length);
  let dried = 0;
  for (const [n, index] of thirsty.entries()) {
    const plot = state.plots[index]!;
    if (n >= watered) state.plots[index] = { ...plot, withered: true };
    else if (
      input.drought &&
      !input.protectedFromDrought &&
      !input.wateredPlots?.includes(state.plotIds[index]) &&
      !plot.dry
    ) {
      state.plots[index] = { ...plot, dry: true };
      dried++;
    }
  }
  return { state, watered, dried, withered: thirsty.length - watered };
}

/** Complete paid upgrades at the start of the next seasonal turn. */
export function completeUpgrades(current: MicroState): MicroState {
  const state = parseMicroState(current);
  state.structures = state.structures.filter(
    (building) => !building.pendingDemolition,
  );
  for (const building of state.structures) {
    // A permit delay holds the work for its remaining seasons.
    if (building.wait) {
      if (building.wait > 1) building.wait--;
      else delete building.wait;
      continue;
    }
    if (building.pendingConstruction || building.pendingUpgrade)
      building.harvestsAtLevel = upgradeHarvests(state, building);
    delete building.pendingConstruction;
    if (building.pendingUpgrade) {
      building.level++;
      delete building.pendingUpgrade;
    }
  }
  if (state.pendingSoilUpgrade) {
    state.soilLevel++;
    delete state.pendingSoilUpgrade;
  }
  return state;
}
