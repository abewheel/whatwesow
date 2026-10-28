# Micro and macro ownership

Start with [development](development.md) to run the game. For state recipes and browser automation, continue to [playtesting](playtesting.md).

| Work | Owner | Entry point |
| --- | --- | --- |
| Money, crops, plots, soil improvements, farming actions | Micro builder | `src/micro/state.ts` |
| Calendar, future dialogue, choices, community, legacy | Macro builder | `src/macro/state.ts` |
| Save schema, coordination between domains | Shared, agree before changing | `src/game/state.ts` |
| Crisis timing, answers, and the farm rules they impose | Integration, agree before changing | `src/game/crisis.ts`, `src/game/crisis-rules.ts` |
| Crisis wording, policies, effects, council window math | Crisis layer; the game loads it as data | `crisis-layer/content.json`, `crisis-layer/engine.js` |
| Council meeting, Council rules, crisis engine loading | Shared presentation | `src/crisis/` |
| Farm drawing | Micro presentation | `src/game/scene.ts` |
| Startup, persistence, shared HTML | Shared | `src/main.ts`, `src/storage/` |
| Playtest editor | Shared infrastructure | `src/dev/` |

The [micro game](micro-game.md) supports planting, growth, harvests, placed structures, repeated builds, land expansion, and soil improvements. Macro owns the calendar, farm policy, and crisis records. Integration applies policy decisions and farming losses atomically. [Council crises](crises.md) are the first authored decisions: integration fires them, commits answers, and derives their farm rules from the records. Other narrative events are still to come.

## Domain contract

Each domain exports its own state type, fresh initial state, and unknown-input parser. Parsers return only owned fields. Add pure rules and authored data under your domain, with tests beside them. Rules must return fresh state and must not access the DOM, Phaser, browser storage, or the other domain.

ESLint blocks imports from the other domain, integration, storage, development tools, and Phaser in domain modules. Put presentation code outside these modules. Both builders can run `pnpm test:micro` or `pnpm test:macro` without a browser. Use `pnpm test:integration` for composition and save compatibility.

## Integration contract

`GameState` is the version 3 save envelope. Its optional `buildingLayout` revision migrates older building reservations once; individual structure footprints preserve compact historical lots when a fully occupied estate cannot expand them. Integration migrates version 1 and 2 saves while preserving coins and calendar. Do not persist separate domain saves. `readDomain` projects a domain, and `replaceDomain` validates an edit and merges only owned fields into the latest whole state. Neither mutates its input.

The scene receives micro state, calendar, and the merged policy for drawing. UI and storage coordinate through integration. When a feature spans both domains, add an explicit typed input/output in the integration layer and test the resulting whole-state transition. Use `farmContext` to project the calendar, policy and this season's water into pure farming rules; its policy is `farmPolicy` merged with the crisis rules for the turn. Send farm actions through `actOnGame`, which refuses them while the council waits for an answer. Use `advanceSeason` for seasonal income and charges, `endTurn` to advance and fire a due crisis, `answerCrisis` and `answerOffer` to commit council answers, and `applyMacroChange` to commit macro policy, land revocation, and object losses together. Never write crisis rules into `farmPolicy`; they are derived from the records. Read [the macro contract](macro-farm-contract.md) before implementing consequences. Do not let narrative code directly edit farming fields or let a scene advance the calendar.

Agree on new shared inputs, effects, save migrations, and shared UI changes before implementing them. Keep effects concrete, such as a price multiplier or land availability, and define their defaults, timing, and bounds with tests. Avoid adding speculative event buses or generic effect systems before a playable feature needs them.

## Adding state

Add fields and validation to the owning domain, then update its initial state and tests. Update save composition and migration in integration deliberately: existing version 1 saves must still load, or receive an explicit migration. Add scenario presets only when they describe real, supported state. Run full validation and the changed browser paths before handing work over.
