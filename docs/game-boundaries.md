# Micro and macro ownership

Start with [development](development.md) to run the game. For state recipes and browser automation, continue to [playtesting](playtesting.md).

| Work | Owner | Entry point |
| --- | --- | --- |
| Money, future crops, plots, buildings, farming actions | Micro builder | `src/micro/state.ts` |
| Calendar, future dialogue, choices, community, legacy | Macro builder | `src/macro/state.ts` |
| Save schema, coordination between domains | Shared, agree before changing | `src/game/state.ts` |
| Farm drawing | Micro presentation | `src/game/scene.ts` |
| Startup, persistence, shared HTML | Shared | `src/main.ts`, `src/storage/` |
| Playtest editor | Shared infrastructure | `src/dev/` |

The game currently has a rendering shell, a coin balance, and a calendar. These boundaries establish ownership for the next gameplay work; there are no farming actions or narrative transitions yet.

## Domain contract

Each domain exports its own state type, fresh initial state, and unknown-input parser. Parsers return only owned fields. Add pure rules and authored data under your domain, with tests beside them. Rules must return fresh state and must not access the DOM, Phaser, browser storage, or the other domain.

ESLint blocks imports from the other domain, integration, storage, development tools, and Phaser in domain modules. Put presentation code outside these modules. Both builders can run `pnpm test:micro` or `pnpm test:macro` without a browser. Use `pnpm test:integration` for composition and save compatibility.

## Integration contract

`GameState` is the version 1 save envelope. It stays flat for existing save compatibility; do not persist separate domain saves. `readDomain` projects a domain, and `replaceDomain` validates an edit and merges only owned fields into the latest whole state. Neither mutates its input.

The scene receives only the calendar shape it needs. UI and storage coordinate through integration. When a feature spans both domains, add an explicit typed input/output in the integration layer and test the resulting whole-state transition. For example, a future season transition can pass the calendar and authored farming modifiers into a pure farming rule, then validate both outputs before saving once. Do not let narrative code directly edit farming fields or let a scene advance the calendar.

Agree on new shared inputs, effects, save migrations, and shared UI changes before implementing them. Keep effects concrete, such as a price multiplier or land availability, and define their defaults, timing, and bounds with tests. Avoid adding speculative event buses or generic effect systems before a playable feature needs them.

## Adding state

Add fields and validation to the owning domain, then update its initial state and tests. Update save composition and migration in integration deliberately: existing version 1 saves must still load, or receive an explicit migration. Add scenario presets only when they describe real, supported state. Run full validation and the changed browser paths before handing work over.
