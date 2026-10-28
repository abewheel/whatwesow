import { expect, it } from "vitest";
import { homesteadState, parseState } from "./state";
import { structureSize, footprint, cellKey, buildings } from "../micro/world";
it("enlarges old buildings once without losing crops, paid work, IDs, coins or time", () => {
  const old = homesteadState();
  delete old.buildingLayout;
  old.plots[0] = { crop: "turnip", growth: 1 };
  old.structures.push({
    id: 2,
    kind: "barn",
    row: 61,
    col: 61,
    level: 1,
    pendingConstruction: true,
    harvestsAtLevel: 12,
  });
  old.nextStructureId = 3;
  const next = parseState(old);
  expect(old.structures[1].row).toBe(61);
  expect(next.plotCells).toEqual(old.plotCells);
  expect(next.plots).toEqual(old.plots);
  expect(next.coins).toBe(old.coins);
  expect(next.year).toBe(old.year);
  for (const s of next.structures)
    expect(structureSize(s)).toEqual({
      width: buildings[s.kind].width,
      height: buildings[s.kind].height,
    });
  expect(next.structures[1]).toMatchObject({
    id: 2,
    pendingConstruction: true,
    harvestsAtLevel: 12,
  });
  const cells = [
    ...next.plotCells,
    ...next.structures.flatMap((s) =>
      footprint(s, structureSize(s).width, structureSize(s).height),
    ),
  ].map(cellKey);
  expect(new Set(cells).size).toBe(cells.length);
  expect(parseState(JSON.parse(JSON.stringify(next)))).toEqual(next);
});
it("keeps a packed historical farm intact until there is room to move its building", () => {
  const old = homesteadState();
  delete old.buildingLayout;
  const reserved = new Set(footprint(old.structures[0], 3, 2).map(cellKey));
  old.plotCells = Array.from({ length: 4096 }, (_, i) => ({
    row: Math.floor(i / 64),
    col: i % 64,
  })).filter((c) => !reserved.has(cellKey(c)));
  old.plots = old.plotCells.map(() => null);
  old.plotIds = old.plotCells.map((_, i) => i + 1);
  old.nextPlotId = old.plots.length + 1;
  const next = parseState(old);
  expect(next.plotCells).toEqual(old.plotCells);
  expect(next.structures).toEqual(old.structures);
});
