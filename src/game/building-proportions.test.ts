import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildingArtwork, distinctBuildingRect } from "./building-artwork";
import { animalArtwork } from "./animal-layout";
import { buildings } from "../micro/world";
it("uses one scale for both axes of each original building frame", () => {
  const png = readFileSync(
    new URL("../../public/art/distinct-buildings.png", import.meta.url),
  );
  for (let frame = 0; frame < 7; frame++) {
    const art = buildingArtwork(
      { row: 10, col: 10, width: 5, height: 5 },
      frame,
      true,
    );
    const { width, height } = distinctBuildingRect(
      frame,
      png.readUInt32BE(16),
      png.readUInt32BE(20),
    );
    expect(art.height / art.size).toBeCloseTo(height / width, 12);
  }
  const house = buildingArtwork({ row: 0, col: 0, ...buildings.home }, 0);
  expect(house.size).toBeGreaterThan(200);
  expect(house.height).toBe(house.size);
  const pen = animalArtwork({
    row: 0,
    col: 0,
    kind: "dairy",
    ...buildings.dairy,
  });
  expect(pen.height / pen.size).toBeCloseTo(314 / 418);
  expect(pen.size).toBeGreaterThan(260);
});
