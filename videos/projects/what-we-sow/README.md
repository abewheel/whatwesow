# What We Sow: Build the case

A 60-second, 1920 × 1080 film at 30 fps for the Principled Business Summit.
The user requested a visual-first film with very few words. The talk track is captioned; there is no PiP
or spoken narration. Real gameplay, readable council arguments, and a direct
soil-to-water comparison carry the story.

Start with [STORYBOARD.md](STORYBOARD.md), [SPEC.md](SPEC.md), and the final
[REVIEW.md](REVIEW.md). [CREDITS.md](CREDITS.md) records outside media and
licenses. HyperFrames was upgraded from 0.8.212 to 0.8.214 and checked.

## Render and edit

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --dir videos install --frozen-lockfile
```

Then from this project directory:

```sh
../../node_modules/.bin/hyperframes check --json
../../node_modules/.bin/hyperframes preview --background --port 3197
../../node_modules/.bin/hyperframes render --quality high --output renders/what-we-sow.mp4
../../node_modules/.bin/hyperframes preview --stop
```

All render media is local under `assets/local/`, which Git ignores. The media
manifest includes checksums. The delivery source archive restores the selected
local clips, score, and council plate; it renders without the raw recordings.
No remote media or font fetch is required by the composition.

To recapture, run the game's documented named dev instance, then run
`FILM_URL='<printed URL>' node scripts/capture-revision.mjs` from this directory.
It captures the four male-farmer stages and both council choices without an apple tree. Browser errors fail the run. `CAPTURE_FROM=branches` refreshes only the council takes. Stop the dev instance afterward.

`node scripts/build.mjs` cuts the raw takes and writes the six editable HTML
scenes. `edits.json` records source timecodes and constant retiming. A build
needs the original local WebM takes; a render only needs the selected clips.
Recapture before rebuilding on a different game commit, and recalibrate raw
recording timestamps against actual frames. Do not treat video recorder
wall-clock marks as frame-exact timestamps.

The current draft awaits the visual refresh for re-recording. `node scripts/capture-confiscation.mjs` captures the dense 2,560-field cinematic fixture and its 400-field square loss. This deliberately stages scale without changing production rules. `SKIP_CUTS=1 node scripts/build.mjs` updates the edit from existing local clips. The alternate-choice beat is removed and the outro matches the start menu’s dark gradient.

The confiscation capture seed is tracked at `fixtures/confiscation-seed.json`, so this shot can be re-recorded without the old raw recordings. The script writes the full before/after saves next to its local captures.

`node scripts/capture-estate.mjs` refreshes the year-24 estate and its real male-farmer harvests. Its valid save is tracked at fixtures/estate.json. Filming suppresses constant tree labels only; game code stays intact. Run this before build.mjs.
