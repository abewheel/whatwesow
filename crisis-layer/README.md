# Discourse Layer — crisis-layer prototype

Open `index.html` by double-click. No server, no build step.

Files:

- `index.html` — the prototype's screens. It loads `content.js` and `engine.js`.
- `engine.js` — the rules, with no page code in it. The farm game uses this file; see `INTEGRATION.md`.
- `content.json` — every crisis, policy, argument, number and sentence. `content.js` is generated from it.
- `test.js` — the acceptance tests from the brief. Run with `npm test`.
- `INTEGRATION.md` — the contract for wiring the crisis layer into the farm game.

## Editing content

All text and numbers live in `content.json`. The page reads `content.js`, which is generated from it. After editing `content.json`, regenerate:

```
node -e "const c=require('./content.json');require('fs').writeFileSync('content.js','window.CONTENT = '+JSON.stringify(c,null,2)+';\n')"
```

or `npm run content`. Then reload the page.

`params.handKeys` lists which arguments the player can choose from each crisis (`OBJ`, `LIB-P`, `LIB-M`, `PRO-P`, `PRO-M`, `SOC`), and they are shown in that order. It is set to five: everything but the Progressive's experts card. Remove it to show all six, shuffled. A card's optional `personaLabel` is the name shown for it after a pick and in the report; the two libertarian cards use it to tell them apart. The `SOC` argument is shown after every pick that is not `SOC` itself, whether or not it is in the list. Cards left out of the list stay in the file and still work in the console runner.

Every policy has an `effects` list: the structured version of what it does to the farm, used for integration. The `modifier` string next to it is a human note. Debug mode shows the effects.

`content.json` has a `strings` section on top of the brief's schema: the reveal sentences, answer lines, attribution lines and farm labels. Placeholders in `{braces}` are filled in by the page.

## Debug mode

Toggle in the top-right corner (remembered in this browser). Shows every card's numbers and a lookahead line, a settings panel (rule, order, start center, half-width, opposition shift, spacing, extreme), policy modifiers, and the live ledger.

The address bar holds the picks and any non-default settings, e.g. `index.html#rule=lobby&start=50&picks=D-OBJ,B-OBJ`. Copy it to share a run. An answered offer is stored on its pick as `:accept` or `:decline`.

## Console

- `sim.tests()` — the acceptance tests from the brief; returns `true` when the engine is right. Also prints the reference runs for the other rules. The same tests run from the command line with `npm test`.
- `sim.run("LIB-M", { resolution: "lobby", startCenter: 50 })` — one headless run. The strategy can be a card key, an array of eight keys or card ids, or a function `(state, cards) => card`.
- `sim.compare(["OBJ", "LIB-P", "LIB-M"], { resolution: "center" })` — prints a table.

Headless runs accept every offer; pass `acceptOffers: false` to decline.
