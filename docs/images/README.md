# README screenshots

Both images are unretouched, full-viewport Playwright screenshots of the game
at `b716c41`, captured October 28, 2026. They use staged development saves.
Building art, farmer, crops, and UI keep their actual in-game proportions;
there is no editorial crop, image stretching, or individual asset resizing.
The design reference `art-direction.png` remains available to AGENTS.md.

The capture lives in `videos/projects/what-we-sow/scripts/capture.mjs` and
starts from the game's `harvesting` and `crisis-3` presets. Start your own
named instance using [development](../development.md), then run the capture
with its URL in `FILM_URL`.

- Farm: full 1280 × 800 viewport, 150% native View zoom. Summer, year 7,
  female farmer, nine ripe mixed turnip/carrot/corn plots, 31 coins, and
  a player-built layout (`selfBuilt: true`). Pan the real farm to center its
  field patch at 46% of the viewport width and 67% of its height.
- Council: full 1920 × 1080 viewport. Load `crisis-3`, use earlier picks
  `D-LIB-P` and `B-LIB-P`, and End turn at home to open the integrated council.

The staged farm layout leaves room between the buildings:

| ID | Kind | Row | Column | Level |
| --- | --- | --- | --- | --- |
| 1 | `home` | 11 | 14 | 1 |
| 2 | `shed` | 12 | 10 | 1 |
| 3 | `coop` | 10 | 20 | 1 |
| 4 | `apple` | 19 | 14 | 1 |

Set `nextStructureId: 5`. Setup tools and the separate development Crisis test
button are hidden for capture; player-facing UI stays intact. Inspect saved
images, console errors, failed requests, and instance logs, then stop the
instance. Update this provenance when the images change.

The current farm screenshot was refreshed at native 1280 × 800, 100% game zoom, with the male farmer, 81 fields and nine spaced buildings. It excludes the apple tree and uses no editorial sprite resizing.
