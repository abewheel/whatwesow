# Playtesting recipes

Launch an isolated instance:

```sh
pnpm dev --instance validation-my-feature
```

Keep its printed query string. Open **Playtest tools**, choose **Work on**, and edit JSON. **Apply state** validates, persists, and renders the change. Invalid input leaves the current game and save untouched. **Read current state** discards editor changes and reads the live state. Switching domains also refreshes the editor.

| Scope | Example JSON | Preserves |
| --- | --- | --- |
| Micro · farming | `{"coins":777}` | Current year and season |
| Macro · lifetime | `{"year":20,"season":"fall"}` | Current coins |
| Whole game | `{"version":1,"year":40,"season":"winter","coins":12000}` | Nothing; replaces the save |

**Load preset** fills the editor for the selected scope without applying it. Presets cover a new farm, year 20 fall, and year 40 winter. For arbitrary supported states, edit those values. Extra fields are stripped, including fields owned by the other domain. Export save downloads the complete state for sharing; Import save accepts a complete version 1 save.

## Fast rule iteration

```sh
pnpm test:micro
pnpm test:macro
pnpm test:integration
pnpm exec vitest src/micro # watch while editing
pnpm validate
```

Import the owning domain's parser and initial state directly in unit tests. Use integration tests for interactions between domains. See [ownership and contracts](game-boundaries.md) before extending the schema.

## Browser and agent iteration

Use Playwright against your own named instance. Wait for `#save-status` to read `Saved on this browser`, then select `Work on`, fill `Game state JSON`, and click `Apply state`. Wait for `#dev-status` to report success and inspect `#season` and the farm canvas. The regression example is `tests/browser/shell.spec.ts`.

Check invalid input, switching scopes, persistence after reload, import/export when touched, console errors, failed requests, and server logs. Capture screenshots with Playwright and inspect each image. Stop the named instance afterward. Playtest code is dynamically imported only in development; production tests verify tools are absent and instance parameters cannot split player saves.

State is local to the instance and origin. A different port has different storage. Use export/import for a durable handoff to your co-builder.
