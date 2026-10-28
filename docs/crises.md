# Council crises

Eight council crises from the [crisis layer](../crisis-layer/INTEGRATION.md) fire during play, one every four years from year 2 to year 30. The farm picks the season. The player picks an argument, the crisis layer's engine decides which policy passes, and integration turns that policy into farm rules. Wording, policies and the council's window math live in `crisis-layer/content.json` and `crisis-layer/engine.js`; this guide covers what the game does with them. Read [ownership](game-boundaries.md) and [the macro contract](macro-farm-contract.md) before changing the rules.

## When each crisis fires

The player sees each crisis's `title` (Drought, Crop disease, Land for a dam, Too much of one crop, Prices drop); code, saves and this guide use its `id` (Drought, Blight, Eminent domain, Overproduction, Price crash). All crisis text is written for a 13-year-old reader, so keep new wording that plain. The order is fixed by `content.params.runOrder`. Crisis n belongs to year 2 + 4(n − 1) (`crisisYears` in `src/game/crisis.ts`: 2, 6, 10, 14, 18, 22, 26 and 30), so years 31 to 40 have none. The seasons are data in `crisisTiming`; a drought's `drained` seasons apply once an earlier answer has drained the valley's water (`aquiferDrained`).

| # | Crisis | Year | Fires in | Turn |
| --- | --- | --- | --- | --- |
| 1 | Drought | 2 | Summer | 6 |
| 2 | Blight | 6 | Summer | 22 |
| 3 | Eminent domain | 10 | Spring; summer if the farm has fewer than 6 plots | 37; 38 |
| 4 | Overproduction | 14 | Fall | 55 |
| 5 | Drought | 18 | Summer; spring once the water is drained | 70; 69 once drained |
| 6 | Price crash | 22 | Summer | 86 |
| 7 | Eminent domain | 26 | Spring; summer if the farm has fewer than 6 plots | 101; 102 |
| 8 | Overproduction | 30 | Fall | 119 |

- A crisis fires only at the start of a season, right after **End turn**: on time, the first of its seasons in its year.
- Eminent domain's 6 plots is the only farm condition. A condition can delay a crisis to a later season of its year, never past it, so a small farm faces Eminent domain in summer. Overproduction has no condition: fall is its only season, so a condition could never delay it.
- The seasons follow the farm. A summer drought catches spring corn and summer tomatoes and pumpkins while they are still growing. Drought +40 drains the valley's water, so the next drought comes in spring and lasts through summer: spring corn dries at the first season change and summer crops at the second. A summer blight lands while the spring crops are still in the ground. Eminent domain comes in spring when there is land to take. Overproduction fires in fall, when the summer crops ripen. A summer price crash covers summer sales and the fall harvest; no field crop ripens in spring.
- A save behind schedule catches up one year apart: the overdue crisis fires in its next season, and each later one at least 4 turns after the previous one, until the schedule is met again. A save in year 10 spring with no crises gets the drought at turn 38, the blight at 42, Eminent domain at 46 and Overproduction back on schedule at 55. Nothing fires after year 30, so a save far enough behind never meets the last crises. Saves whose crises fired on an earlier, faster schedule keep their records and wait for the next crisis's year.

`crisisDue(state)` names the crisis that should fire now. `endTurn(state)` runs `advanceSeason`, then `fireCrisis` when one is due; the UI saves the result once.

## What the player sees

The End turn message ends with "Crisis 1 of 8: Drought." and the council meeting (`dialog#crisis`) opens. It shows the crisis heading, the trigger, the council meter, a note when the same crisis has been faced before, and five cards from named neighbors with portraits: Walt Finch, June Calloway, Nora Delgado, Tom Brennan and Ada Kessler. The prompt is "What do you say to the council?". No card names an ideology.

After a pick, the meeting shows the player's argument and its speaker, Tom Brennan's case for control (unless the player picked him), the answer, the shift, what passed, any attribution, the meter, **What happens to you**, a line saying what the answer did to the farm, and **Rules you still have to follow**. An offer shows **Take the deal** and **Say no**. **Back to the farm** closes the meeting once nothing is waiting.

The council waits while the latest crisis has no answer, or its deal has none. Meanwhile:

- Every popup leads with the note "The council is waiting for your answer." and an **Answer the council** button, and **End turn** in the farmhouse popup is disabled. `advanceSeason` throws the same message.
- Every farm action is refused with the same message (`actOnGame`), and its popup button is disabled: planting, harvesting, collecting eggs, milk or wool, building, moving plots or buildings, upgrades, soil work, delivery work and trades. Nothing on the farm changes between the crisis and its answer, so the answer lands on the farm the crisis found.
- Escape and × only hide the meeting. The HUD's **Council meeting** button reopens it; on small screens, while a popup is open, the popup's **Answer the council** button stands in for it.
- After a reload, the meeting reopens once the farm is entered.

The farmhouse (or tent) popup gains a **Council rules** section once a crisis has fired. It lists live facts for this season: in a drought, or under a water limit, what End turn will do to the thirsty crops; owed coins, held sales, the sales allowed this season and how many are used, permits, a price lock, the one crop the rules let you plant, a recovering crop, changed sale prices, water prices, wells and premium seed. It offers the trades open now, each with its price: buying water, selling water rights, and locking in a price. It then lists the standing rules in the council's words. The HUD shows how much is owed with the coins while anything is owed. An empty plot's popup shows each crop's price, sale value, whether it is thirsty, and any rule planting it on that plot breaks, and a ripe crop's popup what it sells for; see [the farming loop](micro-game.md#council-rules-and-crops).

The farm shows the consequences too, and every one is also in words: dry crops are tinted yellow-brown and labelled "dry"; withered crops turn dark brown, shrink and are labelled "withered"; land the county took shows cracked earth, dead stubble, broken foundations and collapsed timber in every season, and is labelled as taken by the county; sealed buildings fade to grey under crossed planks and say "sealed by the council"; premium plantings say "premium seed".

## Triggers

A crisis's own effect starts when it fires, before any answer.

| Crisis | Trigger | Lasts |
| --- | --- | --- |
| Drought | At the season change, thirsty crops still growing dry to half yield unless they are protected. | The fire season; spring and summer once an earlier Drought +40 has drained the water. |
| Blight | Picks the crop on the most plots, else the most harvested crop, else turnip. In summer the spring crops are still in the ground, so it is usually the crop the farm grows most. Every plot of it is cleared at once, and it cannot be planted while it recovers: "Corn is still recovering from blight." | The crop's next two planting seasons, counting the fire season when the crop can be planted then. The answer can shorten it; see [blight recovery](#blight-recovery). |
| Eminent domain | Nothing until the council decides. | — |
| Overproduction | Picks the top crop: the most coins from planted plots (plots × harvest value), else the most harvested, else turnip. It sells at 75%. | The fire season and the next. |
| Price crash | Every crop, fruit, egg, milk and wool sale is at 60%. | The fire season and the next: summer and fall. |

## What each policy does to the farm

Positions run from +80 (freedom) to −80 (control). "From now on" means a standing rule.

A standing rule binds from the moment its policy takes effect, and a policy that passes again does not bind a second time, as the council lists it once. A deal takes effect only when it is taken. Overproduction's rules count per crop. So:

- A deal refused at the first Overproduction binds nothing. Taking the same deal at the second binds it then: 115% and the 5-plot limit.
- Overproduction 0 passing twice on the same crop charges one fee. On two different crops, each crop pays its own fee and has its own sales held.

### Drought

| Position | Policy | On the farm |
| --- | --- | --- |
| +80 | Farms can buy and sell water | In every drought season the farmhouse offers to sell water rights, and to buy water unless a working well or water at cost already protects the crops. Buying water costs 12 coins per thirsty growing crop and keeps those crops from drying. It reaches only the crops growing when it is bought: crops planted afterwards need water bought again, charged only for them. Selling water rights earns 6 coins per thirsty growing crop, and then nothing waters them that season, not even a well or water at cost, so they dry. Rights can be sold once a season, and not after buying water. A later Drought 0, −40 or −80 ends water trading. |
| +40 | Every farm can build its own well | An irrigation well can be built without its milestone, and a finished, unsealed well protects every thirsty crop in a drought. Pumping drains the valley's water: the next drought comes in spring and lasts two seasons, spring and summer. A later Drought 0, −40 or −80 takes the wells back. |
| 0 | A public water company does the pumping | Thirsty crops are protected for the rest of this drought, both seasons when the water is drained, for 1 coin each, charged at End turn. From now on, a water bill of 5 coins or 1 per plot, whichever is more, at every End turn. Existing wells are sealed, new wells and well upgrades are blocked, and water can no longer be bought or sold. |
| −40 | A water board with a rising water tax | From now on, at every season change except into winter, only the first 60% of thirsty growing crops by plot order get water, rounded to the nearest whole crop (1 of 1, 1 of 2, 2 of 3, 3 of 5). The rest wither. Watering n crops costs n(n+1)/2 coins of tax. Existing wells are sealed, new wells and well upgrades are blocked, and water can no longer be bought or sold. |
| −80 | Water handed out by need | The same cap at 40% (none of 1, 1 of 2, 2 of 5), with no tax. Water can no longer be traded, wells no longer protect crops, new wells and well upgrades are blocked, and existing wells are sealed. |

### Blight

| Position | Policy | On the farm |
| --- | --- | --- |
| +80 | Buy any seed, safe or not | Empty plots offer premium seed: seed costs 1.5×, a good planting sells for 30% more, and about one planting in eight is diseased and withers at its first growth. The plot and season decide which, so a replay gives the same result. |
| +40 | Sellers may add a 'checked safe' label | From now on, seed costs 1.25×, rounded up: without a seed storehouse, turnip 5, radish 4, carrot 9, tomato 12, corn 15 and pumpkin 18 coins. |
| 0 | You pay the county to check seed | The blighted crop recovers after one of its planting seasons instead of two. From now on, every planting costs a 2-coin fee, seed costs 1.25×, and every crop harvest sells for 90%. No crop may follow itself on a plot; breaking that rule costs a fine. |
| −40 | You need a permit and checked seed | The blighted crop can be replanted at once. From now on, every planting costs a 2-coin fee, seed costs 1.25×, and every crop harvest sells for 90%. Planting needs a permit for that season, filed free at the council office the season before; the season the rule passes is covered. No crop may follow itself on a plot. Breaking either rule costs a fine. |
| −80 | A valley seed board picks your crops | Seed is free, and all crop harvests sell for 80%. Each season one crop is named (`assignedCrop`): the season's plantable crops sorted by base sale, cheapest first, moving one step each year. When another rule bans that crop, blocks it while it recovers from blight, caps it, or charges a fee past a cap and holds its sales, the next crop in that order is named instead, so other years keep their crops. Planting anything else costs a fine. |

#### Blight recovery

Recovery counts the blighted crop's own planting seasons (`recoveryUntil`), so every crop loses the same number of chances to plant. The fire season counts when the crop can be planted then. For the blight in year 6 summer (turn 22):

| Blighted crop | Two seasons (the default) | One season (Blight 0) |
| --- | --- | --- |
| Corn, carrot or radish (spring) | Blocked in years 7 and 8 spring; back in year 9 spring | Blocked in year 7 spring; back in year 8 spring |
| Tomato or pumpkin (summer) | Blocked this summer and year 7 summer; back in year 8 summer | Blocked this summer; back in year 7 summer |
| Turnip (spring and summer) | Blocked this summer and year 7 spring; back in year 7 summer | Blocked this summer; back in year 7 spring |

Blight −40 lifts the block as soon as it passes.

### Eminent domain

Plot worth is the price of the next new plot plus the sale value of a living crop on it. Taken plots leave with their crops, and their cells leave the farm for good: nothing can be planted, placed or built there. Plots are chosen in a fixed order: `edge` takes the east side on screen first; `random` follows a hash of plot ID and the fire turn; `mostProductive` takes planted plots by crop value, then empty plots.

| Position | Policy | On the farm |
| --- | --- | --- |
| +80 | Build only on land the county owns | Nothing changes. |
| +40 | Buy only if the owner says yes | A deal. Taking it sells the 4 edge plots for 120% of their worth. Saying no changes nothing. |
| 0 | Take the land, pay full price | The county takes the 4 edge plots and pays their worth. |
| −40 | Take the land, pay half price | The county takes 6 random plots and pays half their worth. From now on, new buildings and building upgrades take one extra season; saplings do not. Planting needs a permit, as under Blight −40, and the council office opens. Seed is free, and each season one crop is named, as under Blight −80. Planting anything else, or without a permit, costs a fine. |
| −80 | Take the best land, pay nothing | The county takes the 8 most productive plots and pays nothing. From now on, no building kind can exceed its count when the policy passed, work underway included. Kinds the farm lacks cannot be built; trees are not capped. Permits, free seed, the named crop and the fine as under −40. |

### Overproduction

All rules here name the top crop chosen when the crisis fired.

| Position | Policy | On the farm |
| --- | --- | --- |
| +80 | No new rules | Only the trigger's glut price. |
| +40 | Farmers can choose to grow less together | A deal. Taking it replaces the glut price with 115% from now on, and limits the crop to 5 plots, a hard limit no fine can break. Saying no leaves the glut price. |
| 0 | A fee for each crop plot over 5 | From now on, a fee of 5 coins per plot of the crop above 5 at every End turn. Its sales are held until the next season change while more than 5 plots of it are planted, the harvested one included. The hold is per crop (`sellDelay`), so a second Overproduction 0 on another crop holds that crop too. |
| −40 | The farm office limits planting and sales | Plots of the crop past the first 5, by plot order, are plowed under. From now on, at most 5 plots of it, and one plot in five must stay empty each season. Breaking either rule costs a fine. Each season allows 3 sales or one per two plots, rounded up, whichever is more; sales over it earn nothing and don't count as harvests. Every crop's sale value is frozen at its value when the policy passed, and no price multiplier lifts a crop or fruit sale above 100%, a deal's 115% included. The glut's 75% still runs its two seasons. |
| −80 | Ban the crop and take what's above average | Every plot of the crop is plowed under and it is banned; planting it costs a fine. From now on, each crop's base value is capped at its base sale, so soil and building bonuses stop raising crop prices. Sale values are frozen and capped at 100% as under −40; premium seed's yield still applies. Sales are limited as under Price crash −80, an allowance that changes each season. Buildings cannot be upgraded. |

### Price crash

| Position | Policy | On the farm |
| --- | --- | --- |
| +80 | Leave prices alone | Only the crash. |
| +40 | Let farmers agree on next year's price with buyers | During the crash's two seasons, summer and fall, the farmhouse offers to lock in 85% for 4 seasons. While the lock runs, every crop, fruit, egg, milk and wool sale is at 85%, whatever prices do. One lock at a time. |
| 0 | Loans that farmers pay back later | A loan of 100 coins or 20 per plot, whichever is more. It is repaid in four equal parts at the next four End turns. |
| −40 | A harvest tax pays to hold prices up | The crash cuts prices to 90% instead of 60%. From now on, 10% of every crop, fruit, egg, milk and wool sale goes to the relief fund. |
| −80 | The government buys all crops at set prices | No crash. Each crop's sale value is frozen at its value when the policy passed, and no multiplier lifts it higher. Each season allows only so many sales (`boardQuota`): 3 or one per two plots, rounded up, whichever is more, times 50%, 75%, 100% or 125%, picked afresh each season, rounded down, at least 1. Sales over it earn nothing and don't count as harvests. Seed costs 1.5×. |

## Harms

| Harm | Cause | Effect |
| --- | --- | --- |
| Dry | Drought without protection | The crop keeps growing and sells for half at harvest. |
| Withered | Irrigation cap, diseased premium seed | Dead. It stops growing, no longer counts as planted, and counts as empty for the fallow rule. **Clear withered crop** in its popup empties the plot for nothing, with no harvest counted. |
| Cleared | Blight, crops plowed under | The crops are lost; the plots stay. |
| Taken | Eminent domain | The plots and their cells leave the farm. |
| Sealed | Drought 0, −40, −80 (wells) | The buildings stay but give no growth, harvest bonus, seed discount or income. |
| Held | Overproduction 0 | The sale's coins arrive at the next season change. |
| Over the sales limit | Overproduction −40, −80; Price crash −80 | The sale earns nothing and is not counted. |

Winter frost still clears every field crop, along with its dry, withered and premium marks.

## Owed coins

Charges at the season change never overdraw: the water bill, water tax, water at cost, the fee on extra crops and loan payments. When coins run short, the rest becomes owed and the HUD shows how much is owed. All income pays what is owed first: crop and fruit sales, seasonal income, held sales, delivery work, sold water rights, and cash for land or a loan. Each message says how much went to the debt. There is no interest.

Purchases the player chooses, including seed, planting fees, fines, water and buildings, must be paid from coins on hand, or they are refused as before.

## Delivery work

Delivery work, in the farmhouse popup, earns 4 coins, which pay what is owed first. It is offered while no plot holds a crop (a withered crop still counts until it is cleared), and the coins cannot pay for the cheapest planting this season (`canWork`, `workThreshold`). That price is seed, planting fee and any fine for the cheapest crop the rules allow now, quoted on each plot, since rotation depends on what each plot grew last. Out of season, or when every crop is blocked, it is what planting will cost once it can. A farm with no plots also needs the price of a plot. So a broke farm can always work its way back to planting. Under Blight 0, summer turnip costs 7 (5 for seed at 1.25×, plus the 2-coin fee), so the button stays until two deliveries pay for it. If every plot last grew turnip, turnip there would also cost a 27-coin fine, so the cheapest planting is a tomato at 14 and the button stays until the coins reach 14. A macro `allowWork: false` turns delivery work off.

## Fines

Some planting rules can be broken for a price: a banned crop, a crop limit, the season's named crop, rotation, plots that must rest, and permits. Every crisis policy with such a rule also sets a fine of 3 × the crop's base sale (corn: 102 coins). The planting goes ahead and costs seed, fee and one fine, however many rules it breaks: "Planted against the rules (Pumpkin is banned). Fine −96 coins." If a macro `farmPolicy` sets such a rule with no fine, the planting is refused, naming the first broken rule.

Two rules are never fined: a crop still recovering from blight, and a limit the player agreed to in a deal.

Rules from different crises can meet, so obeying one never costs a fine under another:

- The named crop skips a crop that another rule bans, blocks while it recovers, caps (`cropLimits` or a deal's `agreedCropLimits`), or charges a fee past a cap and holds the sales of (Overproduction 0), whichever record set it. `crisisRules` names the crop again once every record is compiled, moving to the next crop in the season's order; when every crop of the season is skipped, the year's own crop stays. So with Eminent domain −40 and Overproduction −40 on pumpkin, the summers that would name pumpkin (years 33, 36 and 39) name turnip.
- Planting the named crop never breaks rotation (`plantQuote`), so turnip named in year 34 spring and again in summer can follow itself on a plot.
- Delivery work quotes each crop on each plot (`workThreshold`), so a farm whose plots all last grew one crop is not left short of the price of a different one.

## Reachable policies

The engine decides what passes from the council's mood, which starts at `params.startCenter` 50. The player's argument and the case for control move the mood first, and the council votes from where it lands: the engine's `shiftThenResolve` order, passed as `shiftFirst` by `councilState` in `src/game/crisis-rules.ts`, the one place the game replays the council. So an argument can change its own crisis's result, and the attribution line can name the meeting just held (`attributionNow`). Records record only picks, and every call replays them, so a save keeps the order it started with: each record the game fires carries `shiftFirst: true`, and a save whose first record lacks it fired before the change and still votes first, keeping its past results on load. The development Crisis test always moves first.

A walk of every run through the real engine (all five cards at each crisis, each deal both taken and refused: 1,562,567 runs) gives the share of runs that pass each policy:

| # | Crisis | +80 | +40 | 0 | −40 | −80 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Drought | 22.7% | 40.1% | 37.2% | — | — |
| 2 | Blight | 22.7% | 44.2% | 33.1% | — | — |
| 3 | Eminent domain | 6.8% | 71.0% | 22.1% | — | — |
| 4 | Overproduction | 5.3% | 72.2% | 20.4% | 2.2% | — |
| 5 | Drought | 3.5% | 57.0% | 32.0% | 7.6% | — |
| 6 | Price crash | 2.1% | 51.9% | 31.8% | 14.1% | Under 0.1% |
| 7 | Eminent domain | 0.7% | 54.7% | 27.4% | 16.9% | 0.2% |
| 8 | Overproduction | 0.5% | 44.5% | 30.7% | 23.1% | 1.2% |

Counted per choice at a crisis rather than per complete run, the shares shift where deals add branches: Eminent domain −40, for example, passes at 20.9% of the choices at crisis 7.

Drought −80, Blight −40 and Blight −80 never pass. A lower `startCenter` brings some in: Drought −80 from 35 and Blight −40 from 30. Blight −80 stays out of reach even at 0. None of their rules is stranded, though: each also belongs to a policy that passes.

| Rule | Policies that pass | Share of runs | From |
| --- | --- | --- | --- |
| Sealed well, no new wells, no water trade | Drought 0, −40 | 60.8% | Year 2 |
| Seed at 1.25× | Blight +40, 0 | 77.3% | Year 6 |
| Crop rotation, harvests at 90% | Blight 0 | 33.1% | Year 6 |
| Planting permits and the council office | Eminent domain −40, −80 | 17.2% | Year 26 |
| The named crop and free seed | Eminent domain −40, −80 | 17.2% | Year 26 |
| Sales limit and fixed prices | Overproduction −40, −80; Price crash −80 | 25.3% | Year 14 |

Picking Nora Delgado's card every time meets every rule above, and so does picking Tom Brennan's. June Calloway's meets the dearer seed and, from her second drought's 0, the sealed well; Walt Finch's meets only the dearer seed, and Ada Kessler's none; 8.3% of all runs meet none. The never-passing policies keep their own rules, which are unit-tested by stubbing `engine.replay`. The shares come from replaying every pick sequence with `Engine.replay`; recount them after changing policy positions or `startCenter`.

## End turn, step by step

`advanceSeason` (`src/game/state.ts`) stays one pure transition:

1. Refuse while a crisis waits for an answer.
2. Compile the rules of the season being left: macro policy merged with the crisis rules.
3. Except into winter, water thirsty growing crops (`waterCrops`): an irrigation cap withers the excess; a drought dries the unprotected rest. Water bought for a plot, a working well or water at cost protects a crop, unless the water rights were sold this season (`waterSupply`, `waterInput`).
4. Grow crops (withered ones don't, diseased premium seed withers), then finish construction and upgrades whose delay has run out.
5. Pay seasonal income and held sales, paying owed coins first.
6. Charge the council's bills, each named in the message; shortfalls are owed. Water at cost is not charged once the water rights are sold.
7. Clear this season's sales count and water trade, used permits, and an ended price lock.
8. Season trees. Then `endTurn` fires the next crisis if one is due.

## Where the code lives

| Part | Code |
| --- | --- |
| Timing, firing and answers: `crisisYears`, `crisisTiming`, `crisisDue`, `fireCrisis` (it clears the blighted crop), `endTurn`, `answerCrisis`, `answerOffer`, top crop, blight crop, plot worth and selection | `src/game/crisis.ts` |
| Effects compiled into rules: `crisisRules`, `crisisPolicy`, `mergePolicy`, `pendingCrisis`, `councilLedger`, record checks, `recoveryUntil`, `aquiferDrained`, `assignedCrop`, `boardQuota`, loans, `waterSupply` and `waterInput`, seasonal charges | `src/game/crisis-rules.ts` |
| Season change, the merged rules and this season's water, farm actions while the council waits: `advanceSeason`, `farmContext`, `actOnGame` | `src/game/state.ts` |
| Crisis records | `src/macro/state.ts` |
| Policy fields and validation | `src/contracts/farm-policy.ts` |
| Planting, harvest, water, permits, price locks, building rules | `src/micro/rules.ts` |
| Owed coins, price quotes and delivery work: `charge`, `credit`, `plantQuote`, `saleQuote`, `fruitQuote`, `workThreshold`, `canWork` | `src/micro/money.ts` |
| Thirsty crops, plot marks, new farm fields; council office lot and sealed building levels | `src/micro/state.ts`, `src/micro/world.ts` |
| Engine and content loading | `src/crisis/engine.ts`, `src/crisis/content.ts` |
| Council meeting; hand, outcome, meter and standing rules; speakers; portraits | `src/crisis/dialog.ts`, `src/crisis/view.ts`, `src/crisis/portraits.ts` |
| Council rules section | `src/crisis/council.ts`, `src/main.ts` |
| HUD and popups: End turn, crops, plans, the council office | `src/main.ts`, `src/game/services.ts` |
| Crop marks, ground tints, sealed buildings, council office drawing | `src/game/crop-sprites.ts`, `src/game/terrain.ts`, `src/game/scene.ts`, `src/game/farmer-route.ts` |
| Crisis presets and the Crisis test | `src/dev/presets.ts`, `src/dev/crisis-trial.ts` |

Crisis rules are derived on every call from the records and their answers; they are never written into `farmPolicy`. Change wording or numbers in `content.json` only, then run `npm run content` and `npm test` in `crisis-layer/`. Effect types are documented in [the crisis layer contract](../crisis-layer/INTEGRATION.md#4-effects).

## Test crises

In local development, open **Playtest tools** with **Whole game** scope and load a crisis preset. Each sits one End turn before its crisis, on a farm with 9 plots, a seed storehouse and 300 coins plus 200 per earlier crisis. The first family's earlier crises were answered by Ada Kessler:

| Preset | State | End turn fires |
| --- | --- | --- |
| **Crisis · drought next turn** | Year 2 spring, corn and carrots growing, no well | Crisis 1 · Drought |
| **Crisis · blight next turn** | Year 6 spring, corn and carrots growing | Crisis 2 · Blight (corn) |
| **Crisis · eminent domain next turn** | Year 9 winter, no crops | Crisis 3 · Eminent domain, in year 10 spring |
| **Crisis · overproduction next turn** | Year 14 summer, pumpkins and tomatoes growing | Crisis 4 · Overproduction (pumpkin) |
| **Crisis · second drought next turn** | Year 18 spring, corn and carrots growing | Crisis 5 · Drought |
| **Crisis · price crash next turn** | Year 22 spring, corn and carrots growing | Crisis 6 · Price crash |
| **Crisis · second eminent domain next turn** | Year 25 winter, no crops | Crisis 7 · Eminent domain, in year 26 spring |
| **Crisis · second overproduction next turn** | Year 30 summer, pumpkins and tomatoes growing | Crisis 8 · Overproduction (pumpkin) |

Ada Kessler's answers keep the council near freedom. From the first drought preset, Nora's or Tom's card passes 0, and from the blight preset Tom's does; from crisis 3 on only +80 and +40 can pass, and at the second overproduction every card but Ada's passes +40, the deal.

The second family, labelled "toward control", answered every earlier crisis with Nora Delgado's card (0 at crises 1 to 4, then −40 at crises 5 to 7). Picking her card again passes the policy below, and its rules show on the farm:

| Preset | State | End turn fires | Nora Delgado passes | Look for |
| --- | --- | --- | --- | --- |
| **Crisis · blight, toward control** | Year 6 spring, corn and carrots growing | Crisis 2 · Blight (corn) | Blight 0 | The planting fee, seed at 1.25×, harvests at 90%, and rotation's fine |
| **Crisis · second drought, toward control** | Year 18 spring, corn and carrots growing, a well sealed since the first drought | Crisis 5 · Drought | Drought −40 | The rising pumping tax, water for only 60% of the thirsty crops while the rest wither, the well still sealed, no water trade |
| **Crisis · second eminent domain, toward control** | Year 25 winter, no crops | Crisis 7 · Eminent domain, in year 26 spring | Eminent domain −40 | 6 plots taken at half their worth, the council office and permits, free seed, turnip named for the season, the build delay |
| **Crisis · second overproduction, toward control** | Year 30 summer, pumpkins and tomatoes growing | Crisis 8 · Overproduction (pumpkin) | Overproduction −40 | A sales limit of 5, prices fixed at their values, pumpkin limited to 5 plots, one plot that must rest |

The presets' crisis turns are `crisisTurns` in `src/dev/presets.ts`, 6, 22, 37, 55, 70, 86, 101 and 119, the on-time turns above, for both families: Nora's first answer passes Drought 0, which leaves the water undrained and the second drought in summer. Earlier records fired at those turns, carry `shiftFirst`, with turnip as the blighted crop and pumpkin as the top crop. They hold only their picks, so standing rules from earlier answers apply, such as Blight 0's fee and rotation in the control presets after the blight, but one-time results do not: the land Eminent domain 0 took at crisis 3 is still on the farm.

To reach other outcomes, change the `pick` of each earlier record in the editor before **Apply state**. Integration checks the picks, and rejects a record later than the current season. Card IDs are the crisis initial plus the card key, such as `D-SOC` or `E-LIB-P`. An answered deal needs `:accept` or `:decline`. The same card every time passes, crisis by crisis, whether deals are taken or refused:

| Card every time | Crises 1 to 8 pass |
| --- | --- |
| Ada Kessler (`OBJ`) | +80 every time |
| Walt Finch (`LIB-P`) | +40 every time |
| June Calloway (`LIB-M`) | +40, +40, +40, +40, 0, 0, 0, 0 |
| Nora Delgado (`PRO-M`) | 0, 0, 0, 0, −40, −40, −40, −40 |
| Tom Brennan (`SOC`) | 0, 0, 0, −40, −40, −80, −80, −80 |

For example:

| Preset | Earlier picks | Then pick | Passes |
| --- | --- | --- | --- |
| Eminent domain | `D-LIB-P`, `B-LIB-P` | Nora Delgado | Eminent domain 0 |
| Second drought, toward control | `D-SOC`, `B-SOC`, `E-SOC`, `O-SOC` | Nora Delgado or Tom Brennan | Drought −40 |
| Price crash | `D-LIB-M`, `B-LIB-M`, `E-LIB-M:decline`, `O-LIB-M:decline`, `D-LIB-M` | June Calloway | Price crash 0 |
| Price crash | `D-PRO-M`, `B-PRO-M`, `E-PRO-M`, `O-PRO-M`, `D-PRO-M` | Nora Delgado | Price crash −40 |
| Second eminent domain, either family | `D-SOC`, `B-SOC`, `E-SOC`, `O-SOC`, `D-SOC`, `P-SOC` | Tom Brennan | Eminent domain −80 |
| Second overproduction, either family | The same, then `E-SOC` | Tom Brennan | Overproduction −80 |

Walt's and June's first-drought picks pass Drought +40, which drains the water and moves the second drought to spring; Nora's and Tom's pass Drought 0, which leaves it in summer. Both second-drought presets already sit in year 18 spring, so with draining picks the drought waits for year 19 spring: End turn four times, and it fires at turn 73, after winter has cleared the preset's crops.

Edited records carry no one-time results either: no taken land, loans, frozen prices or building counts. To try a rule on any farm without its crisis, choose **Macro · lifetime**, read the current state, and add it to `farmPolicy`, such as `{"sealedBuildings":["well"],"permitsRequired":true}`. Keep `crises` in the JSON: a macro edit without them clears them.

The development **Crisis test** in the top bar is separate. It plays the crisis layer from its own browser storage, lists each policy's effects as "not applied in this test", and never reads or changes the farm or its save. See [playtesting](playtesting.md#crisis-content).

Unit tests: `src/game/crisis.test.ts` (timing and catch-up, triggers, recovery, every policy, the moved rules with real answers, rules that meet, binding once, water, farm actions while the council waits), `src/game/state.test.ts` (records in saves, the waiting guard), `src/micro/council.test.ts` and `src/micro/money.test.ts` (farm rules, owed coins, quotes, delivery work), `src/contracts/world.test.ts` (policy fields, the hash), `src/crisis/*.test.ts` (meeting and Council rules), `src/game/crisis-scene.test.ts` and `src/dev/presets.test.ts` (every preset fires its crisis; the control family's harsher rules). Browser tests: `tests/browser/crisis-game.spec.ts` (meeting, waiting, deals, reload), `tests/browser/crisis-answers.spec.ts` (one check per crisis, the blight's seed rules), `tests/browser/crisis-rules.spec.ts` (water, permits, the county's crop, sales limits, droughts, delivery work) and `tests/browser/crisis-phone.spec.ts` (phones), sharing `tests/browser/crisis-helpers.ts` (screenshots only when `CRISIS_SCREENSHOTS_DIR` is set), `tests/browser/crisis-scene.spec.ts` (scene marks) and `tests/browser/crisis-trial.spec.ts` (the Crisis test).
