# Farming loop

Choose a crop in the seed basket, then click an empty plot to plant. Seeds are paid for at planting. **End turn** advances one season and moves every growing crop forward, including crops planted in earlier seasons. Click a ripe crop to harvest and sell it immediately, then plant again when the season allows it. Plot buttons also support Tab and Enter.

| Crop | Seeds | Plant in | Seasons to grow | Base harvest |
| --- | --- | --- | --- | --- |
| Turnip | 4 coins | Spring, summer | 1 | 9 coins |
| Carrot | 7 coins | Spring | 2 | 18 coins |
| Corn | 12 coins | Spring | 2 | 34 coins |
| Radish | 3 coins | Spring | 1 | 7 coins |
| Tomato | 9 coins | Summer | 1 | 21 coins |
| Pumpkin | 14 coins | Summer | 1 | 32 coins |

Planting windows follow a simplified temperate growing year: spring roots, warm-season summer planting, and fall harvests. Corn still unlocks after harvesting a turnip and a carrot; the other seeds are available from the start. Growth is deterministic with no real-time timers. Wells speed growth. The seed basket forecasts seasons to grow using current irrigation and already commissioned wells and upgrades.

All field crops, including ripe crops, die when winter begins. Harvest before ending fall; the farmhouse calendar warns how many planted fields will be lost. Empty plots remain ready to replant in spring. Trees survive winter and keep their existing seasonal fruit rules. Greenhouses do not exempt field crops from frost. Older saves retain harvest counts and normalize previously ripe three-step corn to the new two-step maximum.

The farmhouse’s **End turn** control advances the calendar and pays seasonal building income; crop money arrives only when harvested.


Start with 240 coins, a tent, and bare land. Commission your house for 120 coins and prepare fields from the tent menu. Each of the first ten plots costs 30 coins; each plot after that costs 5 coins more than the previous one. The farm has 4,096 cells shared by plots and building footprints. Soil improvements cost 80, 160, then 240 coins; each level adds 3 coins to every harvest, including crops already planted. Both investments persist. If you have fewer than 4 coins and no planted crops, helping with a delivery earns one packet of turnip seeds' worth of coins so you can resume.

## Rules and saves

Crop definitions and economic values live in `src/micro/state.ts`. `actOnFarm` in `src/micro/rules.ts` accepts a farm state and typed action and returns fresh state plus feedback. It rejects unavailable actions without mutating the input. UI sends micro action results through `replaceDomain`; macro state stays unchanged unless **End turn** is selected. Policy and loss integration are described in [the macro contract](macro-farm-contract.md). Saving completes before the UI publishes a successful action, and concurrent actions cannot overwrite each other.

Version 3 saves include layout positions and stable IDs alongside crops, money, and soil. Version 1 and 2 saves migrate automatically. See [construction saves](construction.md#system-boundaries) for the schema and [playtesting](playtesting.md) for editing whole states.

## Iterate

Use the micro scope in Playtest tools:

- **Planting · empty fields** starts with nine empty plots and 100 coins.
- **Growing · mixed seedlings** has three of each crop at growth zero and 31 coins.
- **Harvesting · ripe fields** has those same crops ready to harvest.
- **Reinvesting · 250 coins** makes expansion and the first soil improvement affordable.

Loading fills the editor; applying saves and renders the scenario. Micro presets preserve the live macro calendar. Full-game presets replace both domains. See [playtesting recipes](playtesting.md) for instance isolation, JSON editing, and automation.

Run `pnpm test:micro` for economics and transitions, `pnpm test:integration` for save migration and domain composition, and `pnpm test:browser` for real plot interactions and presets. Run `pnpm validate` before handing over changes.
