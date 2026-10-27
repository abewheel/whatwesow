# Farming loop

Choose a crop in the seed basket, then click an empty plot to plant. Seeds are paid for at planting. **Advance growth** moves every growing crop forward one step. Click a ripe crop to harvest and sell it immediately, then plant again. Plot buttons also support Tab and Enter.

| Crop | Seeds | Grow steps | Base harvest |
| --- | --- | --- | --- |
| Turnip | 4 coins | 1 | 9 coins |
| Carrot | 7 coins | 2 | 18 coins |
| Corn | 12 coins | 3 | 34 coins |

Ripe crops keep indefinitely. Growth is manual and deterministic; there are no timers, withering, or offscreen progress. Growth steps currently stay within the macro season. Calendar progression and seasonal crop restrictions belong to a later integration.

Start with 100 coins and nine plots. Opening another plot costs 30 coins, then 5 more for each plot already opened. The farm can hold 49 plots. Soil improvements cost 80, 160, then 240 coins; each level adds 3 coins to every harvest, including crops already planted. Both investments persist. If you have fewer than 4 coins and no planted crops, helping with a delivery earns one packet of turnip seeds' worth of coins so you can resume.

## Rules and saves

Crop definitions and economic values live in `src/micro/state.ts`. `actOnFarm` in `src/micro/rules.ts` accepts a farm state and typed action and returns fresh state plus feedback. It rejects unavailable actions without mutating the input. UI sends results through `replaceDomain`; macro state stays unchanged. Saving completes before the UI publishes a successful action, and concurrent actions cannot overwrite each other.

Version 2 saves include `coins`, `plots`, and `soilLevel`. Each plot is `null` or `{"crop":"carrot","growth":1}`. Growth ranges from zero through the crop's grow-step count. The array has 9–49 entries; soilLevel is 0–3. Version 1 saves migrate automatically to nine empty plots and level-zero soil while preserving coins, year, and season. Version 2 saves require all farming fields.

## Iterate

Use the micro scope in Playtest tools:

- **Planting · empty fields** starts with nine empty plots and 100 coins.
- **Growing · mixed seedlings** has three of each crop at growth zero and 31 coins.
- **Harvesting · ripe fields** has those same crops ready to harvest.
- **Reinvesting · 250 coins** makes expansion and the first soil improvement affordable.

Loading fills the editor; applying saves and renders the scenario. Micro presets preserve the live macro calendar. Full-game presets replace both domains. See [playtesting recipes](playtesting.md) for instance isolation, JSON editing, and automation.

Run `pnpm test:micro` for economics and transitions, `pnpm test:integration` for save migration and domain composition, and `pnpm test:browser` for real plot interactions and presets. Run `pnpm validate` before handing over changes.
