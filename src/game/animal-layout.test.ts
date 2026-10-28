import { expect, it } from "vitest";
import {
  animalArtwork,
  animalFrame,
  animalKinds,
  withinAnimalFront,
} from "./animal-layout";
import { buildings } from "../micro/world";

it.each(animalKinds)(
  "%s seasonal art stays behind both front neighbors",
  (kind) => {
    const lot = {
      kind,
      row: 10,
      col: 20,
      width: buildings[kind].width,
      height: buildings[kind].height,
    };
    const art = animalArtwork(lot);
    // Measured maximum opaque extents of all four source frames.
    const [maxRow, maxCol] =
      kind === "coop"
        ? [1.108, 2.111]
        : kind === "dairy"
          ? [1.12, 2.154]
          : [1.151, 2.096];
    expect(art.row + (maxRow * art.size) / 64).toBeLessThan(
      lot.row + lot.height - 0.5,
    );
    expect(art.col + (maxCol * art.size) / 64).toBeLessThan(
      lot.col + lot.width - 0.5,
    );
    for (const season of ["spring", "summer", "fall", "winter"])
      expect(animalFrame(kind, season) % 3).toBe(animalKinds.indexOf(kind));
  },
);
it("does not let an animal roof steal front neighbor tiles", () => {
  const anchor = { x: 0, y: 0 };
  expect(withinAnimalFront({ x: -96, y: 48 }, anchor, 3, 3)).toBe(false);
  expect(withinAnimalFront({ x: 96, y: 48 }, anchor, 3, 3)).toBe(false);
  expect(withinAnimalFront({ x: 0, y: 64 }, anchor, 3, 3)).toBe(true);
});
