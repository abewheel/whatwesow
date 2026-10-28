# Integrating the crisis layer into the farm game

This folder is the crisis layer: the council debates, the Overton window, and the policy text. It has no farm in it. This document is the contract for wiring it into the farm game.

Three files cross over. Nothing else in this folder is needed by the farm game.

| File | What it is | How the farm game uses it |
|---|---|---|
| `content.json` | Every crisis, policy, argument, number and sentence | Load it as data. Never retype its contents |
| `engine.js` | The rules: how a pick moves the council and which policy passes | Call it. Or port it line by line and run `test.js` against the port |
| `test.js` | The acceptance tests from the design workbook | `npm test` must pass after any change to either file |

`index.html` is the prototype's screen. It calls the same engine functions the farm game will, so it doubles as a reference for what to show and when.

## 1. The shape of a crisis

1. The farm game decides a crisis fires (drought, blight, price crash, eminent domain, overproduction). The order in the prototype is fixed in `params.runOrder`. What We Sow keeps that order, fires one every four years, and picks the season from farm state (end of §4).
2. The player reads the crisis description and the hand of arguments, and picks one.
3. The engine works out which policy passes and how far the council's mood moved.
4. The farm game shows the result text, applies the policy's effects, and records any standing rule.
5. If the policy is an offer, the player accepts or declines before the game continues. Declining applies nothing.

## 2. Calling the engine

Load `content.json` into a global named `CONTENT` before loading `engine.js`. In Node:

```js
globalThis.CONTENT = require('./content.json');
const { Engine } = require('./engine.js');
```

In a page, `content.js` (generated from `content.json`, see the README) sets `window.CONTENT`, and `engine.js` sets `window.Engine`.

The engine keeps no state. The whole run is an array of picks, and every call replays it from the start. The farm game keeps that array in its save file.

```js
let picks = [];                                  // one entry per crisis played, in order

// When a crisis fires: the cards to show, in display order.
const hand = Engine.hand(crisisId, picks.length);   // five cards; show card.argument only

// When the player picks one:
picks.push(card.id);
let state = Engine.replay(picks);               // config optional; see §5
const record = state.ledger[state.ledger.length - 1];
const text = Engine.text.reveal(state);         // every sentence for the result screen, §3
let effects = Engine.effectsFor(record);        // what to apply to the farm, §4

// If text.offer === 'pending', ask the player, then store the answer on the pick:
picks[picks.length - 1] = card.id + ':accept';  // or ':decline'
state = Engine.replay(picks);
effects = Engine.effectsFor(state.ledger[state.ledger.length - 1]);
```

`Engine.replay` throws if a pick is not a card for that crisis. It never throws otherwise.

### What comes back

`state`:

| Field | Meaning |
|---|---|
| `center` | The council's mood after the last pick, on a −100…+100 scale (+ is freedom) |
| `ledger` | One record per crisis played, below |
| `standing` | Rules still in force: `{ crisisId, pos, policy, text }`. A repeated policy adds one entry, not two |
| `tilesTaken`, `tilesSold`, `tilesRemaining` | The prototype's stand-in for farm damage. The farm game applies the effects instead and can ignore these |
| `done` | True after the last crisis in `params.runOrder` |

`record` (one ledger entry):

| Field | Meaning |
|---|---|
| `crisisId`, `cardId` | What fired and what the player said |
| `before`, `after`, `net` | The council's mood before and after this pick, and the move |
| `ask`, `askSource`, `inWindow` | What was asked for and whether the council was open to it (`null` under the `center` rule) |
| `enactedPos`, `enactedName` | The policy that passed: its position and its name |
| `offer`, `accepted` | Whether it was an offer, and `true` / `false` / `null` (not yet answered) |
| `attributionCrisis` | Which earlier crisis's argument put the ask out of reach, or `null` |

## 3. Text

`Engine.text.reveal(state)` returns plain strings, in the order the result screen shows them. The farm game decides the layout; the words are settled here.

| Field | What it is | Show it |
|---|---|---|
| `heading` | "Crisis 3 of 8: Eminent domain" | As the title |
| `argument`, `label` | The player's argument, and who made it: "Objectivist · Your rights" | The label only after the pick, never on the hand |
| `opposition` | The case for control, made every crisis: `{ lead, argument, label }`. `null` when the player picked it | After the player's argument |
| `answer` | Whether the player answered the case for control, by the kind of argument they made | One line |
| `shift` | How far each side moved the council, and where it sits now | One line |
| `resolution` | What was asked for and what passed | One line |
| `attribution` | Which earlier argument put the ask out of reach, quoting it. Empty when there is nothing to say | One line, when present |
| `immediateHeading`, `immediate` | "What happens to you" and the policy's immediate effect in words | Before the effects land |
| `offer`, `offerResult` | `null`, `'pending'`, `'accepted'` or `'declined'`, and the sentence for an answered offer | Accept / Decline buttons while pending |
| `standing` | The standing rules as sentences | On the farm screen, under "Rules you still have to follow" |

For the crisis screen itself: `crisis.trigger` is the description, `card.argument` the text of each card in the hand, and `strings.handHeading` / `strings.handHint` the heading and prompt. If the same crisis has fired before, `strings.facedBefore` takes the policy name that passed last time.

All sentence templates live in `content.json` under `strings`. Placeholders in `{braces}` are filled by the engine. Edit the wording there, not in code.

Two labels in `strings` are worth knowing: `premiseLabel` names the five kinds of argument, and a card's optional `personaLabel` overrides its persona name on screen (the two libertarian cards use it).

## 4. Effects

Every policy in `content.json` carries an `effects` list. This is the authoritative description of what the policy does to the farm. The older `modifier` string on each policy is a human note and should not be parsed.

`Engine.effectsFor(record)` returns the list to apply for a ledger record. It leaves out effects marked `onAccept` unless the offer was accepted, so the farm game can apply whatever comes back without checking the offer itself.

Each effect has a `type`, a `duration`, and its own fields. Fields with defaults may be left out; the farm game uses the default shown.

`duration` is one of:

| Value | Meaning |
|---|---|
| `once` | Apply when the pick (or the offer's answer) is committed, one time |
| `season` | Lasts the season the crisis fired in |
| `crisis` | Lasts as long as the crisis's own effect does: Drought 1 season (2 after `aquiferDrain`), Price crash 2, Overproduction 2, Blight until its recovery seasons have passed, counted in the blighted crop's planting seasons |
| `standing` | Permanent from the season the pick was committed. Also listed in `state.standing` in words. A policy that passes twice binds once, and an offer binds only once accepted, so a declined offer does not count toward that. What We Sow counts Overproduction's per crop |

Effect types, with the policy that uses each:

| Type | Fields | Meaning | Used by |
|---|---|---|---|
| `unlockAction` | `action` | The player gains an action: `tradeWaterRights`, `drillWell`, `premiumSeed`, `forwardContract` | Drought +80, +40; Blight +80; Price crash +40 |
| | `buy` (12), `sell` (6) | `tradeWaterRights`: coins per thirsty crop to buy water in a drought, or earned by selling it. In What We Sow, bought water reaches the crops growing when it is bought, and selling gives up every other source of water that season (wells, water at cost) | Drought +80 |
| | `seedMult` (1.5), `yieldMult` (1.3), `failOneIn` (8) | `premiumSeed`: seed price and yield multipliers, and about one planting in `failOneIn` dies of disease | Blight +80 |
| | `mult` (0.85), `seasons` (4) | `forwardContract`: during the crash's seasons, lock this share of the normal price for this many seasons | Price crash +40 |
| `lockAction` | `action` | The player loses an action: `tradeWater`, `drillWell`. Removes the matching unlock from an earlier policy | Drought 0, −40, −80 |
| `aquiferDrain` | `droughtSeasons` | Later droughts last this many seasons. What We Sow then starts the next drought in spring, so both seasons have thirsty crops growing | Drought +40 |
| `sealBuilding` | `building` | Buildings of this kind stay but give no benefits | Drought 0, −40, −80 |
| `waterAtCost` | | Water is sold at cost while the effect lasts: thirsty crops are protected from the drought for 1 coin each, unless the player sold their water rights. Drought 0 uses `duration: crisis`, so it covers both seasons of a drained drought | Drought 0 |
| `fee` | `per` (`tick`, `planting`, `tileAboveCap`), `amount`, `crop`, `cap` | A recurring charge: a water bill each season, a fee per planting, or 5 coins per tile of `crop` above `cap` each season | Drought 0; Blight 0, −40; Overproduction 0 |
| `waterTax` | `schedule: rising` | A tax on each unit pumped, at a rate that rises with the amount pumped: n(n+1)/2 coins for n watered thirsty tiles each season | Drought −40 |
| `irrigationCap` | `fraction` | Only this fraction of planted water-hungry tiles can be watered, rounded to the nearest whole tile; the rest wither | Drought −40 (what the tax makes affordable), −80 |
| `recoverySeasons` | `seasons` | How long the blighted crop takes to grow back (default is two), counted in that crop's own planting seasons | Blight 0, −40 |
| `permitDelay` | `on: plant` | Every planting needs a permit, filed at the council office the season before. The season the rule passes is covered | Blight −40; Eminent domain −40, −80 |
| `cropRotation` | | The same crop can't be planted twice in a row in one tile. What We Sow exempts the crop `cropChoiceLocked` names | Blight 0, −40 |
| `fine` | `perPlanting` | Planting against a rule costs this many times the crop's base sale instead of being refused | Blight 0, −40, −80; Eminent domain −40, −80; Overproduction −40, −80 |
| `freeSeed` | | Replacement seed costs nothing | Blight −80; Eminent domain −40, −80 |
| `cropChoiceLocked` | | The player no longer chooses crops: one plantable crop is named each season, a different one each year. What We Sow skips a crop another rule bans, blocks while it recovers, caps, or charges a fee past a cap, by naming the next crop in order | Blight −80; Eminent domain −40, −80 |
| `yieldMult` | `mult` | Every crop harvest yields this multiple | Blight 0, −40, −80 |
| `loan` | `repayOverSeasons` | Cash now (100 coins, or 20 per tile if more), repaid in equal parts over that many seasons | Price crash 0 |
| `priceFloor` | `mult` | Sale prices can't fall below this multiple of normal (the crash alone would be 0.6) | Price crash −40 |
| `harvestTax` | `rate`, `fund` | This share of every harvest's income goes to the named fund | Price crash −40 |
| `priceFixed` | `level` (`preCrash`, `current`) | Each crop's price is frozen at its value when the policy passes, before any crash or glut cut, and no multiplier lifts a sale above normal. `level` is only a label. In What We Sow a crash's cut is cancelled, while a glut's still runs its two seasons | Price crash −80 (`preCrash`); Overproduction −40, −80 (`current`) |
| `sellViaBoard` | | All sales go through the state board | Price crash −80 |
| `quota` | `varies`, `progress` | The player may make only so many sales each season. `varies`: the allowance changes every season; `false` keeps it steady. `progress: false`: sales over it earn nothing and don't count toward upgrades | Price crash −80; Overproduction −40 (steady), −80 |
| `seedCostMult` | `mult` | Seed costs this multiple | Blight +40, 0, −40 (1.25); Price crash −80 (1.5) |
| `sellTiles` | `count`, `selection`, `cashPerTile`, `onAccept` | The player sells tiles at this multiple of value. Only if accepted | Eminent domain +40 |
| `removeTiles` | `count`, `selection` (`edge`, `random`, `mostProductive`), `cashPerTile` | Tiles are taken, with this much cash per tile | Eminent domain 0, −40, −80 |
| `buildDelay` | `seasons` | New buildings and upgrades take this many seasons longer | Eminent domain −40 |
| `buildingCap` | | No more buildings of any kind than the farm has when the policy passes | Eminent domain −80 |
| `priceMult` | `crop`, `mult`, `onAccept` | The named crop sells at this multiple. Only if accepted | Overproduction +40 |
| `maxTilesPerCrop` | `crop`, `tiles`, `onAccept` on the offer | The named crop may not be planted on more tiles than this | Overproduction +40 (if accepted), −40 |
| `sellDelay` | `on: excess` | Sales of the top crop are held until the next season while it is planted on more than 5 tiles, the fee's cap. What We Sow keeps one hold per crop | Overproduction 0 |
| `destroyCrop` | `crop`, `aboveTiles` | Tiles of the crop beyond this count are destroyed now (0 means all) | Overproduction −40, −80 |
| `banCrop` | `crop` | The crop may not be planted | Overproduction −80 |
| `fallow` | `share` | This share of tiles must stay empty each season | Overproduction −40 |
| `confiscateAboveAverage` | `fraction` | This share of output above the valley average is taken at each harvest | Overproduction −80 |
| `freezeUpgrades` | | Buildings can't be upgraded; new ones can still be built | Overproduction −80 |

`crop: top` means the player's most valuable crop at the time the crisis fires. `amount: small` and the unnamed fee sizes are left for the farm game to tune.

The crises' own triggers act before any pick: a drought dries unprotected thirsty crops to half yield, the blight kills every tile of the most planted crop and blocks it for its recovery seasons, the price crash cuts every sale to 0.6 for two seasons, and overproduction cuts the top crop's price to 0.75 for two seasons. Eminent domain does nothing until a policy passes.

What We Sow fires one crisis every four years, in years 2, 6, 10, 14, 18, 22, 26 and 30, at the start of a season where it can hurt: drought, blight and the price crash in summer (a drought after `aquiferDrain` in spring), eminent domain in spring, or in summer when the farm has fewer than 6 plots, and overproduction in fall. A farm condition can delay a crisis only to a later season of its year. A save behind schedule catches up one year apart, and nothing fires after year 30. Farm actions wait while a crisis or its offer is unanswered. See [crises](../docs/crises.md#when-each-crisis-fires).

### What the farm game must have for these to work

What We Sow implements these in `src/micro` (farm rules), `src/contracts/farm-policy.ts` (the policy fields) and `src/game/crisis.ts` with `src/game/crisis-rules.ts` (timing, and effects compiled into those fields). It has:

- Money with a debt: seasonal charges the coins can't cover become owed coins, and income pays them first.
- A harvest sale chain: per-crop price multipliers, fixed prices with a ceiling, a yield multiplier, a harvest tax, a cap holding a crop's base value to its base sale, a per-season quota counter, and sales held until the next season. The relief fund, loan, price floor, quota and forward contract all hang off it.
- Thirsty crops (corn, tomato, pumpkin), dry and withered tiles, and water trades in a drought season (bought water reaches the tiles growing when it is bought), so the irrigation cap, pumping tax, water at cost and drought wells have something to act on.
- A per-crop tile count and a last crop per tile, for the caps, the ban, fallow tiles and rotation.
- Planting rules that either block or fine, a planting fee, a seed price multiplier and premium seed.
- Planting permits and a council office to file them, shown only while permits are required.
- Building rules: sealed kinds, extra construction seasons, frozen upgrades, unlocked kinds and building limits.
- Tile value: the price of new land plus the crop's sale, for `selection: mostProductive` and `cashPerTile`, and taken cells that leave the farm.

The prototype's `tilesLost` and `offerTiles` numbers on each policy are stand-ins that let the prototype show land changing hands on a 24-tile farm. They are not part of the contract. The farm game derives land changes from the effects.

## 5. Settings

`Engine.replay(picks, config)` takes an optional `config`. Without one it uses `params` from `content.json` and the `proposal` rule. The fields:

| Field | Default | Meaning |
|---|---|---|
| `resolution` | `proposal` | `proposal`: the player's card asks for a policy. `lobby`: a named interest group asks, the same every time. `center`: whatever is nearest the council's mood passes |
| `order` | By rule | `resolveThenShift` (the argument shapes the next crisis) or `shiftThenResolve` (it shapes this one) |
| `startCenter`, `halfWidth`, `oppositionShift`, `spacing`, `extreme` | From `params` | The window's start, half-width, the case for control's push, and the policy grid |
| `acceptOffers` | unset | For headless runs only: `true` or `false` answers every offer |

The farm game should pass whatever it wants fixed and leave the rest. What We Sow passes `order: 'shiftThenResolve'`, so an argument moves the council before it votes, except in saves whose first crisis fired before it made that change. Keep `startCenter` in `content.json` as the designer's setting; it is the main lever for how hard the game is.

## 6. Keeping the two in step

- Change wording or numbers in `content.json` only, then regenerate `content.js` with `npm run content`. The engine, the prototype and the farm game all read the same file.
- Run `npm test` after any change to `content.json` or `engine.js`. It replays the three runs from the design workbook and fails if any number differs. The reference runs for the other rules print alongside; those may legitimately change when the designer retunes.
- If the engine is ported to another language, port `test.js` too and keep both passing. The window arithmetic is small but easy to get subtly wrong, and the attribution logic (which earlier argument is quoted) is the part a port is most likely to miss.
- `params.handKeys` controls which five cards are in the hand and their order. The farm game should use `Engine.hand` rather than filtering cards itself, so a change there carries over.
