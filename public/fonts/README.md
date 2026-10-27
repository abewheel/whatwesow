# Game typography

`pixelify-sans.ttf` supplies the game font. `farm-readable.ttf` is a renamed,
modified subset under the same SIL Open Font License in `OFL.txt`. CSS uses the
subset for 0, 2, 5, 6, 7, and lowercase l at every game text size.
The other characters still use the original font.

The replacement 0 has a central dot, 2 has a flat base, 5 has a square top,
6 has a rising hook, 7 has a stepped diagonal, and lowercase l has a foot.
All keep the original variable character widths and baseline. Their pixel strokes
stay fixed across UI weights so their shape remains clear at small sizes.

To rebuild the subset, install `fonttools==4.68.0` in a Python environment and
run `python scripts/fonts/build-readable-font.py` from the repository root. Python
and FontTools are only needed when editing these glyphs.
