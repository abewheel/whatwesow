# Animal sprite briefs

Generated with the built-in image tool. Style reference: `public/art/distinct-buildings.png`.

## Seasonal shelters

Create a transparent three-column, four-row isometric sprite atlas matching the reference's warm detailed painted pixel art, textured timber and shingles, upper-left light, and 2:1 camera. Columns: a sage-roof chicken coop with nesting hatch and fenced run; a red dairy barn with slate roof, milk churn, and paddock; a cream timber sheep shelter with russet roof, hay rack, and paddock. Rows repeat the same buildings in spring flowers, summer golden grass, fall russet leaves, and winter snow. Leave space for separate animated animals in each yard. Use textured ground with irregular edges, transparent gutters, consistent scale and ground pivot. No animals, labels, UI, or text.

## Livestock

Create a transparent three-column, four-row sprite sheet in the same warm painted pixel art. Columns: white hen with red comb; black and white dairy cow with pink muzzle; cream sheep with dark face and feet. Rows show standing, feeding, a small head turn, and feeding again. Preserve individual identity, natural anatomy, body scale, and grounded feet across frames. Use an isometric three-quarter camera, textured feathers and wool, warm outlines, and readable small silhouettes. No ground, props, fences, buildings, or text.

The renderer uses explicit frame rectangles because the generated pose rows have uneven gutters. Alpha envelopes across all shelter seasons keep visible ground inside each 3 × 3 lot. Source files remain unmodified.
