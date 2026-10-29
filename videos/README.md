# Demo video

This directory keeps video tools separate from the shipped game. The planned
film is 55 seconds for the Principled Business Summit hackathon judges. The
[production project](projects/what-we-sow/README.md) contains the complete
visual-first cut, editable scenes, capture recipes, and review notes. Its
[storyboard](STORYBOARD.md) applies the audience, thesis, goals, and approach
in [AGENTS.md](../AGENTS.md#hackathon-audience-thesis-and-goals). The completed
cut uses real gameplay, music, and sparse labels, with no PiP or narration.
Delivery files and raw captures remain local; the source archive restores
the media needed to render.

## Record gameplay

From the repository root, install the game dependencies and Chromium as described
in [development](../docs/development.md). Then run:

```sh
pnpm exec playwright test --config videos/capture.config.mjs
```

The recorder starts its own Vite server on port 5197, refuses to reuse an existing
server, waits for readiness, uses a fresh browser context and a unique
`validation-video-*` save, records at 1920 × 1080, and stops the server afterward.
Set `VIDEO_PORT=5198` to use another free port. It does not touch a running farm.
Each run replaces `videos/output/`, so copy wanted takes elsewhere before rerunning.

The `first-field` shot checks the pipeline by opening a new farm and buying a
field through real controls. It saves a WebM, before/after PNGs, and an attached
JSON metadata file containing the source commit, dirty status, event timings,
and browser diagnostics. Inspect terminal server output too. Errors fail the
capture; screenshots alone do not prove a successful run. Event times measure
the scenario clock, not exact encoded frame positions. Trim loading and setup
from the recorded video using a frame inspection before assembling it.

Add one `.spec.mjs` per shot in `shots/`; select takes with Playwright's `--grep`.
Assert the visible result after each action. Use short timed holds only for
editorial breathing room, never to guess when planting, walking, or saving ended.
Playwright's native mouse is not baked into video, so any later cursor overlay
must use recorded target coordinates and action timing. Do not add a decorative
cursor that implies actions the player never took.

For advanced starting states, use the existing development-only
[playtest recipes](../docs/playtesting.md). Load the preset before the usable
take, close the tools, then record the actual action and consequence. Preserve
the starting save and preset ID beside each selected take. Do not use the
standalone Crisis test as evidence of rules affecting the farm: it does not
apply those rules. Use an in-game council meeting and its resulting farm instead.

## Prepare HyperFrames

The video tool package pins HyperFrames independently of the game's dependencies:

```sh
pnpm --dir videos install --frozen-lockfile
pnpm --dir videos exec hyperframes --version
```

When the brief arrives, enter through the HyperFrames skill, create one project
under `projects/`, and use the game's own artwork and fonts. No composition is
created by this preparation step. From a project directory, use the installed
CLI at `../../node_modules/.bin/hyperframes` for `init`, `check`, `preview`, and
`render`; consult `--help` for the pinned version's arguments. Before a future
render session, follow the skill's version check and composition contract.

Keep raw footage in ignored `output/`; keep selected local media under a
project's ignored `assets/local/`. Commit an asset manifest recording each
selected file's relative path, SHA-256, source commit, starting state, action,
visible proof, and chosen in/out timecodes. Include restoration instructions
so a clean clone can recover the files. Keep source, planning, and manifests
in Git; keep captures, narration, and renders local until delivery is chosen.

The reusable workflow is: brief, claim-to-shot map, reproducible capture,
proof review, composition, checked preview, and export. Use full-frame gameplay
with readable close-ups that retain enough UI context to explain the result.
Keep labels clear of the farm controls, coins, year, and council choices.

## When gameplay changes

Fetch main again and compare it with this branch. Preserve this work and bring
in the settled game changes deliberately. Record the chosen commit and rerun
the capture smoke check, then rebuild selected states against that commit.
Old footage and changed rules must not be mixed as if they came from one build.

Use the draft storyboard to fill the capture map for each point:

| Point | Starting state | Player action | Visible proof | Source take / timecodes |
| --- | --- | --- | --- | --- |
| Fun and broad appeal | Farming preset | Plant, harvest, reinvest | Crops, coins, expansion | Production edits.json, 0–21s |
| Moral defense of capitalism | Eminent-domain council | Choose the land-rights argument | Policy and retained fields | Production edits.json, 25–43s |
| Learn arguments through consequences | Matched council branches | Choose contrasting arguments | Actual land and compensation changes | Production edits.json, 43–55s |

Treat the one-minute maximum as a constraint when choosing the points. A conceptual
claim needs an actual action and a readable result on screen. Long-term contrasts
need labelled time jumps or matched starting saves with the differing decisions
recorded. Do not imply a simulated lifetime is a continuous one-minute playthrough.

Run the game validation after substantive tool or game changes. For the film,
run HyperFrames checks, inspect every shot and transition in preview, review the
assembled cut, and verify the exported duration, frame rate, audio, and final
frame. Keep narration and final shot selection open for review.
