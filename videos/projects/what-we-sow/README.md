# What We Sow: Build the case

A 55-second, 1920 × 1080 film at 30 fps for the Principled Business Summit.
The user requested a visual-first film with very few words. The talk track is captioned; there is no PiP
or spoken narration. Real gameplay, readable council arguments, and a direct
corn-to-seized-ground comparison carry the story.

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
It captures the three opening stages and the rights selection without an apple tree. Browser errors fail the run. `CAPTURE_FROM=branches` refreshes only the council takes. Stop the dev instance afterward.

`node scripts/build.mjs` cuts the raw takes and writes the six editable HTML
scenes. `edits.json` records source timecodes and constant retiming. A build
needs the original local WebM takes; a render only needs the selected clips.
Recapture before rebuilding on a different game commit, and recalibrate raw
recording timestamps against actual frames. Do not treat video recorder
wall-clock marks as frame-exact timestamps.

The current 55-second film uses gameplay re-recorded at 2fe1cbc, including the latest walking art, HUD and explicit tile actions. SCRIPT.md contains its exact captions. `node scripts/capture-confiscation.mjs` records a uniform-corn fixture with a 256-field square removed from its northeast corner. This stages scale without changing production rules. The tracked seed is fixtures/confiscation-seed.json.

`node scripts/capture-estate.mjs` refreshes the year-nine estate and actual male-farmer harvests. Its valid save is fixtures/estate.json. Tree nameplates are now absent in the game itself; no source interception is used.

Run capture-revision.mjs, capture-estate.mjs and capture-confiscation.mjs before build.mjs to refresh all selected media. `SKIP_CUTS=1 node scripts/build.mjs` rewrites the editable scenes without recutting the clips. Review each new capture and recalibrate recording timecodes as needed. The generator verifies that each output clip has its declared duration.

The loss shot uses a tight matching crop with no village or mixed crops. The updated county/drought captions are in SCRIPT.md. The live /video page uses the separately compressed web copy under public/media; preserve its 25 MiB per-file hosting limit when updating it.
