# Farming loop

Tap an empty plot, then choose a seasonal crop in its popup to plant. Seeds are paid for at planting. **End turn** advances one season and moves every growing crop forward, including crops planted in earlier seasons. Tap a ripe crop and choose Harvest to collect and sell it on arrival, then plant again when the season allows it. Plot buttons also support Tab and Enter.

| Crop    | Seeds    | Plant in       | Seasons to grow | Base harvest | Thirsty |
| ------- | -------- | -------------- | --------------- | ------------ | ------- |
| Turnip  | 4 coins  | Spring, summer | 1               | 9 coins      | No      |
| Carrot  | 7 coins  | Spring         | 2               | 18 coins     | No      |
| Corn    | 12 coins | Spring         | 2               | 34 coins     | Yes     |
| Radish  | 3 coins  | Spring         | 1               | 7 coins      | No      |
| Tomato  | 9 coins  | Summer         | 1               | 21 coins     | Yes     |
| Pumpkin | 14 coins | Summer         | 1               | 32 coins     | Yes     |

Planting windows follow a simplified temperate growing year: spring roots, warm-season summer planting, and fall harvests. Corn still unlocks after harvesting a turnip and a carrot; the other seeds are available from the start. Growth is deterministic with no real-time timers. Wells speed growth. The plot menu forecasts seasons to grow using current irrigation and already commissioned wells and upgrades.

All field crops, including ripe crops, die when winter begins. Harvest before ending fall; the farmhouse calendar warns how many planted fields will be lost. Empty plots remain ready to replant in spring. Trees survive winter and keep their existing seasonal fruit rules. Greenhouses do not exempt field crops from frost. Older saves retain harvest counts and normalize previously ripe three-step corn to the new two-step maximum.

The farmhouse’s **End turn** control advances the calendar and pays seasonal building income; crop money arrives only when harvested. Once every four years, from year 2 to year 30, it also calls a [council crisis](crises.md), which must be answered before the farm or the season moves on.

Start with 240 coins, a tent, and bare land. Commission your house for 120 coins and prepare fields by tapping open land. Each of the first ten plots costs 30 coins; each plot after that costs 5 coins more than the previous one. The farm has 4,096 cells shared by plots and building footprints. Soil improvements cost 80, 160, then 240 coins; each level adds 3 coins to every harvest, including crops already planted. Both investments persist. If no plot holds a crop (clear withered ones first) and your coins cannot pay for the cheapest planting this season, helping with a delivery earns one packet of turnip seeds' worth of coins, 4, so you can resume. Without a seed storehouse or council rules, the cheapest planting is radish at 3 coins, or turnip at 4 in summer. Council seed prices, planting fees and fines raise it, with rotation checked plot by plot, and a farm with no plots also needs the price of one. See [delivery work](crises.md#delivery-work).

## Council rules and crops

Council crises add rules to the loop; [crises](crises.md) lists each one. Without them, farming works exactly as above.

- **Thirsty crops.** Corn, tomatoes and pumpkins need water while they grow, and their crop buttons say so. A drought dries the ones still growing to half yield, and an irrigation cap withers the ones it cannot water. Water bought in a drought reaches the thirsty crops growing when you buy it; crops planted afterwards need more.
- **Dry, withered and premium plots.** A dry crop still grows and sells for half. A withered crop is dead: it stops growing, and **Clear withered crop** in its popup empties the plot for nothing, with no harvest counted. Premium seed, when the council allows it, sells for more but sometimes withers at its first growth. Plot labels say "dry", "withered" or "premium seed".
- **Owed coins.** Council charges at End turn never overdraw your coins; whatever they cannot cover is owed, shown with your coins in the HUD. Every sale, seasonal income, delivery and other income pays what is owed first. Seeds, fees, fines and other purchases you choose still need coins on hand.
- **Seed and yield.** Council rules can raise the seed price or make seed free, and some cut every crop harvest's yield, so it sells for less.
- **Fines.** Some rules can be broken for a fine of 3 × the crop's base sale, charged once per planting with the seed: a banned or limited crop, a crop other than the season's named one, the same crop twice in a row on a plot, a plot that must rest, or no permit. The named crop skips any crop another rule bans, blocks or limits, as long as the season has another, and planting it never breaks the rotation rule. A crop recovering from blight and a limit you agreed to in a deal cannot be planted at any price. See [fines](crises.md#fines).
- **Sales.** Prices can change by crop or be fixed, a relief fund tax can take a share, sales of an oversized crop can be held until the next season, and a limit on sales each season can take sales over it for nothing. Fruit, eggs, milk and wool sell through the same prices, tax and limit, and pay what is owed first.

An empty plot's popup shows the rules before you plant. Each crop button gives the seed price with any multiplier and planting fee, and the sale value after the relief fund's share. It says when the sale money would wait a season, when the sale would be over this season's limit and taken for nothing, and when the crop is thirsty. It names any rule planting on that plot breaks, rotation included, with the fine, or the reason it is refused, with the button disabled. While premium seed is on offer, a **Premium seed** toggle above the crops shows its terms. A ripe crop's popup says what it sells for, and an animal building's what its produce sells for. These forecasts call the same `plantQuote` and `saleQuote` helpers as the rules, with the merged policy from `farmContext`.

## Rules and saves

Crop definitions and economic values live in `src/micro/state.ts`. `actOnFarm` in `src/micro/rules.ts` accepts a farm state and typed action and returns fresh state plus feedback. It rejects unavailable actions without mutating the input. Owed coins, the shared price quotes and the delivery work rule live in `src/micro/money.ts`: `charge`, `credit`, `plantQuote`, `saleQuote`, `fruitQuote`, `workThreshold` and `canWork`. The council adds four actions: `buyWater`, `sellWater`, `filePermit` and `lockPrice`; `plant` takes an optional `premium: true`. UI sends farm actions through `actOnGame` in `src/game/state.ts`, which refuses every action while the council waits for an answer and stores the result through `replaceDomain`; macro state changes only with **End turn** or a council answer. Policy and loss integration are described in [the macro contract](macro-farm-contract.md). Saving completes before the UI publishes a successful action, and concurrent actions cannot overwrite each other.

Version 3 saves include layout positions and stable IDs alongside crops, money, and soil. Council rules add optional micro fields: `owed`, `held`, `permits`, `lastCrops`, `seasonSales`, `water` and `contract`. This season's water trade is `{turn, choice: "bought", plots}`, with the IDs of the plots the water reaches, or `{turn, choice: "sold"}`; a bought record saved without `plots` reaches the thirsty crops growing in the save. Plots can carry `dry`, `withered` and `premium`, and structures a building delay, `wait`. Saves without these fields load unchanged. Version 1 and 2 saves migrate automatically. See [construction saves](construction.md#system-boundaries) for the schema and [playtesting](playtesting.md) for editing whole states.

## Iterate

Use the micro scope in Playtest tools:

- **Planting · empty fields** starts with nine empty plots and 100 coins.
- **Growing · mixed seedlings** has three of each crop at growth zero and 31 coins.
- **Harvesting · ripe fields** has those same crops ready to harvest.
- **Reinvesting · 250 coins** makes expansion and the first soil improvement affordable.

Loading fills the editor; applying saves and renders the scenario. Micro presets preserve the live macro calendar. Full-game presets replace both domains. For council rules, use the whole-game [crisis presets](crises.md#test-crises). See [playtesting recipes](playtesting.md) for instance isolation, JSON editing, and automation.

Run `pnpm test:micro` for economics and transitions (council rules are in `src/micro/council.test.ts` and `src/micro/money.test.ts`), `pnpm test:integration` for save migration, domain composition and crises, and `pnpm test:browser` for real plot interactions and presets. Run `pnpm validate` before handing over changes.
