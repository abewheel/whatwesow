"""Rebuild the readability overlay: python -m pip install fonttools==4.68.0.

Run from the repository root. The original font and its license stay intact.
"""

from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

font = TTFont('public/fonts/pixelify-sans.ttf')
# Decode original deltas before replacing outlines with different point counts.
font['gvar'].ensureDecompiled()
# Keep the original advance, baseline, cap height, and 100-unit pixel strokes.
# A flat-footed 2 and stepped diagonal 7 stay distinct at small UI sizes.
outlines = {
    'two': [(60, 531), (160, 531), (160, 631), (425, 631),
            (425, 531), (525, 531), (525, 331), (425, 331),
            (425, 231), (260, 231), (260, 131), (160, 131),
            (160, 88), (525, 88), (525, -12), (60, -12),
            (60, 231), (160, 231), (160, 331), (325, 331),
            (325, 431), (425, 431), (425, 531), (160, 531),
            (160, 431), (60, 431)],
    'seven': [(60, 631), (525, 631), (525, 431), (425, 431),
              (425, 231), (325, 231), (325, -12), (225, -12),
              (225, 231), (325, 231), (325, 431), (425, 431),
              (425, 531), (60, 531)],
}
for name, points in outlines.items():
    pen = TTGlyphPen(None)
    pen.moveTo(points[0])
    for point in points[1:]:
        pen.lineTo(point)
    pen.closePath()
    font['glyf'][name] = pen.glyph()

# Draw a dotted zero and angular 5 and 6 on the same pixel grid.
# Separate filled cells share edges, so there are no overlapping outlines.
patterns = {
    'zero': ['01110', '10001', '10001', '10101', '10001', '10001', '01110'],
    'five': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
    'six': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
}
for name, rows in patterns.items():
    pen = TTGlyphPen(None)
    for row, cells in enumerate(rows):
        for col, filled in enumerate(cells):
            if filled != '1':
                continue
            x0 = 60 + round(col * 465 / 5)
            x1 = 60 + round((col + 1) * 465 / 5)
            y1 = 631 - round(row * 643 / 7)
            y0 = 631 - round((row + 1) * 643 / 7)
            pen.moveTo((x0, y0))
            for point in [(x0, y1), (x1, y1), (x1, y0)]:
                pen.lineTo(point)
            pen.closePath()
    font['glyf'][name] = pen.glyph()

# Give lowercase l a foot within its existing advance width.
pen = TTGlyphPen(None)
pen.moveTo((60, 631))
for point in [(161, 631), (161, 88), (201, 88), (201, -12), (60, -12)]:
    pen.lineTo(point)
pen.closePath()
font['glyf']['l'] = pen.glyph()

# Keep variable advance widths and side bearings at every UI weight. Replace
# only shape deltas; the source shifts left edges one unit at weight 700.
# The last four points are the original metric phantoms.
for name in [font.getBestCmap()[ord(char)] for char in '02567l']:
    point_count = len(font['glyf'][name].getCoordinates(font['glyf'])[0])
    for variation in font['gvar'].variations[name]:
        variation.coordinates = [(1, 0)] * point_count + [delta or (0, 0) for delta in variation.coordinates[-4:]]

options = subset.Options()
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=[ord(char) for char in '02567l'])
subsetter.subset(font)
for name_id, value in {
    1: 'Farm Readable', 2: 'Regular', 3: 'Farm Readable Regular 1.0',
    4: 'Farm Readable Regular', 6: 'FarmReadable-Regular',
}.items():
    font['name'].setName(value, name_id, 3, 1, 0x409)
    font['name'].setName(value, name_id, 1, 0, 0)
font.save('public/fonts/farm-readable.ttf')
